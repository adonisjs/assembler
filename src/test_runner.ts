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
 * Exposes the API to run Japa tests and optionally watch for file
 * changes to re-run the tests.
 *
 * The watch mode functions as follows.
 *
 *  - If the changed file is a test file, then only tests for that file
 *    will be re-run.
 *  - Otherwise, all tests will re-run with respect to the initial
 *    filters applied when running the `node ace test` command.
 *
 */
export class TestRunner {
  #cwd: URL
  #logger = ui.logger
  #options: TestRunnerOptions

  /**
   * The script file to run as a child process
   */
  #scriptFile: string = 'bin/test.js'

  /**
   * Pico matcher function to check if the filepath is
   * part of the `metaFiles` glob patterns
   */
  #isMetaFile: picomatch.Matcher

  /**
   * Pico matcher function to check if the filepath is
   * part of a test file.
   */
  #isTestFile: picomatch.Matcher

  /**
   * Arguments to pass to the "bin/test.js" file.
   */
  #scriptArgs: string[]

  /**
   * Set of initial filters applied when running the test
   * command. In watch mode, we will append an additional
   * filter to run tests only for the file that has been
   * changed.
   */
  #initialFiltersArgs: string[]

  /**
   * In watch mode, after a file is changed, we wait for the current
   * set of tests to finish before triggering a re-run. Therefore,
   * we use this flag to know if we are already busy in running
   * tests and ignore file-changes.
   */
  #isBusy: boolean = false

  /**
   * External listeners that are invoked when child process
   * gets an error or closes
   */
  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  /**
   * Reference to the test script child process
   */
  #testScript?: ExecaChildProcess<string>

  /**
   * Reference to the watcher
   */
  #watcher?: ReturnType<Watcher['watch']>

  /**
   * Reference to the assets server
   */
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

    /**
     * Create a test file watch by collection all the globs
     * used by all the suites. However, if a suite filter
     * was used, then we only collect glob for the mentioned
     * suites.
     */
    this.#isTestFile = picomatch(
      this.#options.suites
        .filter((suite) => {
          if (this.#options.filters.suites) {
            return this.#options.filters.suites.includes(suite.name)
          }
          return true
        })
        .map((suite) => suite.files)
        .flat(1)
    )

    this.#scriptArgs = this.#convertOptionsToArgs().concat(this.#options.scriptArgs)
    this.#initialFiltersArgs = this.#convertFiltersToArgs(this.#options.filters)
  }

  /**
   * Convert test runner options to the CLI args
   */
  #convertOptionsToArgs() {
    const args: string[] = []

    if (this.#options.reporters) {
      args.push('--reporters')
      args.push(this.#options.reporters.join(','))
    }

    if (this.#options.timeout !== undefined) {
      args.push('--timeout')
      args.push(String(this.#options.timeout))
    }

    if (this.#options.failed) {
      args.push('--failed')
    }

    if (this.#options.retries !== undefined) {
      args.push('--retries')
      args.push(String(this.#options.retries))
    }

    return args
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

    if (filters.tests) {
      args.push('--tests')
      args.push(filters.tests.join(','))
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
  #runTests(
    port: string,
    mode: 'blocking' | 'nonblocking',
    filters?: TestRunnerOptions['filters']
  ) {
    this.#isBusy = true

    /**
     * If inline filters are defined, then we ignore the
     * initial filters
     */
    const scriptArgs = filters
      ? this.#convertFiltersToArgs(filters).concat(this.#scriptArgs)
      : this.#initialFiltersArgs.concat(this.#scriptArgs)

    this.#testScript = runNode(this.#cwd, {
      script: this.#scriptFile,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      scriptArgs,
    })

    this.#testScript
      .then((result) => {
        if (mode === 'nonblocking') {
          this.#onClose?.(result.exitCode)
          this.close()
        }
      })
      .catch((error) => {
        if (mode === 'nonblocking') {
          this.#onError?.(error)
          this.close()
        }
      })
      .finally(() => {
        this.#isBusy = false
      })
  }

  /**
   * Re-run tests with additional inline filters. Should be
   * executed in watch mode only.
   */
  #rerunTests(port: string, filters?: TestRunnerOptions['filters']) {
    if (this.#testScript) {
      this.#testScript.removeAllListeners()
      this.#testScript.kill('SIGTERM')
    }

    this.#runTests(port, 'blocking', filters)
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
   * Handles a non TypeScript file change
   */
  #handleFileChange(action: string, port: string, relativePath: string) {
    if (this.#isBusy) {
      return
    }

    if (isDotEnvFile(relativePath) || this.#isMetaFile(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
      this.#rerunTests(port)
    }
  }

  /**
   * Handles TypeScript source file change
   */
  #handleSourceFileChange(action: string, port: string, relativePath: string) {
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
      this.#rerunTests(port, {
        ...this.#options.filters,
        files: [relativePath],
      })
      return
    }

    this.#rerunTests(port)
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
    if (this.#testScript) {
      this.#testScript.removeAllListeners()
      this.#testScript.kill('SIGTERM')
    }
  }

  /**
   * Runs tests
   */
  async run() {
    const port = String(await getPort(this.#cwd))

    this.#clearScreen()
    this.#startAssetsServer()

    this.#logger.info('booting application to run tests...')
    this.#runTests(port, 'nonblocking')
  }

  /**
   * Run tests in watch mode
   */
  async runAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const port = String(await getPort(this.#cwd))

    this.#clearScreen()
    this.#startAssetsServer()

    this.#logger.info('booting application to run tests...')
    this.#runTests(port, 'blocking')

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
