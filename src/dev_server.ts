/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import picomatch from 'picomatch'
import { relative } from 'node:path'
import type tsStatic from 'typescript'
import prettyHrtime from 'pretty-hrtime'
import { type ExecaChildProcess } from 'execa'
import { cliui, type Logger } from '@poppinss/cliui'
import type { Watcher } from '@poppinss/chokidar-ts'

import { AssemblerHooks } from './hooks.js'
import type { DevServerOptions } from './types.js'
import { AssetsDevServer } from './assets_dev_server.js'
import { getPort, isDotEnvFile, runNode, watch } from './helpers.js'

/**
 * Instance of CLIUI
 */
const ui = cliui()

/**
 * Exposes the API to start the development. Optionally, the watch API can be
 * used to watch for file changes and restart the development server.
 *
 * The Dev server performs the following actions
 *
 * - Assigns a random PORT, when PORT inside .env file is in use.
 * - Uses tsconfig.json file to collect a list of files to watch.
 * - Uses metaFiles from adonisrc.ts file to collect a list of files to watch.
 * - Restart HTTP server on every file change.
 */
export class DevServer {
  #cwd: URL
  #logger = ui.logger
  #options: DevServerOptions

  /**
   * Flag to know if the dev server is running in watch
   * mode
   */
  #isWatching: boolean = false

  /**
   * Script file to start the development server
   */
  #scriptFile: string = 'bin/server.js'

  /**
   * Picomatch matcher function to know if a file path is a
   * meta file with reloadServer option enabled
   */
  #isMetaFileWithReloadsEnabled: picomatch.Matcher

  /**
   * Picomatch matcher function to know if a file path is a
   * meta file with reloadServer option disabled
   */
  #isMetaFileWithReloadsDisabled: picomatch.Matcher

  /**
   * External listeners that are invoked when child process
   * gets an error or closes
   */
  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  /**
   * Reference to the child process
   */
  #httpServer?: ExecaChildProcess<string>

  /**
   * Reference to the watcher
   */
  #watcher?: ReturnType<Watcher['watch']>

  /**
   * Reference to the assets server
   */
  #assetsServer?: AssetsDevServer

  /**
   * Hooks to execute custom actions during the dev server lifecycle
   */
  #hooks: AssemblerHooks

  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors()
  }

  constructor(cwd: URL, options: DevServerOptions) {
    this.#cwd = cwd
    this.#options = options
    this.#hooks = new AssemblerHooks(options.hooks)
    if (this.#options.hmr) {
      this.#options.nodeArgs = this.#options.nodeArgs.concat(['--import=hot-hook/register'])
    }

    this.#isMetaFileWithReloadsEnabled = picomatch(
      (this.#options.metaFiles || [])
        .filter(({ reloadServer }) => reloadServer === true)
        .map(({ pattern }) => pattern)
    )

    this.#isMetaFileWithReloadsDisabled = picomatch(
      (this.#options.metaFiles || [])
        .filter(({ reloadServer }) => reloadServer !== true)
        .map(({ pattern }) => pattern)
    )
  }

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
   * Inspect if child process message is coming from Hot Hook
   */
  #isHotHookMessage(message: unknown): message is {
    type: string
    path: string
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
    if (this.#options.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Starts the HTTP server
   */
  #startHTTPServer(port: string, mode: 'blocking' | 'nonblocking') {
    const hooksArgs = { colors: ui.colors, logger: this.#logger }
    this.#httpServer = runNode(this.#cwd, {
      script: this.#scriptFile,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      scriptArgs: this.#options.scriptArgs,
    })

    this.#httpServer.on('message', async (message) => {
      this.#hooks.onHttpServerMessage(hooksArgs, message, {
        restartServer: () => this.#restartHTTPServer(port),
      })

      /**
       * Handle Hot-Hook messages
       */
      if (this.#isHotHookMessage(message)) {
        const path = relative(this.#cwd.pathname, message.path || message.paths?.[0]!)
        this.#hooks.onSourceFileChanged(hooksArgs, path)

        if (message.type === 'hot-hook:full-reload') {
          this.#clearScreen()
          this.#logger.log(`${ui.colors.green('full-reload')} ${path}`)
          this.#restartHTTPServer(port)
          this.#hooks.onDevServerStarted(hooksArgs)
        } else if (message.type === 'hot-hook:invalidated') {
          this.#logger.log(`${ui.colors.green('invalidated')} ${path}`)
        }
      }

      /**
       * Handle AdonisJS ready message
       */
      if (this.#isAdonisJSReadyMessage(message)) {
        const host = message.host === '0.0.0.0' ? '127.0.0.1' : message.host

        const displayMessage = ui
          .sticker()
          .useColors(this.#colors)
          .useRenderer(this.#logger.getRenderer())
          .add(`Server address: ${this.#colors.cyan(`http://${host}:${message.port}`)}`)
          .add(
            `File system watcher: ${this.#colors.cyan(
              `${this.#isWatching ? 'enabled' : 'disabled'}`
            )}`
          )

        if (message.duration) {
          displayMessage.add(`Ready in: ${this.#colors.cyan(prettyHrtime(message.duration))}`)
        }

        displayMessage.render()

        await this.#hooks.onDevServerStarted({ colors: ui.colors, logger: this.#logger })
      }
    })

    this.#httpServer
      .then((result) => {
        if (mode === 'nonblocking') {
          this.#onClose?.(result.exitCode)
          this.#watcher?.close()
          this.#assetsServer?.stop()
        } else {
          this.#logger.info('Underlying HTTP server closed. Still watching for changes')
        }
      })
      .catch((error) => {
        if (mode === 'nonblocking') {
          this.#onError?.(error)
          this.#watcher?.close()
          this.#assetsServer?.stop()
        } else {
          this.#logger.info('Underlying HTTP server died. Still watching for changes')
        }
      })
  }

  /**
   * Starts the assets server
   */
  #startAssetsServer() {
    this.#assetsServer = new AssetsDevServer(this.#cwd, this.#options.assets)
    this.#assetsServer.setLogger(this.#logger)
    this.#assetsServer.start()
  }

  /**
   * Restarts the HTTP server in the watch mode. Do not call this
   * method when not in watch mode
   */
  #restartHTTPServer(port: string) {
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }

    this.#startHTTPServer(port, 'blocking')
  }

  /**
   * Handles a non TypeScript file change
   */
  #handleFileChange(action: string, port: string, relativePath: string) {
    if (isDotEnvFile(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
      this.#restartHTTPServer(port)
      return
    }

    if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
      this.#restartHTTPServer(port)
      return
    }

    if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
    }
  }

  /**
   * Handles TypeScript source file change
   */
  async #handleSourceFileChange(action: string, port: string, relativePath: string) {
    console.log({ relativePath })
    await this.#hooks.onSourceFileChanged({ colors: ui.colors, logger: this.#logger }, relativePath)

    this.#clearScreen()
    this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
    this.#restartHTTPServer(port)
  }

  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger: Logger) {
    this.#logger = logger
    this.#assetsServer?.setLogger(logger)
    return this
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
   * Close watchers and running child processes
   */
  async close() {
    await this.#watcher?.close()
    this.#assetsServer?.stop()
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }
  }

  /**
   * Start the development server
   */
  async start() {
    await this.#hooks.registerDevServerHooks()

    this.#clearScreen()
    this.#logger.info('starting HTTP server...')
    this.#startHTTPServer(String(await getPort(this.#cwd)), 'nonblocking')
    this.#startAssetsServer()
  }

  /**
   * Start the development server in watch mode
   */
  async startAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    await this.#hooks.registerDevServerHooks()

    const port = String(await getPort(this.#cwd))
    this.#isWatching = true

    this.#clearScreen()

    this.#logger.info('starting HTTP server...')
    this.#startHTTPServer(port, 'blocking')

    this.#startAssetsServer()

    /**
     * Create watcher using tsconfig.json file
     */
    const output = watch(this.#cwd, ts, options || {})
    if (!output) {
      this.#onClose?.(1)
      return
    }

    /**
     * Storing reference to watcher, so that we can close it
     * when HTTP server exists with error
     */
    this.#watcher = output.chokidar

    /**
     * Notify the watcher is ready
     */
    output.watcher.on('watcher:ready', () => {
      this.#logger.info('watching file system for changes...')
    })

    /**
     * Cleanup when watcher dies
     */
    output.chokidar.on('error', (error) => {
      this.#logger.warning('file system watcher failure')
      this.#logger.fatal(error)
      this.#onError?.(error)
      output.chokidar.close()
    })

    /**
     * Changes in TypeScript source file
     */
    output.watcher.on('source:add', ({ relativePath }) =>
      this.#handleSourceFileChange('add', port, relativePath)
    )
    output.watcher.on('source:change', ({ relativePath }) =>
      this.#handleSourceFileChange('update', port, relativePath)
    )
    output.watcher.on('source:unlink', ({ relativePath }) =>
      this.#handleSourceFileChange('delete', port, relativePath)
    )

    /**
     * Changes in non-TypeScript source files
     */
    output.watcher.on('add', ({ relativePath }) =>
      this.#handleFileChange('add', port, relativePath)
    )
    output.watcher.on('change', ({ relativePath }) =>
      this.#handleFileChange('update', port, relativePath)
    )
    output.watcher.on('unlink', ({ relativePath }) =>
      this.#handleFileChange('delete', port, relativePath)
    )
  }
}
