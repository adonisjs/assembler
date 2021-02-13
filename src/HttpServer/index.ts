/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import execa from 'execa'
import Emittery from 'emittery'
import { logger as uiLogger } from '@poppinss/cliui'

/**
 * Exposes the API to start Node.js HTTP server as a child process. The
 * child process is full managed and cleans up when parent process
 * dies.
 */
export class HttpServer extends Emittery {
  private childProcess: execa.ExecaChildProcess

  constructor(
    private sourceFile: string,
    private projectRoot: string,
    private nodeArgs: string[] = [],
    private logger: typeof uiLogger,
    private env: { [key: string]: string } = {}
  ) {
    super()
  }

  /**
   * Whether or not the underlying process is connected
   */
  public get isConnected() {
    return this.childProcess && this.childProcess.connected && !this.childProcess.killed
  }

  /**
   * Start the HTTP server as a child process.
   */
  public start() {
    if (this.isConnected) {
      throw new Error('Http server is already connected. Call restart instead')
    }

    this.logger.info(this.childProcess ? 're-starting http server...' : 'starting http server...')

    this.childProcess = execa.node(this.sourceFile, [], {
      buffer: false,
      stdio: 'inherit',
      cwd: this.projectRoot,
      env: {
        FORCE_COLOR: 'true',
        ...this.env,
      },
      nodeOptions: ['-r', '@adonisjs/assembler/build/register'].concat(this.nodeArgs),
    })

    /**
     * Notify about server events
     */
    this.childProcess.on('message', (message) => {
      if (message && message['origin'] === 'adonis-http-server') {
        this.emit('ready', message)
      }
    })
    this.childProcess.on('close', (code, signal) => this.emit('close', { code, signal }))
    this.childProcess.on('exit', (code, signal) => this.emit('exit', { code, signal }))
  }

  /**
   * Stop the underlying process
   */
  public stop() {
    if (this.childProcess) {
      this.childProcess.removeAllListeners()
      this.childProcess.kill('SIGKILL')
    }
  }

  /**
   * Restart the server by killing the old one
   */
  public restart() {
    this.stop()
    this.start()
  }
}
