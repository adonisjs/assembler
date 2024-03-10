/*
 * @adonisjs/core
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { ExecaChildProcess } from 'execa'
import { type Logger, cliui } from '@poppinss/cliui'

import { run } from './helpers.js'
import type { AssetsBundlerOptions } from './types.js'

/**
 * Instance of CLIUI
 */
const ui = cliui()

/**
 * Exposes the API to start the development server for processing assets during
 * development.
 *
 * - Here we are running the assets dev server in a child process.
 * - Piping the output from the child process and reformatting it before writing it to
 *   process streams.
 *
 * AssetsDevServer is agnostic and can run any assets dev server. Be it Vite or Encore or
 * even Webpack directly.
 */
export class AssetsDevServer {
  #cwd: URL
  #logger = ui.logger
  #options?: AssetsBundlerOptions
  #devServer?: ExecaChildProcess<string>

  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors()
  }

  constructor(cwd: URL, options?: AssetsBundlerOptions) {
    this.#cwd = cwd
    this.#options = options
  }

  /**
   * Logs messages from vite dev server stdout and stderr
   */
  #logViteDevServerMessage(data: Buffer) {
    const dataString = data.toString()
    const lines = dataString.split('\n')

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
     * Logging VITE ready in message with proper
     * spaces and newlines
     */
    if (dataString.includes('ready in')) {
      console.log('')
      console.log(dataString.trim())
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
   * Set a custom CLI UI logger
   */
  setLogger(logger: Logger) {
    this.#logger = logger
    return this
  }

  /**
   * Starts the assets bundler server. The assets bundler server process is
   * considered as the secondary process and therefore we do not perform
   * any cleanup if it dies.
   */
  start() {
    if (!this.#options?.enabled) {
      return
    }

    this.#logger.info(`starting "${this.#options.driver}" dev server...`)

    /**
     * Create child process
     */
    this.#devServer = run(this.#cwd, {
      script: this.#options.cmd,

      /**
       * We do not inherit the stdio for vite and encore, because in
       * inherit mode they own the stdin and interrupts the
       * `Ctrl + C` command.
       */
      stdio: 'pipe',
      scriptArgs: this.#options.args,
    })

    /**
     * Log child process messages
     */
    this.#devServer.stdout?.on('data', (data) => {
      if (this.#options!.driver === 'vite') {
        this.#logViteDevServerMessage(data)
      } else {
        this.#logAssetsDevServerMessage(data)
      }
    })

    this.#devServer.stderr?.on('data', (data) => {
      if (this.#options!.driver === 'vite') {
        this.#logViteDevServerMessage(data)
      } else {
        this.#logAssetsDevServerMessage(data)
      }
    })

    this.#devServer
      .then((result) => {
        this.#logger.warning(
          `"${this.#options!.driver}" dev server closed with status code "${result.exitCode}"`
        )
      })
      .catch((error) => {
        this.#logger.warning(`unable to connect to "${this.#options!.driver}" dev server`)
        this.#logger.fatal(error)
      })
  }

  /**
   * Stop the dev server
   */
  stop() {
    if (this.#devServer) {
      this.#devServer.removeAllListeners()
      this.#devServer.kill('SIGTERM')
      this.#devServer = undefined
    }
  }
}
