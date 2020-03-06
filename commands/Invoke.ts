/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { open } from 'fs-extra'
import { join } from 'path'
import { BaseCommand, args } from '@adonisjs/ace'

import { Manifest } from '../src/Manifest'
import { ADONIS_ACE_CWD, ADONIS_BUILD_DIR } from '../config/env'

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
   * Attempts to access the rc file handling the race condition of
   * it's being accessed by another process.
   */
  private async accessRcFile (counter = 0) {
    const buildDir = ADONIS_BUILD_DIR()
    const cwd = ADONIS_ACE_CWD()!

    /**
     * Return early when we are unaware of the build
     * directory
     */
    if (!buildDir) {
      return
    }

    try {
      await open(join(cwd, buildDir, '.adonisrc.json'), 'r+')
    } catch (error) {
      if (error.code === 'EBUSY' && counter < 3) {
        await this.accessRcFile(counter + 1)
      } else {
        throw error
      }
    }
  }

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

    try {
      await this.accessRcFile()
    } catch (error) {
    }

    await new Manifest(cwd, this.logger).generate()
  }
}
