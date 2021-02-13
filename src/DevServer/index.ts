/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import getPort from 'get-port'
import { getWatcherHelpers } from '@adonisjs/require-ts'
import { logger as uiLogger, sticker } from '@poppinss/cliui'

import { Ts } from '../Ts'
import { RcFile } from '../RcFile'
import { Manifest } from '../Manifest'
import { EnvParser } from '../EnvParser'
import { HttpServer } from '../HttpServer'

import { ENV_FILES, SERVER_ENTRY_FILE } from '../../config/paths'

/**
 * Exposes the API to watch project for compilition changes.
 */
export class DevServer {
  private httpServer: HttpServer

  /**
   * HTTP server port
   */
  private serverPort?: number

  /**
   * HTTP server host
   */
  private serverHost?: string

  /**
   * A boolean to know if we are watching for filesystem
   */
  private watchingFileSystem: boolean = false

  /**
   * Watcher state
   */
  private watcherState: 'pending' | 'error' | 'ready' = 'pending'

  /**
   * Reference to the typescript compiler
   */
  private ts = new Ts(this.appRoot, this.logger)

  /**
   * Reference to the RCFile
   */
  private rcFile = new RcFile(this.appRoot)

  /**
   * Manifest instance to generate ace manifest file
   */
  private manifest = new Manifest(this.appRoot, this.logger)

  /**
   * Require-ts watch helpers
   */
  private watchHelpers = getWatcherHelpers(this.appRoot)

  constructor(
    private appRoot: string,
    private nodeArgs: string[] = [],
    private logger: typeof uiLogger = uiLogger
  ) {}

  /**
   * Kill current process
   */
  private kill() {
    this.logger.info('shutting down')
    process.exit()
  }

  /**
   * Create the http server
   */
  private async createHttpServer() {
    if (this.httpServer) {
      return
    }

    const envParser = new EnvParser()
    await envParser.parse(this.appRoot)

    const envOptions = envParser.asEnvObject(['PORT', 'TZ', 'HOST'])
    const HOST = process.env.HOST || envOptions.HOST || '0.0.0.0'
    let PORT = process.env.PORT || envOptions.PORT || '3333'

    /**
     * Obtains a random port by giving preference to the one defined inside
     * the `.env` file. This eases the process of running the application
     * without manually changing ports inside the `.env` file when
     * original port is in use.
     */
    if (!isNaN(Number(PORT))) {
      PORT = String(
        await getPort({
          port: [Number(PORT)],
          host: HOST,
        })
      )
    }

    this.httpServer = new HttpServer(SERVER_ENTRY_FILE, this.appRoot, this.nodeArgs, this.logger, {
      PORT,
      HOST,
      TZ: envOptions.TZ,
    })
  }

  /**
   * Clear stdout
   */
  private clearScreen() {
    process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1Bc')
  }

  /**
   * Renders box to notify about the server state
   */
  private renderSeverIsReady() {
    if (!this.serverHost || !this.serverPort) {
      return
    }

    if (this.watchingFileSystem && this.watcherState === 'pending') {
      return
    }

    sticker()
      .add(
        `Server address: ${this.logger.colors.cyan(
          `http://${this.serverHost === '0.0.0.0' ? '127.0.0.1' : this.serverHost}:${
            this.serverPort
          }`
        )}`
      )
      .add(
        `Watching filesystem for changes: ${this.logger.colors.cyan(
          this.watchingFileSystem ? 'YES' : 'NO'
        )}`
      )
      .render()
  }

  /**
   * Start the dev server. Use [[watch]] to also watch for file
   * changes
   */
  public async start() {
    /**
     * Log getting ready
     */
    this.logger.info('building project...')

    /**
     * Start the HTTP server right away
     */
    await this.createHttpServer()
    this.httpServer.start()

    /**
     * Notify that the http server has died
     */
    this.httpServer.on('exit', ({ code }) => {
      this.logger.warning(`Underlying HTTP server died with "${code} code"`)
    })

    /**
     * Notify that the http server is running
     */
    this.httpServer.on('ready', ({ port, host }) => {
      this.serverPort = port
      this.serverHost = host
      this.renderSeverIsReady()
    })
  }

  /**
   * Build and watch for file changes
   */
  public async watch(poll = false) {
    this.watchingFileSystem = true

    /**
     * Clear require-ts cache
     */
    this.watchHelpers.clear()

    /**
     * Start HTTP server
     */
    await this.start()

    /**
     * Parse config to find the files excluded inside
     * tsconfig file
     */
    const config = this.ts.parseConfig()
    if (!config) {
      this.logger.warning('Cannot start watcher because of errors in the config file')
      this.watcherState = 'error'
      this.renderSeverIsReady()
      return
    }

    /**
     * Stick file watcher
     */
    const watcher = this.ts.tsCompiler.watcher(config, 'raw')

    /**
     * Watcher is ready after first compile
     */
    watcher.on('watcher:ready', () => {
      this.logger.info('watching file system for changes')
      this.watcherState = 'ready'
      this.renderSeverIsReady()
    })

    /**
     * Source file removed
     */
    watcher.on('source:unlink', async ({ absPath, relativePath }) => {
      this.clearScreen()
      this.watchHelpers.clear(absPath)
      this.logger.action('delete').succeeded(relativePath)

      /**
       * Generate manifest when filePath is a commands path
       */
      if (this.rcFile.isCommandsPath(relativePath)) {
        this.manifest.generate()
      }

      this.httpServer.restart()
    })

    /**
     * Source file added
     */
    watcher.on('source:add', async ({ absPath, relativePath }) => {
      this.clearScreen()
      this.watchHelpers.clear(absPath)
      this.logger.action('add').succeeded(relativePath)

      /**
       * Generate manifest when filePath if file is in commands path
       */
      if (this.rcFile.isCommandsPath(relativePath)) {
        this.manifest.generate()
      }

      this.httpServer.restart()
    })

    /**
     * Source file changed
     */
    watcher.on('source:change', async ({ absPath, relativePath }) => {
      this.clearScreen()
      this.watchHelpers.clear(absPath)
      this.logger.action('update').succeeded(relativePath)

      /**
       * Generate manifest when filePath is a commands path
       */
      if (this.rcFile.isCommandsPath(relativePath)) {
        this.manifest.generate()
      }

      this.httpServer.restart()
    })

    /**
     * New file added
     */
    watcher.on('add', async ({ relativePath }) => {
      if (ENV_FILES.includes(relativePath)) {
        this.logger.action('create').succeeded(relativePath)
        this.httpServer.restart()
        return
      }

      const metaData = this.rcFile.getMetaData(relativePath)
      if (!metaData.metaFile) {
        return
      }

      this.clearScreen()

      this.logger.action('create').succeeded(relativePath)
      if (metaData.reload) {
        this.httpServer.restart()
      }
    })

    /**
     * File changed
     */
    watcher.on('change', async ({ relativePath }) => {
      if (ENV_FILES.includes(relativePath)) {
        this.logger.action('update').succeeded(relativePath)
        this.httpServer.restart()
        return
      }

      const metaData = this.rcFile.getMetaData(relativePath)
      if (!metaData.metaFile) {
        return
      }

      this.clearScreen()
      this.logger.action('update').succeeded(relativePath)

      if (metaData.reload || metaData.rcFile) {
        this.httpServer.restart()
      }
    })

    /**
     * File removed
     */
    watcher.on('unlink', async ({ relativePath }) => {
      if (ENV_FILES.includes(relativePath)) {
        this.logger.action('delete').succeeded(relativePath)
        this.httpServer.restart()
        return
      }

      const metaData = this.rcFile.getMetaData(relativePath)
      if (!metaData.metaFile) {
        return
      }

      this.clearScreen()

      if (metaData.rcFile) {
        this.logger.info('cannot continue after deletion of .adonisrc.json file')
        watcher.chokidar.close()
        this.kill()
        return
      }

      this.logger.action('delete').succeeded(relativePath)
      if (metaData.reload) {
        this.httpServer.restart()
      }
    })

    /**
     * Start the watcher
     */
    watcher.watch(['.'], {
      usePolling: poll,
    })

    /**
     * Kill when watcher recieves an error
     */
    watcher.chokidar.on('error', (error) => {
      this.logger.fatal(error)
      this.kill()
    })
  }
}
