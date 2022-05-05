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
import { join } from 'path'

/**
 * Create a new test suite
 */
export default class CreateSuite extends BaseCommand {
  public static commandName = 'create-test-suite'
  public static description = 'Create a new test suite'

  /**
   * Name of the test suite to be created
   */
  @args.string({ description: 'Name of the test suite' })
  public suiteName: string

  /**
   * Should add a sample test file
   */
  @flags.boolean({ description: 'Add a sample test file' })
  public addSampleTestFile: boolean = true

  /**
   * Check if the suite name is already defined in RcFile
   */
  private checkIfSuiteExists(rcFile: files.AdonisRcFile) {
    const existingSuites = rcFile.get('tests.suites') || []
    const existingSuitesNames = existingSuites.map((suite) => suite.name)

    return existingSuitesNames.includes(this.suiteName)
  }

  /**
   * Add the new test suite to the AdonisRC File and save it
   */
  private async addSuiteToRcFile() {
    const rcFile = new files.AdonisRcFile(this.application.appRoot)
    const existingSuites = rcFile.get('tests.suites') || []

    if (this.checkIfSuiteExists(rcFile)) {
      return logger.action('update').skipped(`Suite ${this.suiteName} already exists`)
    }

    rcFile.set('tests.suites', [
      ...existingSuites,
      {
        name: this.suiteName,
        files: [`tests/${this.suiteName}/**/*.spec(.ts|.js)`],
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
    const path = `tests/${this.suiteName}/test.spec.ts`
    const testFile = new files.MustacheFile(
      this.application.appRoot,
      path,
      join(__dirname, '..', 'templates/test.txt')
    )

    if (!testFile.exists()) {
      testFile.apply({}).commit()
      logger.action('create').succeeded(path)
    }
  }

  public async run() {
    await this.addSuiteToRcFile()

    if (this.addSampleTestFile) {
      this.createSampleTestFile()
    }
  }
}
