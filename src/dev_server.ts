/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import getPort from 'get-port'
import picomatch from 'picomatch'
import type tsStatic from 'typescript'
import { type ExecaChildProcess } from 'execa'
import type { Watcher } from '@poppinss/chokidar-ts'
import { cliui, type Logger } from '@poppinss/cliui'
import { EnvLoader, EnvParser } from '@adonisjs/env'

import { watch } from './watch.js'
import { run, runNode } from './run.js'
import type { DevServerOptions } from './types.js'

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
 * - Assigns a random PORT, when PORT inside .env file is in use
 * - Uses tsconfig.json file to collect a list of files to watch.
 * - Uses metaFiles from .adonisrc.json file to collect a list of files to watch.
 * - Restart HTTP server on every file change.
 */
export class DevServer {
  #cwd: URL
  #logger = ui.logger
  #options: DevServerOptions
  #isWatching: boolean = false
  #scriptFile: string = 'bin/server.js'
  #httpServerProcess?: ExecaChildProcess<string>
  #isMetaFileWithReloadsEnabled: picomatch.Matcher
  #isMetaFileWithReloadsDisabled: picomatch.Matcher
  #watcher?: ReturnType<Watcher['watch']>
  #assetsServerProcess?: ExecaChildProcess<string>
  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors()
  }

  constructor(cwd: URL, options: DevServerOptions) {
    this.#cwd = cwd
    this.#options = options

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
   * Check if file is an .env file
   */
  #isDotEnvFile(filePath: string) {
    if (filePath === '.env') {
      return true
    }

    return filePath.includes('.env.')
  }

  /**
   * Check if file is .adonisrc.json file
   */
  #isRcFile(filePath: string) {
    return filePath === '.adonisrc.json'
  }

  /**
   * Inspect if child process message is from AdonisJS HTTP server
   */
  #isAdonisJSReadyMessage(
    message: unknown
  ): message is { isAdonisJS: true; environment: 'web'; port: number; host: string } {
    return (
      message !== null &&
      typeof message === 'object' &&
      'isAdonisJS' in message &&
      'environment' in message &&
      message.environment === 'web'
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
   * Logs messages from vite dev server stdout and stderr
   */
  #logViteDevServerMessage(data: Buffer) {
    const dataString = data.toString()
    const lines = dataString.split('\n')

    /**
     * Logging VITE ready in message with proper
     * spaces and newlines
     */
    if (dataString.includes('ready in')) {
      console.log('')
      console.log(dataString.trim())
      return
    }

    /**
     * Put a wrapper around vite network address log
     */
    if (dataString.includes('Local') && dataString.includes('Network')) {
      const sticker = ui.sticker().useColors(this.#colors).useRenderer(this.#logger.getRenderer())

      lines.forEach((line: string) => {
        if (line.trim()) {
          sticker.add(line)
        }
      })

      sticker.render()
      return
    }

    /**
     * Log rest of the lines
     */
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.log(line)
      }
    })
  }

  /**
   * Logs messages from assets dev server stdout and stderr
   */
  #logAssetsDevServerMessage(data: Buffer) {
    const dataString = data.toString()
    const lines = dataString.split('\n')
    lines.forEach((line: string) => {
      if (line.trim()) {
        console.log(line)
      }
    })
  }

  /**
   * Returns PORT for starting the HTTP server with option to use
   * a random PORT if main PORT is in use.
   */
  async #getPort(): Promise<number> {
    /**
     * Use existing port if exists
     */
    if (process.env.PORT) {
      return getPort({ port: Number(process.env.PORT) })
    }

    const files = await new EnvLoader(this.#cwd).load()
    for (let file of files) {
      const envVariables = new EnvParser(file.contents).parse()
      if (envVariables.PORT) {
        return getPort({ port: Number(envVariables.PORT) })
      }
    }

    return getPort({ port: 3333 })
  }

  /**
   * Starts the HTTP server
   */
  #startHTTPServer(port: string, mode: 'blocking' | 'nonblocking') {
    this.#httpServerProcess = runNode(this.#cwd, {
      script: this.#scriptFile,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      scriptArgs: this.#options.scriptArgs,
    })

    this.#httpServerProcess.on('message', (message) => {
      if (this.#isAdonisJSReadyMessage(message)) {
        ui.sticker()
          .useColors(this.#colors)
          .useRenderer(this.#logger.getRenderer())
          .add(`Server address: ${this.#colors.cyan(`http://${message.host}:${message.port}`)}`)
          .add(
            `File system watcher: ${this.#colors.cyan(
              `${this.#isWatching ? 'enabled' : 'disabled'}`
            )}`
          )
          .render()
      }
    })

    this.#httpServerProcess
      .then((result) => {
        this.#logger.warning(`underlying HTTP server closed with status code "${result.exitCode}"`)
        if (mode === 'nonblocking') {
          this.#onClose?.(result.exitCode)
          this.#watcher?.close()
        }
      })
      .catch((error) => {
        this.#logger.warning('unable to connect to underlying HTTP server process')
        this.#logger.fatal(error)
        this.#onError?.(error)
        this.#watcher?.close()
      })
  }

  /**
   * Starts the assets bundler server. The assets bundler server process is
   * considered as the secondary process and therefore we do not perform
   * any cleanup if it dies.
   */
  #startAssetsServer() {
    const assetsBundler = this.#options.assets
    if (!assetsBundler?.serve) {
      return
    }

    this.#logger.info(`starting "${assetsBundler.driver}" dev server...`)
    this.#assetsServerProcess = run(this.#cwd, {
      script: assetsBundler.cmd,

      /**
       * We do not inherit the stdio for vite and encore, because they then
       * own the stdin and interrupts the `Ctrl + C`.
       */
      stdio: 'pipe',
      scriptArgs: this.#options.scriptArgs,
    })

    /**
     * Log child process messages
     */
    this.#assetsServerProcess.stdout?.on('data', (data) => {
      if (assetsBundler.driver === 'vite') {
        this.#logViteDevServerMessage(data)
      } else {
        this.#logAssetsDevServerMessage(data)
      }
    })

    this.#assetsServerProcess.stderr?.on('data', (data) => {
      if (assetsBundler.driver === 'vite') {
        this.#logViteDevServerMessage(data)
      } else {
        this.#logAssetsDevServerMessage(data)
      }
    })

    this.#assetsServerProcess
      .then((result) => {
        this.#logger.warning(
          `"${assetsBundler.driver}" dev server closed with status code "${result.exitCode}"`
        )
      })
      .catch((error) => {
        this.#logger.warning(`unable to connect to "${assetsBundler.driver}" dev server`)
        this.#logger.fatal(error)
      })
  }

  /**
   * Restart the development server
   */
  #restart(port: string) {
    if (this.#httpServerProcess) {
      this.#httpServerProcess.removeAllListeners()
      this.#httpServerProcess.kill('SIGKILL')
    }

    this.#startHTTPServer(port, 'blocking')
  }

  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger: Logger) {
    this.#logger = logger
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
   * Start the development server
   */
  async start() {
    this.#clearScreen()
    this.#logger.info('starting HTTP server...')
    this.#startHTTPServer(String(await this.#getPort()), 'nonblocking')

    this.#startAssetsServer()
  }

  /**
   * Start the development server in watch mode
   */
  async startAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const port = String(await this.#getPort())
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
    output.watcher.on('source:add', ({ relativePath }) => {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green('add')} ${relativePath}`)
      this.#restart(port)
    })
    output.watcher.on('source:change', ({ relativePath }) => {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green('update')} ${relativePath}`)
      this.#restart(port)
    })
    output.watcher.on('source:unlink', ({ relativePath }) => {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green('delete')} ${relativePath}`)
      this.#restart(port)
    })

    /**
     * Changes in other files
     */
    output.watcher.on('add', ({ relativePath }) => {
      if (this.#isDotEnvFile(relativePath) || this.#isRcFile(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('add')} ${relativePath}`)
        this.#restart(port)
        return
      }

      if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('add')} ${relativePath}`)
        this.#restart(port)
        return
      }

      if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('add')} ${relativePath}`)
      }
    })
    output.watcher.on('change', ({ relativePath }) => {
      if (this.#isDotEnvFile(relativePath) || this.#isRcFile(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('update')} ${relativePath}`)
        this.#restart(port)
        return
      }

      if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('update')} ${relativePath}`)
        this.#restart(port)
        return
      }

      if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('update')} ${relativePath}`)
      }
    })
    output.watcher.on('unlink', ({ relativePath }) => {
      if (this.#isDotEnvFile(relativePath) || this.#isRcFile(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('delete')} ${relativePath}`)
        this.#restart(port)
        return
      }

      if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('delete')} ${relativePath}`)
        this.#restart(port)
        return
      }

      if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
        this.#clearScreen()
        this.#logger.log(`${this.#colors.green('delete')} ${relativePath}`)
      }
    })
  }
}
