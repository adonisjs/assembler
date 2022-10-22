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
  public static description =
    'Start the AdonisJS HTTP server, along with the file watcher. Also starts the webpack dev server when webpack encore is installed'

  public static settings = {
    stayAlive: true,
  }

  /**
   * Bundle frontend assets. Defaults to true
   */
  @flags.boolean({
    description: 'Start webpack dev server when encore is installed. Use "--no-assets" to disable',
  })
  public assets: boolean = true

  /**
   * Allows watching for file changes
   */
  @flags.boolean({
    description: 'Watch for file changes and re-start the HTTP server on change',
    alias: 'w',
  })
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

  /**
   * Arguments to pass to the `encore` binary
   */
  @flags.array({ description: 'CLI options to pass to the assets bundler command line' })
  public assetsBundlerArgs: string[] = []

  public async run() {
    const { DevServer } = await import('../src/DevServer')

    try {
      const devServer = new DevServer(
        this.application,
        this.nodeArgs,
        this.assetsBundlerArgs,
        this.assets,
        this.logger
      )

      if (this.watch) {
        await devServer.watch(this.poll)
      } else {
        await devServer.start()
      }
    } catch (error) {
      this.logger.fatal(error)
    }
  }
}
