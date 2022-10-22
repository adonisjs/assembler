import { join } from 'path'
import { files, logger } from '@adonisjs/sink'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { getPackageManager } from '../../utils'

export class EncoreConfigurer {
  constructor(private application: ApplicationContract) {}

  public async invoke() {
    /**
     * Create the webpack config file
     */
    const webpackConfigFile = new files.MustacheFile(
      this.application.appRoot,
      'webpack.config.js',
      join(__dirname, '../../../templates/webpack.config.txt')
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

    /**
     * Install Encore
     */
    const pkgFile = new files.PackageJsonFile(this.application.appRoot)
    pkgFile.install('@symfony/webpack-encore')
    pkgFile.install('webpack')
    pkgFile.install('webpack-cli')
    pkgFile.install('@babel/core')
    pkgFile.install('@babel/preset-env')
    pkgFile.useClient(getPackageManager(this.application))

    const spinner = logger.await(logger.colors.gray('configure @symfony/webpack-encore'))

    try {
      await pkgFile.commitAsync()
      spinner.update('Configured')
      spinner.stop()
    } catch (error) {
      spinner.update('Unable to install the package')
      spinner.stop()
      logger.fatal(error)
    }
  }
}
