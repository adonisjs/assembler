/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { BaseCommand, flags } from '@adonisjs/ace'

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
   * Detect changes by polling files
   */
  @flags.boolean({
    description: 'Detect file changes by polling files instead of listening to filesystem events',
    alias: 'p',
  })
  public poll: boolean

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
    const { Watcher } = await import('../src/Watcher')
    const { Compiler } = await import('../src/Compiler')
    const { BuildWatcher } = await import('../src/BuildWatcher')
    const { ADONIS_ACE_CWD, ADONIS_IS_TYPESCRIPT, ADONIS_BUILD_DIR } = await import('../config/env')

    const cwd = ADONIS_ACE_CWD()

    /**
     * Dis-allow when CWD is missing. It will always be set by `node ace`
     * commands
     */
    if (!cwd) {
      this.logger.error(
        'Cannot build non-typescript project. Make sure to run "node ace serve" from the project root',
      )
      return
    }

    /**
     * Dis-allow when running the command inside the compiled source and still
     * asking to re-compile the code
     */
    if (!ADONIS_IS_TYPESCRIPT() && this.compile !== false) {
      this.logger.error(
        [
          'Cannot build non-typescript project. ',
          'Make sure to run "node ace serve" from the project root, or use "--no-compile" flag',
        ].join(''),
      )
      return
    }

    try {
      if (this.compile === false) {
        await new BuildWatcher(cwd, this.nodeArgs, this.logger).watch(ADONIS_BUILD_DIR() || './', this.poll)
      } else if (this.watch) {
        await new Watcher(cwd, true, this.nodeArgs, this.logger).watch(this.poll)
      } else {
        await new Compiler(cwd, true, this.nodeArgs, this.logger).compile()
      }
    } catch (error) {
      this.logger.fatal(error)
    }
  }
}
