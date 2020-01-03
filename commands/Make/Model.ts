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
 * Command to make a new model
 */
export default class MakeModel extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected $suffix = ''
  protected $form = 'singular' as const
  protected $pattern = 'pascalcase' as const
  protected $resourceName: string

  /**
   * Command meta data
   */
  public static commandName = 'make:model'
  public static description = 'Make a new Lucid model'

  @args.string({ description: 'Make of the model class' })
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
      'model.txt',
    )
  }

  /**
   * Pull path from the `models` directory declaration from
   * the `.adonisrc.json` file or fallback to `app/Models`
   */
  protected $getDestinationPath (rcContents: RcFile): string {
    return this.$getPathForNamespace(rcContents, 'models') || 'app/Models'
  }

  public async handle () {
    this.$resourceName = this.name
    await super.generate()
  }
}
