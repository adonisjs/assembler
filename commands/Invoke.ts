/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand, args } from '@adonisjs/core/build/standalone'
import { Manifest } from '../src/Manifest'

/**
 * Configure a package
 */
export default class Configure extends BaseCommand {
  public static commandName = 'configure'
  public static description = 'Configure a given AdonisJS package'
  public static aliases = ['invoke']

  /**
   * Use yarn when building for production to install dependencies
   */
  @args.string({
    description: 'Name of the package you want to configure',
  })
  public name: string

  /**
   * Invoked automatically by ace
   */
  public async run() {
    const { tasks } = await import('@adonisjs/sink')

    await new tasks.Instructions(
      this.name,
      this.application.appRoot,
      this.application,
      true
    ).execute()

    await new Manifest(this.application.appRoot, this.logger).generate()
  }
}
