/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import { JapaFlags } from '../src/Contracts'

/**
 * Run tests
 */
export default class Test extends BaseCommand {
  public static commandName = 'test'
  public static description = 'Run AdonisJS tests'
  public static settings = {
    stayAlive: true,
  }

  /**
   * Allows watching for file changes
   */
  @flags.boolean({
    description: 'Watch for file changes and re-run tests on file change',
    alias: 'w',
  })
  public watch: boolean

  /**
   * Detect changes by polling files
   */
  @flags.boolean({
    description: 'Detect file changes by polling files instead of listening to filesystem events',
    alias: 'p',
  })
  public poll: boolean

  /**
   * Arguments to pass to the `node` binary
   */
  @flags.array({ description: 'CLI options to pass to the node command line' })
  public nodeArgs: string[] = []

  @flags.array({ description: 'Run tests for only specified tags' })
  public tags: string[]

  @flags.array({ description: 'Run all the tests except the tests using specified tags' })
  public ignoreTags: string[]

  @flags.number({ description: 'Define timeout for tests' })
  public timeout: number

  @flags.array({ description: 'Run tests for only the specified suites' })
  public suites: string[]

  @flags.array({ description: 'Run tests for only the specified groups' })
  public groups: string[]

  @flags.array({ description: 'Run tests with the specified titles' })
  public tests: string[]

  @flags.boolean({ description: 'Force exit the tests runner process' })
  public forceExit: boolean

  /**
   * Convert command flags to test filters
   */
  private getTestFilters() {
    const filters: JapaFlags = {}
    if (this.forceExit) {
      filters['--force-exit'] = true
    }

    if (this.timeout !== undefined) {
      filters['--timeout'] = this.timeout
    }

    if (this.tests) {
      filters['--tests'] = this.tests
    }

    if (this.groups) {
      filters['--groups'] = this.groups
    }

    if (this.suites) {
      filters['--suites'] = this.suites
    }

    if (this.tags) {
      filters['--tags'] = this.tags
    }

    if (this.ignoreTags) {
      filters['--ignore-tags'] = this.ignoreTags
    }

    return filters
  }

  public async run() {
    const { TestsServer } = await import('../src/Test')

    try {
      if (this.watch) {
        await new TestsServer(
          this.application.appRoot,
          this.getTestFilters(),
          this.nodeArgs,
          this.logger
        ).watch()
      } else {
        await new TestsServer(
          this.application.appRoot,
          this.getTestFilters(),
          this.nodeArgs,
          this.logger
        ).run()
      }
    } catch (error) {
      this.exitCode = 1
      this.logger.fatal(error)
    }
  }
}
