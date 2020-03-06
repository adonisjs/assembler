/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { BaseCommand, args } from '@adonisjs/ace'

import { Manifest } from '../src/Manifest'
import { ADONIS_ACE_CWD } from '../config/env'

const sleep = (timeout: number) => new Promise((resolve) => setTimeout(resolve, timeout))

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

    /**
     * When we execute the instructions that updates the `.adonisrc.json` file, we watcher
     * copies it's contents to the `build` directory.
     *
     * Once the copy is in progress, running the ace instructions leads to reading an empty
     * `.adonisrc.json` file.
     *
     * Now there is no simple way to know when the separate process watching and processing
     * files will copy the `.adonisrc.json` file. So we add a small cool off period in
     * between.
     */
    await sleep(400)
    await new Manifest(cwd, this.logger).generate()
  }
}
