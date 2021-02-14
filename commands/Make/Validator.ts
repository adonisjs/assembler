/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { args, flags } from '@adonisjs/core/build/standalone'
import { BaseGenerator } from './Base'

/**
 * Command to make a new validator
 */
export default class MakeValidator extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected suffix = 'Validator'
  protected form = 'singular' as const
  protected pattern = 'pascalcase' as const
  protected resourceName: string
  protected createExact: boolean

  /**
   * Command meta data
   */
  public static commandName = 'make:validator'
  public static description = 'Make a new validator'

  @args.string({ description: 'Name of the validator class' })
  public name: string

  @flags.boolean({
    description: 'Create the validator with the exact name as provided',
    alias: 'e',
  })
  public exact: boolean

  /**
   * Returns the template stub path
   */
  protected getStub(): string {
    return join(__dirname, '..', '..', 'templates', 'validator.txt')
  }

  /**
   * Pull path for the `validators` directory declaration from
   * the `.adonisrc.json` file or fallback to `app/Validators`
   */
  protected getDestinationPath(): string {
    return this.getPathForNamespace('validators') || 'app/Validators'
  }

  public async run() {
    this.resourceName = this.name
    this.createExact = this.exact
    await super.generate()
  }
}
