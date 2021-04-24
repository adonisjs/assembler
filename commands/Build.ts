/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import hasYarn from 'has-yarn'
import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import { TSCONFIG_FILE_NAME } from '../config/paths'

/**
 * Compile typescript project Javascript
 */
export default class Build extends BaseCommand {
  public static commandName = 'build'
  public static description =
    'Compile project from Typescript to Javascript. Also compiles the frontend assets if using webpack encore'

  /**
   * Build for production
   */
  @flags.boolean({ description: 'Build for production', alias: 'prod' })
  public production: boolean

  /**
   * Bundle frontend assets. Defaults to true
   */
  @flags.boolean({
    description:
      'Build frontend assets when webpack encore is installed. Use --no-assets to disable',
  })
  public assets: boolean = true

  /**
   * Ignore ts errors and complete the build process. Defaults to false
   */
  @flags.boolean({
    description: 'Ignore typescript errors and complete the build process',
  })
  public ignoreTsErrors: boolean

  /**
   * Path to the TypeScript project configuration file. Defaults to "tsconfig.json"
   */
  @flags.string({
    description: 'Path to the TypeScript project configuration file',
  })
  public tsconfig: string = TSCONFIG_FILE_NAME

  /**
   * Arguments to pass to the `encore` binary
   */
  @flags.array({ description: 'CLI options to pass to the encore command line' })
  public encoreArgs: string[] = []

  /**
   * Select the client for deciding the lock file to copy to the
   * build folder
   */
  @flags.string({
    description: 'Select the package manager to decide which lock file to copy to the build folder',
  })
  public client: string

  /**
   * Invoked automatically by ace
   */
  public async run() {
    const { Compiler } = await import('../src/Compiler')

    /**
     * Deciding the client to use for installing dependencies
     */
    this.client = this.client || hasYarn(this.application.appRoot) ? 'yarn' : 'npm'
    if (this.client !== 'npm' && this.client !== 'yarn') {
      this.logger.warning('--client must be set to "npm" or "yarn"')
      this.exitCode = 1
      return
    }

    /**
     * Stop on error when "ignoreTsErrors" is not set
     */
    const stopOnError = !this.ignoreTsErrors

    try {
      if (this.production) {
        await new Compiler(
          this.application.appRoot,
          this.encoreArgs,
          this.assets,
          this.logger,
          this.tsconfig
        ).compileForProduction(stopOnError, this.client)
      } else {
        await new Compiler(
          this.application.appRoot,
          this.encoreArgs,
          this.assets,
          this.logger,
          this.tsconfig
        ).compile(stopOnError)
      }
    } catch (error) {
      this.logger.fatal(error)
      this.exitCode = 1
    }
  }
}
