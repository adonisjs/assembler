/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import picomatch from 'picomatch'
import type tsStatic from 'typescript'
import { type ExecaChildProcess } from 'execa'
import { cliui, type Logger } from '@poppinss/cliui'
import type { Watcher } from '@poppinss/chokidar-ts'

import type { TestRunnerOptions } from './types.js'
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
 * - Assigns a random PORT, when PORT inside .env file is in use
 * - Uses tsconfig.json file to collect a list of files to watch.
 * - Uses metaFiles from .adonisrc.json file to collect a list of files to watch.
 * - Restart HTTP server on every file change.
 */
export class TestRunner {
  #cwd: URL
  #logger = ui.logger
  #options: TestRunnerOptions
  #scriptFile: string = 'bin/test.js'
  #isMetaFile: picomatch.Matcher
  #isTestFile: picomatch.Matcher

  /**
   * In watch mode, after a file is changed, we wait for the current
   * set of tests to finish before triggering a re-run. Therefore,
   * we use this flag to know if we are already busy in running
   * tests and ignore file-changes.
   */
  #isBusy: boolean = false

  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  #testScript?: ExecaChildProcess<string>
  #watcher?: ReturnType<Watcher['watch']>
  #assetsServer?: AssetsDevServer

  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors()
  }

  constructor(cwd: URL, options: TestRunnerOptions) {
    this.#cwd = cwd
    this.#options = options
    this.#isMetaFile = picomatch((this.#options.metaFiles || []).map(({ pattern }) => pattern))
    this.#isTestFile = picomatch(
      this.#options.suites
        .filter((suite) => {
          if (this.#options.filters.suites) {
            this.#options.filters.suites.includes(suite.name)
          }

          return true
        })
        .map((suite) => suite.files)
        .flat(1)
    )
  }

  /**
   * Converts all known filters to CLI args.
   *
   * The following code snippet may seem like repetitive code. But, it
   * is done intentionally to have visibility around how each filter
   * is converted to an arg.
   */
  #convertFiltersToArgs(filters: TestRunnerOptions['filters']): string[] {
    const args: string[] = []

    if (filters.suites) {
      args.push(...filters.suites)
    }

    if (filters.files) {
      args.push('--files')
      args.push(filters.files.join(','))
    }

    if (filters.groups) {
      args.push('--groups')
      args.push(filters.groups.join(','))
    }

    if (filters.tags) {
      args.push('--tags')
      args.push(filters.tags.join(','))
    }

    if (filters.ignoreTags) {
      args.push('--ignore-tags')
      args.push(filters.ignoreTags.join(','))
    }

    if (filters.tests) {
      args.push('--ignore-tests')
      args.push(filters.tests.join(','))
    }

    if (filters.match) {
      args.push('--match')
      args.push(filters.match.join(','))
    }

    return args
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
   * Runs tests
   */
  #runTests(port: string, filtersArgs: string[], mode: 'blocking' | 'nonblocking') {
    this.#isBusy = true

    this.#testScript = runNode(this.#cwd, {
      script: this.#scriptFile,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      scriptArgs: filtersArgs.concat(this.#options.scriptArgs),
    })

    this.#testScript
      .then((result) => {
        if (mode === 'nonblocking') {
          this.#onClose?.(result.exitCode)
          this.#watcher?.close()
          this.#assetsServer?.stop()
        }
      })
      .catch((error) => {
        this.#logger.warning(`unable to run test script "${this.#scriptFile}"`)
        this.#logger.fatal(error)
        this.#onError?.(error)
        this.#watcher?.close()
        this.#assetsServer?.stop()
      })
      .finally(() => {
        this.#isBusy = false
      })
  }

  /**
   * Starts the assets server
   */
  #startAssetsServer() {
    this.#assetsServer = new AssetsDevServer(this.#cwd, this.#options.assets)
    this.#assetsServer.start()
  }

  /**
   * Handles a non TypeScript file change
   */
  #handleFileChange(action: string, port: string, filters: string[], relativePath: string) {
    if (this.#isBusy) {
      return
    }

    if (isDotEnvFile(relativePath) || this.#isMetaFile(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
      this.#runTests(port, filters, 'blocking')
    }
  }

  /**
   * Handles TypeScript source file change
   */
  #handleSourceFileChange(action: string, port: string, filters: string[], relativePath: string) {
    if (this.#isBusy) {
      return
    }

    this.#clearScreen()
    this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)

    /**
     * If changed file is a test file after considering the initial filters,
     * then only run that file
     */
    if (this.#isTestFile(relativePath)) {
      this.#runTests(
        port,
        this.#convertFiltersToArgs({
          ...this.#options.filters,
          files: [relativePath.replace(/\\/g, '/')],
        }),
        'blocking'
      )
      return
    }

    this.#runTests(port, filters, 'blocking')
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
   * Runs tests
   */
  async run() {
    const port = String(await getPort(this.#cwd))
    const initialFilters = this.#convertFiltersToArgs(this.#options.filters)

    this.#clearScreen()
    this.#startAssetsServer()

    this.#logger.info('booting application to run tests...')
    this.#runTests(port, initialFilters, 'nonblocking')
  }

  /**
   * Run tests in watch mode
   */
  async runAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const port = String(await getPort(this.#cwd))
    const initialFilters = this.#convertFiltersToArgs(this.#options.filters)

    this.#clearScreen()
    this.#startAssetsServer()

    this.#logger.info('booting application to run tests...')
    this.#runTests(port, initialFilters, 'blocking')

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
      this.#handleSourceFileChange('add', port, initialFilters, relativePath)
    )
    output.watcher.on('source:change', ({ relativePath }) =>
      this.#handleSourceFileChange('update', port, initialFilters, relativePath)
    )
    output.watcher.on('source:unlink', ({ relativePath }) =>
      this.#handleSourceFileChange('delete', port, initialFilters, relativePath)
    )

    /**
     * Changes in non-TypeScript source files
     */
    output.watcher.on('add', ({ relativePath }) =>
      this.#handleFileChange('add', port, initialFilters, relativePath)
    )
    output.watcher.on('change', ({ relativePath }) =>
      this.#handleFileChange('update', port, initialFilters, relativePath)
    )
    output.watcher.on('unlink', ({ relativePath }) =>
      this.#handleFileChange('delete', port, initialFilters, relativePath)
    )
  }
}
