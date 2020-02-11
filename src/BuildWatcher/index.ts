/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import chokidar from 'chokidar'
import { join, extname } from 'path'
import { pathExists } from 'fs-extra'
import { Logger } from '@poppinss/fancy-logs'

import { RcFile } from '../RcFile'
import { Manifest } from '../Manifest'
import { HttpServer } from '../HttpServer'
import { SERVER_ENTRY_FILE } from '../../config/paths'

/**
 * Exposes the API to watch the output build folder and restart
 * HTTP server on changes.
 */
export class BuildWatcher {
  private manifest = new Manifest(this.buildRoot, this.logger)

  constructor (
    private buildRoot: string,
    private nodeArgs: string[],
    private logger = new Logger(),
  ) {}

  /**
   * Returns true when filePath is .js or .json. We need this to
   * restart the HTTP server
   */
  private isScriptFile (filePath: string) {
    return ['.js', '.json'].includes(extname(filePath))
  }

  /**
   * Watch for compiled output changes
   */
  public async watch (buildDir: string, poll = false) {
    const absPath = join(this.buildRoot, buildDir)
    const hasBuildDir = await pathExists(absPath)
    if (!hasBuildDir) {
      this.logger.error(`"${buildDir}" doesn't exists. Make sure to compile the source code first.`)
      return
    }

    const rcFile = new RcFile(absPath)
    const httpServer = new HttpServer(SERVER_ENTRY_FILE, absPath, this.nodeArgs, this.logger)

    /**
     * Initate watcher. Instead of ignoring files upfront, we use the
     * events handler to filter out files.
     */
    const watcher = chokidar.watch(['.'], {
      ignoreInitial: true,
      usePolling: poll,
      cwd: absPath,
      ignored: [
        'node_modules/**',
      ],
    })

    /**
     * Notify that server has died
     */
    httpServer.on('exit', ({ code }) => {
      this.logger.stop('Underlying HTTP server died with "%s code"', code)
    })

    /**
     * Handle new file additions
     */
    watcher.on('add', (filePath: string) => {
      const metaData = rcFile.getMetaData(filePath)
      const isScriptFile = this.isScriptFile(filePath)

      if (isScriptFile || metaData.reload) {
        this.logger.create(filePath)
        httpServer.restart()
      }

      if (isScriptFile && rcFile.isCommandsPath(filePath)) {
        this.manifest.generate()
      }
    })

    /**
     * Handle file updates
     */
    watcher.on('change', (filePath: string) => {
      const metaData = rcFile.getMetaData(filePath)
      const isScriptFile = this.isScriptFile(filePath)

      if (isScriptFile || metaData.reload) {
        this.logger.update(filePath)
        httpServer.restart()
      }

      if (isScriptFile && rcFile.isCommandsPath(filePath)) {
        this.manifest.generate()
      }
    })

    /**
     * Handle file removals
     */
    watcher.on('unlink', (filePath: string) => {
      const metaData = rcFile.getMetaData(filePath)
      const isScriptFile = this.isScriptFile(filePath)

      if (metaData.rcFile) {
        this.logger.stop('cannot continue after deletion of .adonisrc.json file')
        watcher.close()
        return
      }

      if (isScriptFile || metaData.reload) {
        this.logger.delete(filePath)
        httpServer.restart()
      }

      if (isScriptFile && rcFile.isCommandsPath(filePath)) {
        this.manifest.generate()
      }
    })

    /**
     * Start the http server when watcher is ready
     */
    watcher.on('ready', () => {
      this.logger.watch({ message: 'watching for file changes', suffix: buildDir })
      httpServer.start()
    })
  }
}
