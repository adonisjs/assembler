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
import { RcFile } from '@ioc:Adonis/Core/Application'
import { BaseGenerator } from './Base'

/**
 * Command to make a new view
 */
export default class MakeView extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected $suffix = ''
  protected $extname = '.edge'
  protected $form = 'singular' as const
  protected $pattern = 'snakecase' as const
  protected $resourceName: string

  /**
   * Command meta data
   */
  public static commandName = 'make:view'
  public static description = 'Make a new view template'

  @args.string({ description: 'Name of the view' })
  public name: string

  /**
   * Returns the template stub path
   */
  protected $getStub (): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      'view.txt',
    )
  }

  /**
   * Path to the providers directory
   */
  protected $getDestinationPath (rcFile: RcFile): string {
    return rcFile.directories.views || 'resources/views'
  }

  public async handle () {
    this.$resourceName = this.name
    await super.generate()
  }
}
