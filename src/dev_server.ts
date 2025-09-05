/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type tsStatic from 'typescript'
import { cliui } from '@poppinss/cliui'
import type Hooks from '@poppinss/hooks'
import prettyHrtime from 'pretty-hrtime'
import { fileURLToPath } from 'node:url'
import { type FSWatcher } from 'chokidar'
import { type ResultPromise } from 'execa'
import string from '@poppinss/utils/string'
import { join, relative } from 'node:path/posix'
import { RuntimeException } from '@poppinss/utils/exception'

import debug from './debug.ts'
import { FileSystem } from './file_system.ts'
import { ShortcutsManager } from './shortcuts_manager.ts'
import type { DevServerOptions } from './types/common.ts'
import { IndexGenerator } from './index_generator/main.ts'
import { getPort, loadHooks, parseConfig, runNode, throttle, watch } from './utils.ts'
import {
  type HookParams,
  type RouterHooks,
  type CommonHooks,
  type WatcherHooks,
  type DevServerHooks,
} from './types/hooks.ts'

/**
 * Exposes the API to start the development server in HMR, watch or static mode.
 *
 * In HMR mode, the DevServer will exec the "bin/server.ts" file and let hot-hook
 * manage the changes using hot module reloading.
 *
 * In watch mode, the DevServer will start an internal watcher and restarts the after
 * every file change. The files must be part of the TypeScript project (via tsconfig.json),
 * or registered as metaFiles.
 *
 * @example
 * const devServer = new DevServer(cwd, { hmr: true, hooks: [] })
 * await devServer.start(ts)
 */
export class DevServer {
  /**
   * Pre-allocated info object for hot-hook change events to avoid repeated object creation
   */
  static readonly #HOT_HOOK_CHANGE_INFO = {
    source: 'hot-hook' as const,
    fullReload: false,
    hotReloaded: false,
  }

  /**
   * Pre-allocated info object for hot-hook full reload events
   */
  static readonly #HOT_HOOK_FULL_RELOAD_INFO = {
    source: 'hot-hook' as const,
    fullReload: true,
    hotReloaded: false,
  }

  /**
   * Pre-allocated info object for hot-hook invalidation events
   */
  static readonly #HOT_HOOK_INVALIDATED_INFO = {
    source: 'hot-hook' as const,
    fullReload: false,
    hotReloaded: true,
  }

  /**
   * Pre-allocated info object for file watcher events
   */
  static readonly #WATCHER_INFO = {
    source: 'watcher' as const,
    fullReload: true,
    hotReloaded: false,
  }

  /**
   * External listeners that are invoked when child process
   * gets an error or closes
   */
  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  /**
   * The stickyPort is set by the start and the startAndWatch methods
   * and we will continue to use that port during restart
   */
  #stickyPort!: string

  /**
   * The mode is set by the start and the startAndWatch methods
   */
  #mode: 'hmr' | 'watch' | 'static' = 'static'

  /**
   * Reference to chokidar watcher
   */
  #watcher?: FSWatcher

  /**
   * Reference to the child process
   */
  #httpServer?: ResultPromise

  /**
   * Keyboard shortcuts manager instance
   */
  #shortcutsManager?: ShortcutsManager

  /**
   * Filesystem is used to decide which files to watch or entertain when
   * using hot-hook
   */
  #fileSystem!: FileSystem

  /**
   * Index generator for managing auto-generated index files
   */
  #indexGenerator!: IndexGenerator

  /**
   * Hooks to execute custom actions during the dev server lifecycle
   */
  #hooks!: Hooks<
    {
      [K in keyof CommonHooks]: [HookParams<K>, HookParams<K>]
    } & {
      [K in keyof RouterHooks]: [HookParams<K>, HookParams<K>]
    } & {
      [K in keyof DevServerHooks]: [HookParams<K>, HookParams<K>]
    } & {
      [K in keyof WatcherHooks]: [HookParams<K>, HookParams<K>]
    }
  >

  /**
   * CLI UI instance for displaying colorful messages and progress information
   */
  ui = cliui()

  /**
   * Restarts the HTTP server and throttle concurrent calls to
   * ensure we do not end up with a long loop of restarts
   */
  #restartHTTPServer = throttle(async () => {
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }
    await this.#startHTTPServer(this.#stickyPort)
  }, 'restartHTTPServer')

  /**
   * Sets up keyboard shortcuts for development server interactions
   *
   * Initializes the shortcuts manager with callbacks for restarting the server,
   * clearing the screen, and quitting the application.
   */
  #setupKeyboardShortcuts() {
    this.#shortcutsManager = new ShortcutsManager({
      logger: this.ui.logger,
      callbacks: {
        onRestart: () => this.#restartHTTPServer(),
        onClear: () => this.#clearScreen(),
        onQuit: () => this.close(),
      },
    })

    this.#shortcutsManager.setup()
  }

  /**
   * Cleanup keyboard shortcuts and restore terminal state
   *
   * Removes keyboard shortcuts event listeners and restores the terminal
   * to its normal state when shutting down the development server.
   */
  #cleanupKeyboardShortcuts() {
    this.#shortcutsManager?.cleanup()
  }

  /**
   * The mode in which the DevServer is running.
   */
  get mode() {
    return this.#mode
  }

  /**
   * Script file to start the development server
   */
  scriptFile: string = 'bin/server.ts'

  /**
   * The current working directory URL
   */
  cwd: URL

  /**
   * File path computed from the cwd
   */
  cwdPath: string

  /**
   * Development server configuration options including hooks and environment variables
   */
  options: DevServerOptions

  /**
   * Create a new DevServer instance
   *
   * @param cwd - The current working directory URL
   * @param options - Development server configuration options
   */
  constructor(cwd: URL, options: DevServerOptions) {
    this.cwd = cwd
    this.options = options
    this.cwdPath = string.toUnixSlash(fileURLToPath(this.cwd))
  }

  /**
   * Type guard to check if child process message is from AdonisJS HTTP server
   *
   * Validates that a message from the child process contains the expected
   * structure indicating the AdonisJS server is ready and listening.
   *
   * @param message - Unknown message from child process
   * @returns True if message is an AdonisJS ready message
   */
  #isAdonisJSReadyMessage(message: unknown): message is {
    isAdonisJS: true
    environment: 'web'
    port: number
    host: string
    duration?: [number, number]
  } {
    return (
      message !== null &&
      typeof message === 'object' &&
      'isAdonisJS' in message &&
      'environment' in message &&
      message.environment === 'web'
    )
  }

  /**
   * Displays server information and executes hooks after server startup
   *
   * Shows server URL, mode, startup duration, and help instructions.
   * Also executes the devServerStarted hooks to allow custom post-startup logic.
   *
   * @param message - Server ready message containing port, host, and optional duration
   */
  async #postServerReady(message: { port: number; host: string; duration?: [number, number] }) {
    const host = message.host === '0.0.0.0' ? '127.0.0.1' : message.host
    const info = { host, port: message.port }
    const serverUrl = `http://${host}:${message.port}`

    this.#shortcutsManager?.setServerUrl(serverUrl)
    const displayMessage = this.ui
      .sticker()
      .add(`Server address: ${this.ui.colors.cyan(serverUrl)}`)
      .add(`Mode: ${this.ui.colors.cyan(this.mode)}`)

    if (message.duration) {
      displayMessage.add(`Ready in: ${this.ui.colors.cyan(prettyHrtime(message.duration))}`)
    }

    displayMessage.add(`Press ${this.ui.colors.dim('h')} to show help`)

    /**
     * Run hooks before displaying the "displayMessage". It will allow hooks to add
     * custom lines to the display message.
     */
    try {
      await this.#hooks.runner('devServerStarted').run(this, info, displayMessage)
    } catch (error) {
      this.ui.logger.error('One of the "devServerStarted" hooks failed')
      this.ui.logger.fatal(error)
    }

    displayMessage.render()
  }

  /**
   * Type guard to check if child process message is from hot-hook
   *
   * Validates that a message from the child process is a hot-hook notification
   * about file changes, invalidations, or full reloads.
   *
   * @param message - Unknown message from child process
   * @returns True if message is a hot-hook message
   */
  #isHotHookMessage(message: unknown): message is {
    type: 'hot-hook:file-changed' | 'hot-hook:invalidated' | 'hot-hook:full-reload'
    path: string
    action?: 'add' | 'change' | 'unlink'
    paths?: string[]
  } {
    return (
      message !== null &&
      typeof message === 'object' &&
      'type' in message &&
      typeof message.type === 'string' &&
      message.type.startsWith('hot-hook:')
    )
  }

  /**
   * Conditionally clears the terminal screen based on configuration
   *
   * Clears the terminal screen if the clearScreen option is enabled,
   * providing a clean view for development output.
   */
  #clearScreen() {
    if (this.options.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Handles file change events and triggers appropriate server actions
   *
   * Processes file change notifications and determines whether to restart
   * the server, hot reload, or ignore the change based on file type and mode.
   *
   * @param relativePath - Relative path to the changed file
   * @param absolutePath - Absolute path to the changed file
   * @param action - Type of file change (add, update, delete)
   * @param info - Optional information about the change source and reload behavior
   */
  #handleFileChange(
    relativePath: string,
    absolutePath: string,
    action: 'add' | 'update' | 'delete',
    info?: {
      source: 'hot-hook' | 'watcher'
      hotReloaded: boolean
      fullReload: boolean
    }
  ) {
    /**
     * Ignore add and delete events in HMR mode and let hot-hook find the
     * file via import first.
     *
     * Remember, hot-hook does not send the action as "add" or "delete" if this
     * file is being imported.
     */
    if ((action === 'add' || action === 'delete') && this.mode === 'hmr') {
      debug('ignoring add and delete actions in HMR mode %s', relativePath)
      return
    }

    /**
     * Notify about the invalidated file
     */
    if (info && info.source === 'hot-hook' && info.hotReloaded) {
      debug('hot reloading %s, info %O', relativePath, info)
      this.ui.logger.log(`${this.ui.colors.green('invalidated')} ${relativePath}`)
      return
    }

    /**
     * Do not do anything when fullReload is not enabled.
     */
    if (info && !info.fullReload) {
      debug('ignoring full reload', relativePath, info)
      return
    }

    const file = this.#fileSystem.inspect(absolutePath, relativePath)
    if (!file) {
      return
    }

    if (file.reloadServer) {
      this.#clearScreen()
      this.ui.logger.log(`${this.ui.colors.green(action)} ${relativePath}`)
      this.#restartHTTPServer()
      return
    }

    this.ui.logger.log(`${this.ui.colors.green(action)} ${relativePath}`)
  }

  /**
   * Regenerates index files when a file is added or removed
   *
   * Updates the index generator to reflect file system changes by adding
   * or removing files from the generated index files.
   *
   * @param filePath - Absolute path to the file that changed
   * @param action - Whether the file was added or deleted
   */
  #regenerateIndex(filePath: string, action: 'add' | 'delete') {
    if (action === 'add') {
      return this.#indexGenerator.addFile(filePath)
    }
    return this.#indexGenerator.removeFile(filePath)
  }

  /**
   * Registers hooks for file system events and server restart triggers
   *
   * Sets up event handlers that respond to file additions, changes, and removals
   * by regenerating indexes and handling server restarts as needed.
   */
  #registerServerRestartHooks() {
    this.#hooks.add('fileAdded', (relativePath, absolutePath) => {
      this.#regenerateIndex(absolutePath, 'add')
      this.#handleFileChange(relativePath, absolutePath, 'add')
    })
    this.#hooks.add('fileChanged', (relativePath, absolutePath, info) =>
      this.#handleFileChange(relativePath, absolutePath, 'update', info)
    )
    this.#hooks.add('fileRemoved', (relativePath, absolutePath) => {
      this.#regenerateIndex(absolutePath, 'delete')
      this.#handleFileChange(relativePath, absolutePath, 'delete')
    })
  }

  /**
   * Initiate the state for DevServer and executes the init hooks
   */
  async #init(ts: typeof tsStatic, mode: 'hmr' | 'watch' | 'static'): Promise<boolean> {
    const tsConfig = parseConfig(this.cwd, ts)
    if (!tsConfig) {
      this.#onError?.(new RuntimeException('Unable to parse tsconfig file'))
      return false
    }

    this.#mode = mode
    this.#clearScreen()
    this.ui.logger.info(`starting server in ${this.#mode} mode...`)

    this.#indexGenerator = new IndexGenerator(this.cwdPath, this.ui.logger)
    this.#stickyPort = String(await getPort(this.cwd))
    this.#fileSystem = new FileSystem(this.cwdPath, tsConfig, this.options)

    this.ui.logger.info('loading hooks...')
    this.#hooks = await loadHooks(this.options.hooks, [
      'init',
      'routesCommitted',
      'routesScanning',
      'routesScanned',
      'devServerStarting',
      'devServerStarted',
      'fileAdded',
      'fileChanged',
      'fileRemoved',
    ])

    this.#registerServerRestartHooks()
    this.#setupKeyboardShortcuts()

    /**
     * Run init hooks and clear them as they won't be executed
     * ever again
     */
    await this.#hooks.runner('init').run(this, this.#indexGenerator)
    this.#hooks.clear('init')

    this.ui.logger.info('generating indexes...')
    await this.#indexGenerator.generate()
    return true
  }

  /**
   * Starts the HTTP server as a child process
   *
   * Creates a new Node.js child process to run the server script with the
   * specified port and configuration. Sets up message handlers for server
   * ready notifications and hot-hook events.
   *
   * @param port - Port number for the server to listen on
   */
  async #startHTTPServer(port: string) {
    /**
     * Execute the registered before creating the child process. This will allow
     * hooks to modify the options before they are used.
     */
    await this.#hooks.runner('devServerStarting').run(this)
    debug('starting http server using "%s" file, options %O', this.scriptFile, this.options)

    return new Promise<void>(async (resolve) => {
      /**
       * Creating child process
       */
      this.#httpServer = runNode(this.cwd, {
        script: this.scriptFile,
        env: { PORT: port, ...this.options.env },
        nodeArgs: this.options.nodeArgs,
        reject: true,
        scriptArgs: this.options.scriptArgs,
      })

      this.#httpServer.on('message', async (message) => {
        if (this.#isAdonisJSReadyMessage(message)) {
          debug('received http server ready message %O', message)

          await this.#postServerReady(message)
          resolve()
        } else if (this.#mode === 'hmr' && this.#isHotHookMessage(message)) {
          debug('received hot-hook message %O', message)
          const absolutePath = message.path ? string.toUnixSlash(message.path) : ''
          const relativePath = relative(this.cwdPath, absolutePath)

          if (message.type === 'hot-hook:file-changed') {
            const { action } = message

            if (action === 'add') {
              this.#hooks.runner('fileAdded').run(relativePath, absolutePath, this)
            } else if (action === 'change') {
              this.#hooks
                .runner('fileChanged')
                .run(relativePath, absolutePath, DevServer.#HOT_HOOK_CHANGE_INFO, this)
            } else if (action === 'unlink') {
              this.#hooks.runner('fileRemoved').run(relativePath, absolutePath, this)
            }
          } else if (message.type === 'hot-hook:full-reload') {
            this.#hooks
              .runner('fileChanged')
              .run(relativePath, absolutePath, DevServer.#HOT_HOOK_FULL_RELOAD_INFO, this)
          } else if (message.type === 'hot-hook:invalidated') {
            this.#hooks
              .runner('fileChanged')
              .run(relativePath, absolutePath, DevServer.#HOT_HOOK_INVALIDATED_INFO, this)
          }
        }
      })

      this.#httpServer
        .then((result) => {
          if (!this.#watcher) {
            this.#onClose?.(result.exitCode!)
          } else {
            this.ui.logger.info('Underlying HTTP server closed. Still watching for changes')
          }
        })
        .catch((error) => {
          if (!this.#watcher) {
            this.#onError?.(error)
          } else {
            this.ui.logger.info('Underlying HTTP server died. Still watching for changes')
          }
        })
        .finally(() => {
          resolve()
        })
    })
  }

  /**
   * Add listener to get notified when dev server is closed
   *
   * @param callback - Function to call when dev server closes
   * @returns This DevServer instance for method chaining
   */
  onClose(callback: (exitCode: number) => any): this {
    this.#onClose = callback
    return this
  }

  /**
   * Add listener to get notified when dev server encounters an error
   *
   * @param callback - Function to call when dev server encounters an error
   * @returns This DevServer instance for method chaining
   */
  onError(callback: (error: any) => any): this {
    this.#onError = callback
    return this
  }

  /**
   * Close watchers and the running child process
   */
  async close() {
    this.#cleanupKeyboardShortcuts()
    await this.#watcher?.close()
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }
  }

  /**
   * Start the development server in static or HMR mode
   *
   * @param ts - TypeScript module reference
   */
  async start(ts: typeof tsStatic) {
    const initiated = await this.#init(ts, this.options.hmr ? 'hmr' : 'static')
    if (!initiated) {
      return
    }

    if (this.#mode === 'hmr') {
      this.options.nodeArgs.push('--import=hot-hook/register')
      this.options.env = {
        ...this.options.env,
        HOT_HOOK_INCLUDE: this.#fileSystem.includes.join(','),
        HOT_HOOK_IGNORE: this.#fileSystem.excludes.join(','),
        HOT_HOOK_RESTART: (this.options.metaFiles ?? [])
          .filter(({ reloadServer }) => !!reloadServer)
          .map(({ pattern }) => pattern)
          .join(','),
      }
    }

    this.ui.logger.info('starting HTTP server...')
    await this.#startHTTPServer(this.#stickyPort)
  }

  /**
   * Start the development server in watch mode and restart on file changes
   *
   * @param ts - TypeScript module reference
   * @param options - Watch options including polling mode
   */
  async startAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const initiated = await this.#init(ts, 'watch')
    if (!initiated) {
      return
    }

    this.ui.logger.info('starting HTTP server...')
    await this.#startHTTPServer(this.#stickyPort)

    /**
     * Create watcher
     */
    this.#watcher = watch({
      usePolling: options?.poll ?? false,
      cwd: this.cwdPath,
      ignoreInitial: true,
      ignored: (file, stats) => {
        if (!stats) {
          return false
        }
        if (stats.isFile()) {
          return !this.#fileSystem.shouldWatchFile(file)
        }
        return !this.#fileSystem.shouldWatchDirectory(file)
      },
    })

    /**
     * Notify the watcher is ready
     */
    this.#watcher.on('ready', () => {
      this.ui.logger.info('watching file system for changes...')
    })

    /**
     * Cleanup when watcher dies
     */
    this.#watcher.on('error', (error: any) => {
      this.ui.logger.warning('file system watcher failure')
      this.ui.logger.fatal(error as any)

      this.#onError?.(error)
      this.#watcher?.close()
    })

    this.#watcher.on('add', (filePath) => {
      const relativePath = string.toUnixSlash(filePath)
      const absolutePath = join(this.cwdPath, relativePath)
      this.#hooks.runner('fileAdded').run(relativePath, absolutePath, this)
    })
    this.#watcher.on('change', (filePath) => {
      const relativePath = string.toUnixSlash(filePath)
      const absolutePath = join(this.cwdPath, relativePath)
      this.#hooks
        .runner('fileChanged')
        .run(relativePath, absolutePath, DevServer.#WATCHER_INFO, this)
    })
    this.#watcher.on('unlink', (filePath) => {
      const relativePath = string.toUnixSlash(filePath)
      const absolutePath = join(this.cwdPath, relativePath)
      this.#hooks.runner('fileRemoved').run(relativePath, absolutePath, this)
    })
  }
}
