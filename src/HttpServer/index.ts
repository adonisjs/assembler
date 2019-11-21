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
import { Logger } from '@poppinss/fancy-logs'

/**
 * Exposes the API to start Node.js HTTP server as a child process. The
 * child process is full managed and cleans up when parent process
 * dies.
 */
export class HttpServer extends Emittery {
  private _childProcess: execa.ExecaChildProcess

  constructor (
    private _sourceFile: string,
    private _projectRoot: string,
    private _nodeArgs: string[] = [],
    private _logger: Logger,
  ) {
    super()
  }

  /**
   * Whether or not the underlying process is connected
   */
  get isConnected () {
    return this._childProcess && this._childProcess.connected && !this._childProcess.killed
  }

  /**
   * Start the HTTP server as a child process.
   */
  public start () {
    if (this.isConnected) {
      throw new Error('Http server is already connected. Call restart instead')
    }

    this._logger.info(this._childProcess ? 're-starting http server' : 'starting http server')
    this._childProcess = execa.node(this._sourceFile, [], {
      buffer: false,
      stdio: 'inherit',
      cwd: this._projectRoot,
      env: {
        FORCE_COLOR: 'true',
      },
      nodeOptions: this._nodeArgs,
    })

    this._childProcess.on('close', (code, signal) => this.emit('close', { code, signal }))
    this._childProcess.on('exit', (code, signal) => this.emit('exit', { code, signal }))
  }

  /**
   * Restart the server by killing the old one
   */
  public restart () {
    if (this._childProcess) {
      this._childProcess.removeAllListeners()
      this._childProcess.kill('SIGKILL')
    }
    this.start()
  }
}

/**
 * A dummy implement of Http server to work as null object
 */
export class DummyHttpServer extends HttpServer {
  get isConnected () {
    return true
  }

  public start () {
  }

  public restart () {
  }
}
