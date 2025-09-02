/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type tsStatic from 'typescript'
import { cliui } from '@poppinss/cliui'
import type Hooks from '@poppinss/hooks'
import { fileURLToPath } from 'node:url'
import { type FSWatcher } from 'chokidar'
import { type ResultPromise } from 'execa'
import string from '@poppinss/utils/string'
import { RuntimeException } from '@poppinss/utils/exception'
import { type UnWrapLazyImport } from '@poppinss/utils/types'

import debug from './debug.ts'
import { FileSystem } from './file_system.ts'
import type { TestRunnerOptions } from './types/common.ts'
import { type WatcherHooks, type TestRunnerHooks } from './types/hooks.ts'
import { getPort, loadHooks, parseConfig, runNode, throttle, watch } from './utils.ts'

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
 * @example
 * const testRunner = new TestRunner(cwd, { suites: [], hooks: [] })
 * await testRunner.run()
 */
export class TestRunner {
  /**
   * External listeners that are invoked when child process
   * gets an error or closes
   */
  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  /**
   * The stickyPort is set by the startAndWatch method and we will
   * continue to use this port during re-runs
   */
  #stickyPort!: string

  /**
   * Reference to chokidar watcher
   */
  #watcher?: FSWatcher

  /**
   * Reference to the test script child process
   */
  #testsProcess?: ResultPromise

  /**
   * Filesystem is used to decide which files to watch or entertain in watch
   * mode
   */
  #fileSystem!: FileSystem

  /**
   * Hooks to execute custom actions during the tests runner lifecycle
   */
  #hooks!: Hooks<
    {
      [K in keyof TestRunnerHooks]: [
        Parameters<UnWrapLazyImport<TestRunnerHooks[K][number]>>,
        Parameters<UnWrapLazyImport<TestRunnerHooks[K][number]>>,
      ]
    } & {
      [K in keyof WatcherHooks]: [
        Parameters<UnWrapLazyImport<WatcherHooks[K][number]>>,
        Parameters<UnWrapLazyImport<WatcherHooks[K][number]>>,
      ]
    }
  >

  /**
   * Re-runs the test child process and throttle concurrent calls to
   * ensure we do not end up with a long loop of restarts
   */
  #reRunTests = throttle(async (filters?: TestRunnerOptions['filters']) => {
    if (this.#testsProcess) {
      this.#testsProcess.removeAllListeners()
      this.#testsProcess.kill('SIGKILL')
    }
    await this.#runTests(this.#stickyPort, filters)
  }, 'reRunTests')

  /**
   * CLI UI instance to log colorful messages and progress information
   */
  ui = cliui()

  /**
   * The script file to run as a child process
   */
  scriptFile: string = 'bin/test.ts'

  /**
   * Create a new TestRunner instance
   *
   * @param cwd - The current working directory URL
   * @param options - Test runner configuration options
   */
  constructor(
    public cwd: URL,
    public options: TestRunnerOptions
  ) {}

  /**
   * Convert test runner options to the CLI args
   */
  #convertOptionsToArgs() {
    const args: string[] = []

    if (this.options.reporters) {
      args.push('--reporters')
      args.push(this.options.reporters.join(','))
    }

    if (this.options.timeout !== undefined) {
      args.push('--timeout')
      args.push(String(this.options.timeout))
    }

    if (this.options.failed) {
      args.push('--failed')
    }

    if (this.options.retries !== undefined) {
      args.push('--retries')
      args.push(String(this.options.retries))
    }

    return args
  }

  /**
   * Converts all known filters to CLI args.
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
    if (this.options.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Runs tests
   */
  async #runTests(port: string, filters?: TestRunnerOptions['filters']) {
    /**
     * Execute the registered before creating the child process. This will allow
     * hooks to modify the options before they are used.
     */
    await this.#hooks.runner('testsStarting').run(this)
    debug('running tests using "%s" file, options %O', this.scriptFile, this.options)

    return new Promise<void>(async (resolve) => {
      /**
       * If inline filters are defined, then we ignore the
       * initial filters
       */
      const scriptArgs = this.#convertOptionsToArgs()
        .concat(this.options.scriptArgs)
        .concat(
          this.#convertFiltersToArgs({
            ...this.options.filters,
            ...filters,
          })
        )

      this.#testsProcess = runNode(this.cwd, {
        script: this.scriptFile,
        reject: true,
        env: { PORT: port, ...this.options.env },
        nodeArgs: this.options.nodeArgs,
        scriptArgs,
      })

      this.#testsProcess
        .then((result) => {
          this.#hooks
            .runner('testsFinished')
            .run(this)
            .catch((error) => {
              this.ui.logger.error('One of the "testsFinished" hooks failed')
              this.ui.logger.fatal(error)
            })
            .finally(() => {
              if (!this.#watcher) {
                this.#onClose?.(result.exitCode!)
                this.close()
              }
            })
        })
        .catch((error) => {
          if (!this.#watcher) {
            this.#onError?.(error)
            this.close()
          } else {
            this.ui.logger.info('Underlying HTTP server died. Still watching for changes')
          }
        })
        .finally(() => resolve())
    })
  }

  /**
   * Handles file change event
   */
  #handleFileChange(filePath: string, action: string) {
    const file = this.#fileSystem.inspect(filePath)
    if (!file) {
      return
    }

    this.#clearScreen()
    this.ui.logger.log(`${this.ui.colors.green(action)} ${filePath}`)

    if (file.fileType === 'test') {
      this.#reRunTests({ files: [filePath] })
    } else {
      this.#reRunTests()
    }
  }

  /**
   * Registers inline hooks for the file changes and restarts the
   * HTTP server when a file gets changed.
   */
  #registerServerRestartHooks() {
    this.#hooks.add('fileAdded', (filePath) => this.#handleFileChange(filePath, 'add'))
    this.#hooks.add('fileChanged', (filePath) => this.#handleFileChange(filePath, 'update'))
    this.#hooks.add('fileRemoved', (filePath) => this.#handleFileChange(filePath, 'delete'))
  }

  /**
   * Add listener to get notified when test runner is closed
   *
   * @param callback - Function to call when test runner closes
   * @returns This TestRunner instance for method chaining
   */
  onClose(callback: (exitCode: number) => any): this {
    this.#onClose = callback
    return this
  }

  /**
   * Add listener to get notified when test runner encounters an error
   *
   * @param callback - Function to call when test runner encounters an error
   * @returns This TestRunner instance for method chaining
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
    if (this.#testsProcess) {
      this.#testsProcess.removeAllListeners()
      this.#testsProcess.kill('SIGKILL')
    }
  }

  /**
   * Runs tests once without watching for file changes
   */
  async run() {
    this.#stickyPort = String(await getPort(this.cwd))
    this.#hooks = await loadHooks(this.options.hooks, [
      'testsStarting',
      'testsFinished',
      'fileAdded',
      'fileChanged',
      'fileRemoved',
    ])

    this.#clearScreen()
    this.ui.logger.info('booting application to run tests...')
    await this.#runTests(this.#stickyPort)
  }

  /**
   * Run tests in watch mode and re-run them when files change
   *
   * @param ts - TypeScript module reference
   * @param options - Watch options including polling mode
   */
  async runAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const tsConfig = parseConfig(this.cwd, ts)
    if (!tsConfig) {
      this.#onError?.(new RuntimeException('Unable to parse tsconfig file'))
      return
    }

    this.#stickyPort = String(await getPort(this.cwd))
    this.#fileSystem = new FileSystem(this.cwd, tsConfig, {
      ...this.options,
      suites: this.options.suites?.filter((suite) => {
        if (this.options.filters.suites) {
          return this.options.filters.suites.includes(suite.name)
        }
        return true
      }),
    })
    this.#hooks = await loadHooks(this.options.hooks, [
      'testsStarting',
      'testsFinished',
      'fileAdded',
      'fileChanged',
      'fileRemoved',
    ])
    this.#registerServerRestartHooks()

    this.#clearScreen()
    this.ui.logger.info('booting application to run tests...')
    await this.#runTests(this.#stickyPort)

    /**
     * Create watcher
     */
    this.#watcher = watch({
      usePolling: options?.poll ?? false,
      cwd: fileURLToPath(this.cwd),
      ignoreInitial: true,
      ignored: (file, stats) => {
        if (!stats) {
          return false
        }
        if (stats.isFile()) {
          return !this.#fileSystem.shouldWatchFile(file)
        }
        return !this.#fileSystem.shouldWatchDirectory(file)
      },
    })

    /**
     * Notify the watcher is ready
     */
    this.#watcher.on('ready', () => {
      this.ui.logger.info('watching file system for changes...')
    })

    /**
     * Cleanup when watcher dies
     */
    this.#watcher.on('error', (error: any) => {
      this.ui.logger.warning('file system watcher failure')
      this.ui.logger.fatal(error as any)

      this.#onError?.(error)
      this.#watcher?.close()
    })

    this.#watcher.on('add', (filePath) =>
      this.#hooks.runner('fileAdded').run(string.toUnixSlash(filePath), this)
    )
    this.#watcher.on('change', (filePath) =>
      this.#hooks.runner('fileChanged').run(
        string.toUnixSlash(filePath),
        {
          source: 'watcher',
          fullReload: true,
          hotReloaded: false,
        },
        this
      )
    )
    this.#watcher.on('unlink', (filePath) =>
      this.#hooks.runner('fileRemoved').run(string.toUnixSlash(filePath), this)
    )
  }
}
