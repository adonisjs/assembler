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
import { type UnWrapLazyImport } from '@poppinss/utils/types'

import debug from './debug.ts'
import { FileSystem } from './file_system.ts'
import type { DevServerOptions } from './types/common.ts'
import { type DevServerHooks, type WatcherHooks } from './types/hooks.ts'
import { getPort, loadHooks, parseConfig, runNode, throttle, watch } from './utils.ts'

/**
 * Exposes the API to start the development server in HMR, watch or static mode.
 *
 * In HMR mode, the DevServer will exec the "bin/server.ts" file and let hot-hook
 * manage the changes using hot module reloading.
 *
 * In watch mode, the DevServer will start an internal watcher and restarts the after
 * every file change. The files must be part of the TypeScript project (via tsconfig.json),
 * or registered as metaFiles.
 */
export class DevServer {
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
   * Filesystem is used to decide which files to watch or entertain when
   * using hot-hook
   */
  #fileSystem!: FileSystem

  /**
   * Hooks to execute custom actions during the dev server lifecycle
   */
  #hooks!: Hooks<
    {
      [K in keyof DevServerHooks]: [
        Parameters<UnWrapLazyImport<DevServerHooks[K][number]>>,
        Parameters<UnWrapLazyImport<DevServerHooks[K][number]>>,
      ]
    } & {
      [K in keyof WatcherHooks]: [
        Parameters<UnWrapLazyImport<WatcherHooks[K][number]>>,
        Parameters<UnWrapLazyImport<WatcherHooks[K][number]>>,
      ]
    }
  >

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
   * CLI UI to log colorful messages
   */
  ui = cliui()

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

  constructor(
    public cwd: URL,
    public options: DevServerOptions
  ) {}

  /**
   * Inspect if child process message is from AdonisJS HTTP server
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
   * Displays the server info and executes the hooks after the server has been
   * started.
   */
  async #postServerReady(message: { port: number; host: string; duration?: [number, number] }) {
    const host = message.host === '0.0.0.0' ? '127.0.0.1' : message.host
    const displayMessage = this.ui
      .sticker()
      .add(`Server address: ${this.ui.colors.cyan(`http://${host}:${message.port}`)}`)
      .add(`Mode: ${this.ui.colors.cyan(this.mode)}`)

    if (message.duration) {
      displayMessage.add(`Ready in: ${this.ui.colors.cyan(prettyHrtime(message.duration))}`)
    }

    /**
     * Run hooks before displaying the "displayMessage". It will allow hooks to add
     * custom lines to the display message.
     */
    try {
      await this.#hooks.runner('devServerStarted').run(this, displayMessage)
    } catch (error) {
      this.ui.logger.error('One of the "devServerStarted" hooks failed')
      this.ui.logger.fatal(error)
    }

    displayMessage.render()
  }

  /**
   * Inspect if child process message is coming from hot-hook
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
   * Conditionally clear the terminal screen
   */
  #clearScreen() {
    if (this.options.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Handles file change event
   */
  #handleFileChange(filePath: string, action: string, hotReplaced?: boolean) {
    const file = this.#fileSystem.inspect(filePath)
    if (!file) {
      return
    }

    if (hotReplaced) {
      this.ui.logger.log(`${this.ui.colors.green('invalidated')} ${filePath}`)
      return
    }

    if (file.reloadServer) {
      this.#clearScreen()
      this.ui.logger.log(`${this.ui.colors.green(action)} ${filePath}`)
      this.#restartHTTPServer()
      return
    }

    this.ui.logger.log(`${this.ui.colors.green(action)} ${filePath}`)
  }

  /**
   * Registers inline hooks for the file changes and restarts the
   * HTTP server when a file gets changed.
   */
  #registerServerRestartHooks() {
    this.#hooks.add('fileAdded', (filePath) => this.#handleFileChange(filePath, 'add'))
    this.#hooks.add('fileChanged', (filePath, hotReplaced) =>
      this.#handleFileChange(filePath, 'update', hotReplaced)
    )
    this.#hooks.add('fileRemoved', (filePath) => this.#handleFileChange(filePath, 'delete'))
  }

  /**
   * Starts the HTTP server
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
          await this.#postServerReady(message)
          resolve()
        } else if (this.#mode === 'hmr' && this.#isHotHookMessage(message)) {
          if (message.type === 'hot-hook:file-changed') {
            switch (message.action) {
              case 'add':
                this.#hooks.runner('fileAdded').run(string.toUnixSlash(message.path), this)
                break
              case 'change':
                this.#hooks.runner('fileChanged').run(string.toUnixSlash(message.path), false, this)
                break
              case 'unlink':
                this.#hooks.runner('fileRemoved').run(string.toUnixSlash(message.path), this)
            }
          } else if (message.type === 'hot-hook:full-reload') {
            this.#hooks.runner('fileChanged').run(string.toUnixSlash(message.path), false, this)
          } else if (message.type === 'hot-hook:invalidated') {
            this.#hooks.runner('fileChanged').run(string.toUnixSlash(message.path), true, this)
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
          console.log('ere>>')
          resolve()
        })
    })
  }

  /**
   * Add listener to get notified when dev server is
   * closed
   */
  onClose(callback: (exitCode: number) => any): this {
    this.#onClose = callback
    return this
  }

  /**
   * Add listener to get notified when dev server exists
   * with an error
   */
  onError(callback: (error: any) => any): this {
    this.#onError = callback
    return this
  }

  /**
   * Close watchers and the running child process
   */
  async close() {
    await this.#watcher?.close()
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }
  }

  /**
   * Start the development server
   */
  async start(ts: typeof tsStatic) {
    const tsConfig = parseConfig(this.cwd, ts)
    if (!tsConfig) {
      return
    }

    this.#stickyPort = String(await getPort(this.cwd))
    this.#fileSystem = new FileSystem(this.cwd, tsConfig, this.options)
    this.#hooks = await loadHooks(this.options.hooks, [
      'devServerStarting',
      'devServerStarted',
      'fileAdded',
      'fileChanged',
      'fileRemoved',
    ])
    this.#registerServerRestartHooks()

    if (this.options.hmr) {
      this.#mode = 'hmr'
      this.options.nodeArgs = this.options.nodeArgs.concat('--import=hot-hook/register')
      this.options.env = {
        ...this.options.env,
        HOT_HOOK_INCLUDE: this.#fileSystem.includes.join(','),
        HOT_HOOK_IGNORE: this.#fileSystem.excludes.join(','),
        HOT_HOOK_RESTART: (this.options.metaFiles ?? []).map(({ pattern }) => pattern).join(','),
      }
    }

    this.#clearScreen()
    this.ui.logger.info('starting HTTP server...')
    await this.#startHTTPServer(this.#stickyPort)
  }

  /**
   * Start the development server in watch mode
   */
  async startAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const tsConfig = parseConfig(this.cwd, ts)
    if (!tsConfig) {
      return
    }

    this.#mode = 'watch'
    this.#stickyPort = String(await getPort(this.cwd))
    this.#fileSystem = new FileSystem(this.cwd, tsConfig, this.options)
    this.#hooks = await loadHooks(this.options.hooks, [
      'devServerStarting',
      'devServerStarted',
      'fileAdded',
      'fileChanged',
      'fileRemoved',
    ])
    this.#registerServerRestartHooks()

    this.#clearScreen()
    this.ui.logger.info('starting HTTP server...')
    await this.#startHTTPServer(this.#stickyPort)

    /**
     * Create watcher
     */
    this.#watcher = watch({
      usePolling: options?.poll ?? false,
      cwd: fileURLToPath(this.cwd),
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

    this.#watcher.on('add', (filePath) =>
      this.#hooks.runner('fileAdded').run(string.toUnixSlash(filePath), this)
    )
    this.#watcher.on('change', (filePath) =>
      this.#hooks.runner('fileChanged').run(string.toUnixSlash(filePath), false, this)
    )
    this.#watcher.on('unlink', (filePath) =>
      this.#hooks.runner('fileRemoved').run(string.toUnixSlash(filePath), this)
    )
  }
}
