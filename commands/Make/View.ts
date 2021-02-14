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
 * Command to make a new view
 */
export default class MakeView extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected suffix = ''
  protected extname = '.edge'
  protected pattern = 'snakecase' as const
  protected resourceName: string
  protected createExact: boolean

  /**
   * Command meta data
   */
  public static commandName = 'make:view'
  public static description = 'Make a new view template'

  @args.string({ description: 'Name of the view' })
  public name: string

  @flags.boolean({
    description: 'Create the template file with the exact name as provided',
    alias: 'e',
  })
  public exact: boolean

  /**
   * Returns the template stub path
   */
  protected getStub(): string {
    return join(__dirname, '..', '..', 'templates', 'view.txt')
  }

  /**
   * Path to the providers directory
   */
  protected getDestinationPath(): string {
    return this.application.rcFile.directories.views || 'resources/views'
  }

  public async run() {
    this.resourceName = this.name
    this.createExact = this.exact
    await super.generate()
  }
}
