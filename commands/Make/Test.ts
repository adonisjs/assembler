/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import globParent from 'glob-parent'
import { string } from '@poppinss/utils/build/helpers'
import { args, flags } from '@adonisjs/core/build/standalone'
import { BaseGenerator } from './Base'

/**
 * Command to make a new test
 */
export default class MakeTest extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected extname = '.spec.ts'
  protected form = 'singular' as const
  protected pattern = 'snakecase' as const
  protected resourceName: string
  protected createExact: boolean

  /**
   * Command meta data
   */
  public static commandName = 'make:test'
  public static description = 'Make a new test'

  @args.string({ description: 'Name of the test suite' })
  public suite: string

  @args.string({ description: 'Name of the test file' })
  public name: string

  @flags.boolean({
    description: 'Create the test file with the exact name as provided',
    alias: 'e',
  })
  public exact: boolean

  /**
   * Returns the template stub path
   */
  protected getStub(): string {
    return join(__dirname, '..', '..', 'templates', 'test.txt')
  }

  /**
   * The file is created inside the parent directory of the first
   * glob pattern
   */
  protected getDestinationPath(): string {
    const testSuites = this.application.rcFile.tests.suites
    const mentionedSuite = testSuites.find(({ name }) => this.suite === name)!
    const suiteGlob = Array.isArray(mentionedSuite.files)
      ? mentionedSuite.files[0]
      : mentionedSuite.files

    return globParent(suiteGlob)
  }

  protected templateData() {
    return {
      name: string.sentenceCase(this.name),
    }
  }

  public async run() {
    const testSuites = this.application.rcFile.tests.suites
    const mentionedSuite = testSuites.find(({ name }) => this.suite === name)!
    if (!mentionedSuite) {
      this.logger.error(
        `Invalid suite "${this.suite}". Make sure the suite is registered inside the .adonisrc.json file`
      )
      return
    }

    this.resourceName = this.name
    this.createExact = this.exact
    await super.generate()
  }
}
