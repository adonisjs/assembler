/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { join } from 'path'
import { remove } from 'fs-extra'
import { Logger } from '@poppinss/fancy-logs'

import { Compiler } from '../Compiler'

/**
 * Exposes the API to watch project for compilition changes.
 */
export class Watcher {
  public compiler: Compiler

  constructor (
    appRoot: string,
    private serveApp: boolean,
    private nodeArgs: string[] = [],
    private logger = new Logger(),
  ) {
    this.compiler = new Compiler(appRoot, this.serveApp, this.nodeArgs, this.logger)
  }

  /**
   * Clear stdout
   */
  private clearScreen () {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1Bc')
  }

  /**
   * Build and watch for file changes
   */
  public async watch (poll = false) {
    const config = this.compiler.parseConfig()
    if (!config) {
      return
    }

    /**
     * Standard build steps
     */
    await this.compiler.cleanupBuildDirectory(config.options.outDir!)
    await this.compiler.copyAdonisRcFile(config.options.outDir!)
    await this.compiler.copyMetaFiles(config.options.outDir!)
    this.compiler.buildTypescriptSource(config)

    /**
     * Manifest can be generated without blocking the flow
     */
    this.compiler.manifest.generate()

    /**
     * Creating the http server instance. Even when serving app is disabled,
     * we create an instance of null server to avoid conditionals.
     */
    this.compiler.createHttpServer(config.options.outDir!)

    /**
     * Notify that the http server has died
     */
    this.compiler.httpServer.on('exit', ({ code }) => {
      this.logger.warn('Underlying HTTP server died with "%s code"', code)
    })

    const watcher = this.compiler.tsCompiler.watcher(config)

    /**
     * Watcher is ready after first compile
     */
    watcher.on('watcher:ready', () => {
      this.logger.watch('watching file system for changes')
      this.compiler.httpServer.start()
    })

    /**
     * Subsequent source builds
     */
    watcher.on('subsequent:build', ({ path, skipped, diagnostics }) => {
      this.clearScreen()
      this.logger.compile(path)

      /**
       * Print diagnostics if any
       */
      if (diagnostics.length) {
        this.compiler.renderDiagnostics(diagnostics, watcher.host)
      }

      /**
       * Do not continue when output was never written to the disk
       */
      if (skipped) {
        return
      }

      this.compiler.httpServer.restart()

      /**
       * Generate manifest when path is a commands path
       */
      if (this.compiler.rcFile.isCommandsPath(path)) {
        this.compiler.manifest.generate()
      }
    })

    /**
     * Source file removed
     */
    watcher.on('source:unlink', async (filePath) => {
      this.clearScreen()
      const jsPath = filePath.replace(/\.(d)?ts$/, '.js')
      const typePath = filePath.replace(/\.(d)?ts$/, '.d.ts')

      this.logger.delete(filePath)
      await remove(join(config.options.outDir!, jsPath))
      await remove(join(config.options.outDir!, typePath))

      /**
       * Generate manifest when filePath is a commands path
       */
      if (this.compiler.rcFile.isCommandsPath(filePath)) {
        this.compiler.manifest.generate()
      }

      this.compiler.httpServer.restart()
    })

    /**
     * New file added
     */
    watcher.on('add', async (filePath) => {
      const metaData = this.compiler.rcFile.getMetaData(filePath)
      if (!metaData.metaFile) {
        return
      }

      this.clearScreen()

      this.logger.create(filePath)
      await this.compiler.copyFiles([filePath], config.options.outDir!)

      if (metaData.reload) {
        this.compiler.httpServer.restart()
      }
    })

    /**
     * File changed
     */
    watcher.on('change', async (filePath) => {
      const metaData = this.compiler.rcFile.getMetaData(filePath)
      if (!metaData.metaFile) {
        return
      }

      this.clearScreen()

      if (metaData.rcFile) {
        this.logger.skip('in-process changes to .adonisrc.json file are ignored')
        await this.compiler.copyAdonisRcFile(config.options.outDir!)
      } else {
        this.logger.update(filePath)
        await this.compiler.copyFiles([filePath], config.options.outDir!)
      }

      if (metaData.reload) {
        this.compiler.httpServer.restart()
      }
    })

    /**
     * File removed
     */
    watcher.on('unlink', async (filePath) => {
      const metaData = this.compiler.rcFile.getMetaData(filePath)
      if (!metaData.metaFile) {
        return
      }

      this.clearScreen()

      if (metaData.rcFile) {
        this.logger.stop('cannot continue after deletion of .adonisrc.json file')
        watcher.chokidar.close()
        return
      }

      this.logger.delete(filePath)
      await remove(join(config.options.outDir!, filePath))
      if (metaData.reload) {
        this.compiler.httpServer.restart()
      }
    })

    /**
     * Start the watcher
     */
    watcher.watch(['.'], {
      ignored: config.raw.exclude,
      usePolling: poll,
    })
  }
}
