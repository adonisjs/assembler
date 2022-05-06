/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand, args, flags } from '@adonisjs/core/build/standalone'
import { files, logger } from '@adonisjs/sink'
import globParent from 'glob-parent'
import { join } from 'path'

/**
 * Create a new test suite
 */
export default class CreateSuite extends BaseCommand {
  public static commandName = 'make:suite'
  public static description = 'Create a new test suite'

  /**
   * Name of the test suite to be created
   */
  @args.string({ description: 'Name of the test suite' })
  public suite: string

  /**
   * Glob pattern for the test suite, or only location to the test suite
   */
  @args.string({ description: 'Path to the test suite directory', required: false })
  public location: string = ''

  /**
   * Should add a sample test file
   */
  @flags.boolean({ description: 'Add a sample test file' })
  public withExampleTest: boolean = true

  /**
   * Get the destination path for the sample test file
   */
  private getExampleTestDestinationPath() {
    return globParent(this.location) + '/test.spec.ts'
  }

  /**
   * Generate suite glob pattern based on `location` argument
   */
  private generateSuiteGlobPattern() {
    if (!this.location) {
      this.location = `tests/${this.suite}`
    }

    if (!['*', '.js', '.ts'].find((keyword) => this.location.includes(keyword))) {
      this.location = `${this.location}/**/*.spec(.ts|.js)`
    }
  }

  /**
   * Check if the suite name is already defined in RcFile
   */
  private checkIfSuiteExists(rcFile: files.AdonisRcFile) {
    const existingSuites = rcFile.get('tests.suites') || []
    const existingSuitesNames = existingSuites.map((suite) => suite.name)

    return existingSuitesNames.includes(this.suite)
  }

  /**
   * Add the new test suite to the AdonisRC File and save it
   */
  private async addSuiteToRcFile() {
    const rcFile = new files.AdonisRcFile(this.application.appRoot)
    const existingSuites = rcFile.get('tests.suites') || []

    if (this.checkIfSuiteExists(rcFile)) {
      return logger.action('update').skipped(`Suite ${this.suite} already exists`)
    }

    rcFile.set('tests.suites', [
      ...existingSuites,
      {
        name: this.suite,
        files: [this.location],
        timeout: 60 * 1000,
      },
    ])

    rcFile.commit()
    logger.action('update').succeeded('.adonisrc.json')
  }

  /**
   * Add a sample test file to the new suite folder
   */
  private createSampleTestFile() {
    const path = this.getExampleTestDestinationPath()
    const testFile = new files.MustacheFile(
      this.application.appRoot,
      path,
      join(__dirname, '../..', 'templates/test.txt')
    )

    if (!testFile.exists()) {
      testFile.apply({}).commit()
      logger.action('create').succeeded(path)
    }
  }

  public async run() {
    this.generateSuiteGlobPattern()

    await this.addSuiteToRcFile()

    if (this.withExampleTest) {
      this.createSampleTestFile()
    }
  }
}
