/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
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
   * Configure encore
   */
  private async configureEncore() {
    const { files, logger } = await import('@adonisjs/sink')

    /**
     * Create the webpack config file
     */
    const webpackConfigFile = new files.MustacheFile(
      this.application.appRoot,
      'webpack.config.js',
      join(__dirname, '..', 'templates/webpack.config.txt')
    )
    if (!webpackConfigFile.exists()) {
      webpackConfigFile.apply({}).commit()
      logger.action('create').succeeded('webpack.config.js')
    }

    /**
     * Create app.js entrypoint
     */
    const entryPointFile = new files.NewLineFile(this.application.appRoot, 'resources/js/app.js')
    if (!entryPointFile.exists()) {
      entryPointFile.add('// app entrypoint').commit()
      logger.action('create').succeeded('resources/js/app.js')
    }

    const pkgFile = new files.PackageJsonFile(this.application.appRoot)
    pkgFile.install('@symfony/webpack-encore')

    const spinner = logger.await(logger.colors.gray('installing @symfony/webpack-encore'))

    try {
      await pkgFile.commitAsync()
      spinner.update('Installed')
    } catch (error) {
      spinner.update('Unable to install the package')
      logger.fatal(error)
    }
  }

  /**
   * Invoked automatically by ace
   */
  public async run() {
    if (this.name === 'encore') {
      await this.configureEncore()
      return
    }

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
