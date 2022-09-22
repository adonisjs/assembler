/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { extname } from 'path'
import picomatch from 'picomatch'
import { logger as uiLogger } from '@poppinss/cliui'
import { getWatcherHelpers } from '@adonisjs/require-ts'

import { Ts } from '../Ts'
import { RcFile } from '../RcFile'
import { Manifest } from '../Manifest'
import { TestProcess } from './process'
import { JapaFlags } from '../Contracts'

import { ENV_FILES, TESTS_ENTRY_FILE } from '../../config/paths'
import { EnvParser } from '../EnvParser'
import getPort from 'get-port'

/**
 * Exposes the API to watch project for compilition changes and
 * run/re-run tests
 */
export class TestsServer {
  /**
   * A boolean to know if we are watching for filesystem
   */
  private watchingFileSystem: boolean = false

  /**
   * Boolean to hold the current state of tests. This is avoid
   * re-running the tests when one run is in progress
   */
  private busy = false

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

  /**
   * A method to know if the file is part of the selected suites
   * or not
   */
  private isTestSuiteFile: (filePath: string) => boolean = picomatch(
    this.getFilesForSelectedSuites()
  )

  /**
   * Find if the test file part of the applied file filters
   */
  private isTestFile = (filePath: string): boolean => {
    if (!this.filters['--files']) {
      return true
    }

    const fileName = filePath.replace(extname(filePath), '')
    return !!this.filters['--files'].find((filter) => {
      if (filePath.endsWith(filter)) {
        return true
      }

      return fileName.endsWith(filter) || fileName.endsWith(`${filter}.spec`)
    })
  }

  constructor(
    private appRoot: string,
    private filters: JapaFlags,
    private nodeArgs: string[] = [],
    private logger: typeof uiLogger = uiLogger
  ) {}

  /**
   * Clear terminal screen
   */
  private clearScreen() {
    process.stdout.write('\u001Bc')
  }

  /**
   * Returns the glob paths for test suites. Returns all if no
   * filter is applied. Otherwise only the filtered suites
   * are picked.
   */
  private getFilesForSelectedSuites() {
    return this.rcFile.application.rcFile.tests.suites.reduce((result, suite) => {
      if (!suite.files) {
        return result
      }

      if (!this.filters['--suites'] || this.filters['--suites'].includes(suite.name)) {
        result = result.concat(suite.files)
      }

      return result
    }, [] as string[])
  }

  /**
   * Kill current process
   */
  private kill() {
    process.exit()
  }

  /**
   * Returns the HOST and the PORT environment variables
   * for the HTTP server
   */
  private async getEnvironmentVariables() {
    const envParser = new EnvParser('.env.test')
    await envParser.parse(this.appRoot)

    const envOptions = envParser.asEnvObject(['PORT', 'TZ', 'HOST'])
    const HOST = process.env.HOST || envOptions.HOST || '0.0.0.0'
    let PORT = Number(process.env.PORT || envOptions.PORT)

    /**
     * Use the port defined inside ".env.test" file or use
     * a random port
     */
    PORT = await getPort({
      port: !isNaN(PORT) ? [PORT] : [],
      host: HOST,
    })

    return { HOST, PORT: String(PORT) }
  }

  /**
   * Run tests. Use [[watch]] to also watch for file
   * changes
   */
  public async run(filePath?: string) {
    if (this.busy) {
      return
    }

    this.clearScreen()
    const filters = { ...this.filters }

    /**
     * Overwrite files filter when a specific file path
     * is mentioned
     */
    if (filePath) {
      filters['--files'] = [filePath.replace(/\\/g, '/')]
    }

    this.busy = true
    const { hasErrors } = await new TestProcess(
      TESTS_ENTRY_FILE,
      this.appRoot,
      filters,
      this.nodeArgs,
      this.logger,
      await this.getEnvironmentVariables()
    ).run()

    this.busy = false
    if (!this.watchingFileSystem) {
      if (hasErrors) {
        process.exitCode = 1
      }
      this.kill()
    }
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
     * Run tests
     */
    await this.run()

    /**
     * Parse config to find the files excluded inside
     * tsconfig file
     */
    const config = this.ts.parseConfig()
    if (!config) {
      this.logger.warning('Cannot start watcher because of errors in the tsconfig file')
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
    })

    /**
     * Source file removed
     */
    watcher.on('source:unlink', async ({ absPath, relativePath }) => {
      this.watchHelpers.clear(absPath)

      if (this.busy) {
        return
      }

      this.logger.action('delete').succeeded(relativePath)

      /**
       * Generate manifest when filePath is a commands path
       */
      if (this.rcFile.isCommandsPath(relativePath)) {
        this.manifest.generate()
      }

      /**
       * Run all tests when any of the source, except the
       * test file changes
       */
      if (!this.rcFile.isTestsFile(relativePath)) {
        await this.run()
      }
    })

    /**
     * Source file added
     */
    watcher.on('source:add', async ({ absPath, relativePath }) => {
      this.watchHelpers.clear(absPath)

      if (this.busy) {
        return
      }

      this.logger.action('add').succeeded(relativePath)

      /**
       * Run all tests when any of the source, except the
       * test file changes
       */
      if (!this.rcFile.isTestsFile(relativePath)) {
        await this.run()
        return
      }

      /**
       * Run only the changed file if it part of the test
       * suites (respecting filters)
       */
      if (this.isTestSuiteFile(relativePath) && this.isTestFile(relativePath)) {
        await this.run(relativePath)
      }
    })

    /**
     * Source file changed
     */
    watcher.on('source:change', async ({ absPath, relativePath }) => {
      this.watchHelpers.clear(absPath)

      if (this.busy) {
        return
      }

      this.logger.action('update').succeeded(relativePath)

      /**
       * Generate manifest when filePath is a commands path
       */
      if (this.rcFile.isCommandsPath(relativePath)) {
        this.manifest.generate()
      }

      /**
       * Run all tests when any of the source, except the
       * test file changes
       */
      if (!this.rcFile.isTestsFile(relativePath)) {
        await this.run()
        return
      }

      /**
       * Run only the changed file if it part of the test
       * suites (respecting filters)
       */
      if (this.isTestSuiteFile(relativePath) && this.isTestFile(relativePath)) {
        await this.run(relativePath)
      }
    })

    /**
     * New file added
     */
    watcher.on('add', async ({ relativePath }) => {
      if (this.busy) {
        return
      }

      if (ENV_FILES.includes(relativePath)) {
        this.logger.action('create').succeeded(relativePath)
        await this.run()
        return
      }

      const metaData = this.rcFile.getMetaData(relativePath)
      if (!metaData.metaFile) {
        return
      }

      this.logger.action('create').succeeded(relativePath)
      await this.run()
    })

    /**
     * File changed
     */
    watcher.on('change', async ({ relativePath }) => {
      if (this.busy) {
        return
      }

      if (ENV_FILES.includes(relativePath)) {
        this.logger.action('update').succeeded(relativePath)
        await this.run()
        return
      }

      const metaData = this.rcFile.getMetaData(relativePath)
      if (!metaData.metaFile) {
        return
      }

      this.logger.action('update').succeeded(relativePath)
      await this.run()
    })

    /**
     * File removed
     */
    watcher.on('unlink', async ({ relativePath }) => {
      if (this.busy) {
        return
      }

      if (ENV_FILES.includes(relativePath)) {
        this.logger.action('delete').succeeded(relativePath)
        await this.run()
        return
      }

      const metaData = this.rcFile.getMetaData(relativePath)
      if (!metaData.metaFile) {
        return
      }

      if (metaData.rcFile) {
        this.logger.info('cannot continue after deletion of .adonisrc.json file')
        watcher.chokidar.close()
        this.kill()
        return
      }

      this.logger.action('delete').succeeded(relativePath)
      await this.run()
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
