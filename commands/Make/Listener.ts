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
 * Command to make a new event listener class
 */
export default class MakeListener extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected form = 'singular' as const
  protected pattern = 'pascalcase' as const
  protected resourceName: string
  protected createExact: boolean

  /**
   * Command meta data
   */
  public static commandName = 'make:listener'
  public static description = 'Make a new event listener class'

  @args.string({ description: 'Name of the event listener class' })
  public name: string

  @flags.boolean({
    description: 'Create the listener with the exact name as provided',
    alias: 'e',
  })
  public exact: boolean

  /**
   * Returns the template stub
   */
  protected getStub(): string {
    return join(__dirname, '..', '..', 'templates', 'event-listener.txt')
  }

  /**
   * Pull path from the `listeners` directory declaration from
   * the `.adonisrc.json` file or fallback to `app/Listeners`
   */
  protected getDestinationPath(): string {
    return this.getPathForNamespace('eventListeners') || 'app/Listeners'
  }

  public async run() {
    this.resourceName = this.name
    this.createExact = this.exact
    await super.generate()
  }
}
