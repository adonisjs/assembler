/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { BaseCommand, args } from '@adonisjs/ace'
import { ADONIS_ACE_CWD } from '../config/env'

/**
 * Invoke post install instructions
 */
export default class Invoke extends BaseCommand {
  public static commandName = 'invoke'
  public static description = 'Invoke post install instructions on a given AdonisJs package'

  /**
   * Use yarn when building for production to install dependencies
   */
  @args.string({ description: 'Name of the package for which to invoke post install instructions' })
  public name: string

  /**
   * Invoked automatically by ace
   */
  public async handle () {
    const cwd = ADONIS_ACE_CWD()

    /**
     * Dis-allow when CWD is missing. It will always be set by `node ace`
     * commands
     */
    if (!cwd) {
      this.logger.error(
        'Cannot invoke post install instructions. Make sure you running this command as "node ace invoke"',
      )
      return
    }

    const { executeInstructions } = await import('@adonisjs/sink')
    await executeInstructions(this.name, cwd, this.application)
  }
}
