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
 * Compile typescript project Javascript
 */
export default class Build extends BaseCommand {
  public static commandName = 'build'
  public static description = 'Compile typescript code to Javascript. Optionally watch for file changes'

  /**
   * Allows watching for file changes
   */
  @flags.boolean({ description: 'Watch for file changes and re-build the project', alias: 'w' })
  public watch: boolean

  /**
   * Build for production
   */
  @flags.boolean({ description: 'Build for production', alias: 'prod' })
  public production: boolean

  /**
   * Use yarn when building for production to install dependencies
   */
  @flags.boolean({ description: 'Use yarn for installing dependencies. Defaults to npm' })
  public yarn: boolean

  /**
   * Invoked automatically by ace
   */
  public async handle () {
    const { Watcher } = await import('../src/Watcher')
    const { Compiler } = await import('../src/Compiler')
    const { ADONIS_ACE_CWD, ADONIS_IS_TYPESCRIPT } = await import('../config/env')

    const cwd = ADONIS_ACE_CWD()

    /**
     * Dis-allow when CWD is missing. It will always be set by `node ace`
     * commands and also when project is not a typescript project.
     */
    if (!cwd || !ADONIS_IS_TYPESCRIPT()) {
      this.logger.error(
        'Cannot build non-typescript project. Make sure to run "node ace build" from the project root',
      )
      return
    }

    /**
     * --watch and --production flags aren't allowed together
     */
    if (this.watch && this.production) {
      this.logger.info('--watch and --production flags cannot be used together. Skipping --watch')
    }

    try {
      if (this.production) {
        const client = this.yarn ? 'yarn' : 'npm'
        await new Compiler(cwd, false, [], this.logger).compileForProduction(client)
      } else if (this.watch) {
        await new Watcher(cwd, false, [], this.logger).watch()
      } else {
        await new Compiler(cwd, false, [], this.logger).compile()
      }
    } catch (error) {
      this.logger.fatal(error)
    }
  }
}
