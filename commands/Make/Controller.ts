/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'
import { args, flags } from '@adonisjs/ace'
import { RcFile } from '@ioc:Adonis/Core/Application'
import { BaseGenerator } from './Base'

/**
 * Command to make a new HTTP Controller
 */
export default class MakeController extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected $suffix = 'Controller'
  protected $form = 'plural' as const
  protected $pattern = 'pascalcase' as const
  protected $resourceName: string

  /**
   * Do not pluralize `HomeController` name
   */
  protected $formIgnoreList = ['Home']

  /**
   * Command meta data
   */
  public static commandName = 'make:controller'
  public static description = 'Make a new HTTP controller'

  @args.string({ description: 'Name of the controller class' })
  public name: string

  @flags.boolean({ description: 'Adds resourceful methods to the controller class', alias: 'r' })
  public resource: boolean

  /**
   * Returns the template stub based upon the `--resource`
   * flag value
   */
  protected $getStub (): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      this.resource ? 'resource-controller.txt' : 'controller.txt',
    )
  }

  /**
   * Pull path from the `httpControllers` directory declaration from
   * the `.adonisrc.json` file or fallback to `app/Controllers/Http`
   */
  protected $getDestinationPath (rcContents: RcFile): string {
    return this.$getPathForNamespace(rcContents, 'httpControllers') || 'app/Controllers/Http'
  }

  public async handle () {
    this.$resourceName = this.name
    await super.generate()
  }
}
