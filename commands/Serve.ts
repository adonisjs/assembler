/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { BaseCommand, flags } from '@adonisjs/ace'

import { Watcher } from '../src/Watcher'
import { Compiler } from '../src/Compiler'
import { BuildWatcher } from '../src/BuildWatcher'
import { ADONIS_ACE_CWD, ADONIS_IS_TYPESCRIPT, ADONIS_BUILD_DIR } from '../config/env'

/**
 * Compile typescript project to Javascript and start
 * the HTTP server
 */
export default class Serve extends BaseCommand {
  public static commandName = 'serve'
  public static description = 'Compile typescript code to Javascript and start the HTTP server'

  /**
   * Allows watching for file changes
   */
  @flags.boolean({ description: 'Watch for file changes and re-build the project', alias: 'w' })
  public watch: boolean

  /**
   * Allows watching for file changes
   */
  @flags.boolean({
    description: 'Turn off Typescript compiler by passing --no-compile',
    default: true,
  })
  public compile: boolean

  /**
   * Arguments to pass to the `node` binary
   */
  @flags.array({ description: 'CLI options to pass to the node command line' })
  public nodeArgs: string[] = []

  public async handle () {
    /**
     * Dis-allow when CWD is missing. It will always be set by `node ace`
     * commands
     */
    if (!ADONIS_ACE_CWD) {
      this.logger.error(
        'Cannot build non-typescript project. Make sure to run "node ace serve" from the project root',
      )
      return
    }

    /**
     * Dis-allow when running the command inside the compiled source and still
     * asking to re-compile the code
     */
    if (!ADONIS_IS_TYPESCRIPT && this.compile !== false) {
      this.logger.error(
        'Cannot build non-typescript project. Make sure to run "node ace serve" from the project root',
      )
      return
    }

    try {
      if (this.compile === false) {
        await new BuildWatcher(ADONIS_ACE_CWD, this.nodeArgs, this.logger).watch(ADONIS_BUILD_DIR || './')
      } else if (this.watch) {
        await new Watcher(ADONIS_ACE_CWD, true, this.nodeArgs, this.logger).watch()
      } else {
        await new Compiler(ADONIS_ACE_CWD, true, this.nodeArgs, this.logger).compile()
      }
    } catch (error) {
      this.logger.fatal(error)
    }
  }
}
