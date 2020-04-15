/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'
import { args } from '@adonisjs/ace'
import { BaseGenerator } from './Base'

/**
 * Command to make a new middleware
 */
export default class MakeMiddleware extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected suffix = ''
  protected form = 'singular' as const
  protected pattern = 'pascalcase' as const
  protected resourceName: string

  /**
   * Command meta data
   */
  public static commandName = 'make:middleware'
  public static description = 'Make a new middleware'

  @args.string({ description: 'Name of the middleware class' })
  public name: string

  /**
   * Returns the template stub path
   */
  protected getStub (): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      'middleware.txt',
    )
  }

  /**
   * Middleware are always created inside `app/Middleware` directory.
   * We can look into configuring it later.
   */
  protected getDestinationPath (): string {
    return 'app/Middleware'
  }

  public async handle () {
    this.resourceName = this.name
    await super.generate()
  }
}
