/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import getRandomPort from 'get-port'
import { join } from 'node:path/posix'
import { cliui } from '@poppinss/cliui'
import type Hooks from '@poppinss/hooks'
import { fileURLToPath } from 'node:url'
import { type FSWatcher } from 'chokidar'
import { type ResultPromise } from 'execa'
import string from '@poppinss/utils/string'
import { RuntimeException } from '@poppinss/utils/exception'

import debug from './debug.ts'
import { FileSystem } from './file_system.ts'
import type { TestRunnerOptions } from './types/common.ts'
import { IndexGenerator } from './index_generator/main.ts'
import { getPort, loadHooks, readTsConfig, runNode, throttle, watch } from './utils.ts'
import {
  type HookParams,
  type CommonHooks,
  type WatcherHooks,
  type TestRunnerHooks,
} from './types/hooks.ts'

/**
 * Exposes the API to run Japa tests and optionally watch for file
 * changes to re-run the tests.
 *
 * The TestRunner provides intelligent test execution with watch mode capabilities.
 * When files change, it can selectively run specific tests or the entire suite
 * based on what changed.
 *
 * The watch mode functions as follows:
 *  - If the changed file is a test file, then only tests for that file
 *    will be re-run.
 *  - Otherwise, all tests will re-run with respect to the initial
 *    filters applied when running the `node ace test` command.
 *
 * @example
 * const testRunner = new TestRunner(cwd, { suites: [], hooks: [] })
 * await testRunner.run()
 *
 * @example
 * // Run tests in watch mode
 * const testRunner = new TestRunner(cwd, { suites: [], hooks: [] })
 * await testRunner.runAndWatch(ts, { poll: false })
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
   * The stickyHmrPort is set by the start and the startAndWatch methods
   * and we will continue to use that port during restart
   */
  #stickyHmrPort!: string

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
      [K in keyof CommonHooks]: [HookParams<K>, HookParams<K>]
    } & {
      [K in keyof TestRunnerHooks]: [HookParams<K>, HookParams<K>]
    } & {
      [K in keyof WatcherHooks]: [HookParams<K>, HookParams<K>]
    }
  >

  /**
   * Index generator for managing auto-generated index files
   */
  #indexGenerator!: IndexGenerator

  /**
   * CLI UI instance for displaying colorful messages and progress information
   */
  ui = cliui()

  /**
   * Re-runs the test child process and throttle concurrent calls to
   * ensure we do not end up with a long loop of restarts
   */
  #reRunTests = throttle(async (filters?: TestRunnerOptions['filters']) => {
    if (this.#testsProcess) {
      this.#testsProcess.removeAllListeners()
      this.#testsProcess.kill('SIGKILL')
    }
    await this.#runTests(this.#stickyPort, this.#stickyHmrPort, filters)
  }, 'reRunTests')

  /**
   * The script file to run as a child process
   */
  scriptFile: string = 'bin/test.ts'

  /**
   * The current working directory URL
   */
  cwd: URL

  /**
   * The current working directory path as a string
   */
  cwdPath: string

  /**
   * Test runner configuration options including filters, reporters, and hooks
   */
  options: TestRunnerOptions

  /**
   * Create a new TestRunner instance
   *
   * @param cwd - The current working directory URL
   * @param options - Test runner configuration options
   */
  constructor(cwd: URL, options: TestRunnerOptions) {
    this.cwd = cwd
    this.options = options
    this.cwdPath = string.toUnixSlash(fileURLToPath(this.cwd))
  }

  /**
   * Convert test runner options to the CLI args
   *
   * Transforms the test runner configuration options into command-line
   * arguments that can be passed to the test script.
   *
   * @returns Array of command-line arguments
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
   * Converts all known filters to CLI args
   *
   * Transforms test filters (suites, files, groups, tags, tests) into
   * command-line arguments for the test script.
   *
   * @param filters - The test filters to convert
   * @returns Array of command-line arguments representing the filters
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
   *
   * Clears the terminal screen if the clearScreen option is enabled
   * in the test runner configuration.
   */
  #clearScreen() {
    if (this.options.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Runs tests as a child process
   *
   * Creates a Node.js child process to execute the test script with
   * appropriate command-line arguments and environment variables.
   * Handles process lifecycle and hook execution.
   *
   * @param port - The port number to set in the environment
   * @param filters - Optional test filters to apply for this run
   */
  async #runTests(port: string, hmrPort: string, filters?: TestRunnerOptions['filters']) {
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
      const mergedFilters = { ...this.options.filters, ...filters }
      const scriptArgs = [
        ...this.#convertOptionsToArgs(),
        ...this.options.scriptArgs,
        ...this.#convertFiltersToArgs(mergedFilters),
      ]

      this.#testsProcess = runNode(this.cwd, {
        script: this.scriptFile,
        reject: true,
        env: { PORT: port, VITE_HMR_PORT: hmrPort, ...this.options.env },
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
   * Handles file change event during watch mode
   *
   * Determines whether to run specific tests or all tests based on
   * the type of file that changed. Test files trigger selective runs,
   * while other files trigger full test suite runs.
   *
   * @param filePath - The path of the changed file
   * @param action - The type of change (add, update, delete)
   */
  #handleFileChange(relativePath: string, absolutePath: string, action: string) {
    const file = this.#fileSystem.inspect(absolutePath, relativePath)
    if (!file) {
      return
    }

    this.#clearScreen()
    this.ui.logger.log(`${this.ui.colors.green(action)} ${relativePath}`)

    if (file.fileType === 'test') {
      this.#reRunTests({ files: [relativePath] })
    } else {
      this.#reRunTests()
    }
  }

  /**
   * Re-generates the index when a file is changed, but only in HMR
   * mode
   */
  #regenerateIndex(filePath: string, action: 'add' | 'delete') {
    if (action === 'add') {
      return this.#indexGenerator.addFile(filePath)
    }
    return this.#indexGenerator.removeFile(filePath)
  }

  /**
   * Registers inline hooks for file changes and test re-runs
   *
   * Sets up event handlers that respond to file system changes by
   * triggering appropriate test runs based on the changed files.
   */
  #registerServerRestartHooks() {
    this.#hooks.add('fileAdded', (relativePath, absolutePath) => {
      this.#regenerateIndex(absolutePath, 'add')
      this.#handleFileChange(relativePath, absolutePath, 'add')
    })
    this.#hooks.add('fileChanged', (relativePath, absolutePath) => {
      this.#regenerateIndex(absolutePath, 'add')
      this.#handleFileChange(relativePath, absolutePath, 'update')
    })
    this.#hooks.add('fileRemoved', (relativePath, absolutePath) => {
      this.#regenerateIndex(absolutePath, 'delete')
      this.#handleFileChange(relativePath, absolutePath, 'delete')
    })
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
   *
   * Cleans up file system watchers and terminates any running test
   * processes to ensure graceful shutdown.
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
   *
   * Executes the test suite a single time and exits. This is the
   * equivalent of running tests in CI/CD environments.
   */
  async run() {
    this.#stickyPort = String(await getPort(this.cwd))
    this.#stickyHmrPort = String(await getRandomPort({ port: 24678 }))
    this.#indexGenerator = new IndexGenerator(this.cwdPath, this.ui.logger)

    this.#clearScreen()

    this.ui.logger.info('loading hooks...')
    this.#hooks = await loadHooks(this.options.hooks, ['init', 'testsStarting', 'testsFinished'])

    /**
     * Run init hooks and clear them as they won't be executed
     * ever again
     */
    await this.#hooks.runner('init').run(this, this.#hooks, this.#indexGenerator)
    this.#hooks.clear('init')

    this.ui.logger.info('generating indexes...')
    await this.#indexGenerator.generate()

    this.ui.logger.info('booting application to run tests...')
    await this.#runTests(this.#stickyPort, this.#stickyHmrPort)
  }

  /**
   * Run tests in watch mode and re-run them when files change
   *
   * Starts the test runner in watch mode, monitoring the file system
   * for changes and automatically re-running tests when relevant files
   * are modified. Uses intelligent filtering to run only affected tests
   * when possible.
   *
   * @param ts - TypeScript module reference for parsing configuration
   * @param options - Watch options including polling mode for file system monitoring
   */
  async runAndWatch(options?: { poll: boolean }) {
    const tsConfig = readTsConfig(this.cwdPath)
    if (!tsConfig) {
      this.#onError?.(new RuntimeException('Unable to parse tsconfig file'))
      return
    }

    this.#stickyPort = String(await getPort(this.cwd))
    this.#stickyHmrPort = String(getRandomPort({ port: 24678 }))
    this.#indexGenerator = new IndexGenerator(this.cwdPath, this.ui.logger)

    this.#fileSystem = new FileSystem(this.cwdPath, tsConfig, {
      ...this.options,
      suites: this.options.suites?.filter((suite) => {
        if (this.options.filters.suites) {
          return this.options.filters.suites.includes(suite.name)
        }
        return true
      }),
    })

    this.#clearScreen()
    this.ui.logger.info('loading hooks...')
    this.#hooks = await loadHooks(this.options.hooks, [
      'init',
      'testsStarting',
      'testsFinished',
      'fileAdded',
      'fileChanged',
      'fileRemoved',
    ])

    this.#registerServerRestartHooks()

    /**
     * Run init hooks and clear them as they won't be executed
     * ever again
     */
    await this.#hooks.runner('init').run(this, this.#hooks, this.#indexGenerator)
    this.#hooks.clear('init')

    this.ui.logger.info('generating indexes...')
    await this.#indexGenerator.generate()

    this.ui.logger.info('booting application to run tests...')
    await this.#runTests(this.#stickyPort, this.#stickyHmrPort)

    /**
     * Create watcher
     */
    this.#watcher = watch({
      usePolling: options?.poll ?? false,
      cwd: this.cwdPath,
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

    this.#watcher.on('add', (filePath) => {
      const relativePath = string.toUnixSlash(filePath)
      const absolutePath = join(this.cwdPath, filePath)
      this.#hooks.runner('fileAdded').run(relativePath, absolutePath, this)
    })
    this.#watcher.on('change', (filePath) => {
      const relativePath = string.toUnixSlash(filePath)
      const absolutePath = join(this.cwdPath, filePath)
      this.#hooks.runner('fileChanged').run(
        relativePath,
        absolutePath,
        {
          source: 'watcher',
          fullReload: true,
          hotReloaded: false,
        },
        this
      )
    })
    this.#watcher.on('unlink', (filePath) => {
      const relativePath = string.toUnixSlash(filePath)
      const absolutePath = join(this.cwdPath, filePath)
      this.#hooks.runner('fileRemoved').run(relativePath, absolutePath, this)
    })
  }
}
