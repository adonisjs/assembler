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
 * Command to make a new HTTP Controller
 */
export default class MakeController extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected suffix = 'Controller'
  protected form = 'plural' as const
  protected pattern = 'pascalcase' as const
  protected resourceName: string
  protected createExact: boolean

  /**
   * Do not pluralize following controller names
   */
  protected formIgnoreList = [
    'Home',
    'Auth',
    'Login',
    'Authentication',
    'Adonis',
    'Dashboard',
    'Signup',
  ]

  /**
   * Command meta data
   */
  public static commandName = 'make:controller'
  public static description = 'Make a new HTTP controller'

  @args.string({ description: 'Name of the controller class' })
  public name: string

  @flags.boolean({ description: 'Adds resourceful methods to the controller class', alias: 'r' })
  public resource: boolean

  @flags.boolean({
    description: 'Create the controller with the exact name as provided',
    alias: 'e',
  })
  public exact: boolean

  /**
   * Returns the template stub based upon the `--resource`
   * flag value
   */
  protected getStub(): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      this.resource ? 'resource-controller.txt' : 'controller.txt'
    )
  }

  /**
   * Pull path from the `httpControllers` directory declaration from
   * the `.adonisrc.json` file or fallback to `app/Controllers/Http`
   */
  protected getDestinationPath(): string {
    return this.getPathForNamespace('httpControllers') || 'app/Controllers/Http'
  }

  public async run() {
    this.resourceName = this.name
    this.createExact = this.exact
    await super.generate()
  }
}
