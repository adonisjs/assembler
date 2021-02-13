/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand, flags } from '@adonisjs/core/build/standalone'

/**
 * Compile typescript project to Javascript and start
 * the HTTP server
 */
export default class Serve extends BaseCommand {
  public static commandName = 'serve'
  public static description = 'Start the AdonisJS HTTP server. Optionally watch for file changes'

  public static settings = {
    stayAlive: true,
  }

  /**
   * Allows watching for file changes
   */
  @flags.boolean({ description: 'Watch for file changes and re-start the HTTP server', alias: 'w' })
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
   * Arguments to pass to the `node` binary
   */
  @flags.array({ description: 'CLI options to pass to the node command line' })
  public nodeArgs: string[] = []

  public async run() {
    const { DevServer } = await import('../src/DevServer')

    try {
      if (this.watch) {
        await new DevServer(this.application.appRoot, this.nodeArgs, this.logger).watch(this.poll)
      } else {
        await new DevServer(this.application.appRoot, this.nodeArgs, this.logger).start()
      }
    } catch (error) {
      this.logger.fatal(error)
    }
  }
}
