/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { tasks, files, logger } from '@adonisjs/sink'
import { BaseCommand, args } from '@adonisjs/core/build/standalone'

import { Manifest } from '../src/Manifest'

/**
 * Configure a package
 */
export default class Configure extends BaseCommand {
  public static commandName = 'configure'
  public static description = 'Configure one or more AdonisJS packages'
  public static aliases = ['invoke']

  private appType = process.env['ADONIS_CREATE_APP_BOILERPLATE'] || 'web'

  /**
   * Use yarn when building for production to install dependencies
   */
  @args.spread({
    description: 'Name of the package(s) you want to configure',
  })
  public packages: string[]

  /**
   * Configure encore
   */
  private async configureEncore() {
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

    /**
     * Install Encore
     */
    const pkgFile = new files.PackageJsonFile(this.application.appRoot)
    pkgFile.install('@symfony/webpack-encore')

    const spinner = logger.await(logger.colors.gray('installing @symfony/webpack-encore'))

    try {
      await pkgFile.commitAsync()
      spinner.update('Installed')
      spinner.stop()
    } catch (error) {
      spinner.update('Unable to install the package')
      spinner.stop()
      logger.fatal(error)
    }
  }

  /**
   * Configure tests
   */
  private async configureTests() {
    /**
     * Create "test.ts" file
     */
    const testsEntryPointFile = new files.MustacheFile(
      this.application.appRoot,
      'test.ts',
      join(__dirname, '..', 'templates/test-entrypoint.txt')
    )
    if (!testsEntryPointFile.exists()) {
      testsEntryPointFile.apply({}).commit()
      logger.action('create').succeeded('test.ts')
    }

    /**
     * Create "tests/bootstrap.ts" file
     */
    const testsBootstrapFile = new files.MustacheFile(
      this.application.appRoot,
      'tests/bootstrap.ts',
      join(__dirname, '..', 'templates/tests/bootstrap.txt')
    )
    if (!testsBootstrapFile.exists()) {
      testsBootstrapFile.apply({}).commit()
      logger.action('create').succeeded('tests/bootstrap.ts')
    }

    /**
     * Create "tests/functional/hello_world.spec.ts" file
     */
    const helloWorldTestFile = new files.MustacheFile(
      this.application.appRoot,
      'tests/functional/hello_world.spec.ts',
      join(__dirname, '..', `templates/tests/functional/hello_world_${this.appType}.spec.txt`)
    )
    if (!helloWorldTestFile.exists()) {
      helloWorldTestFile.apply({}).commit()
      logger.action('create').succeeded('tests/functional/hello_world.spec.ts')
    }

    /**
     * Create "contracts/tests.ts" file
     */
    const testsContractsFile = new files.MustacheFile(
      this.application.appRoot,
      'contracts/tests.ts',
      join(__dirname, '..', 'templates/tests-contract.txt')
    )
    if (!testsContractsFile.exists()) {
      testsContractsFile.apply({}).commit()
      logger.action('create').succeeded('contracts/tests.ts')
    }

    /**
     * Update AdonisRc file with test suites
     */
    const rcFile = new files.AdonisRcFile(this.application.appRoot)
    rcFile.set('tests', {
      suites: [
        {
          name: 'functional',
          files: ['tests/functional/**/*.spec(.ts|.js)'],
          timeout: 60 * 1000,
        },
      ],
    })
    rcFile.addTestProvider('@japa/preset-adonis/TestsProvider')

    rcFile.commit()
    logger.action('update').succeeded('.adonisrc.json')

    /**
     * Create ".env.test" file
     */
    const testEnvFile = new files.NewLineFile(this.application.appRoot, '.env.test')
    if (!testEnvFile.exists()) {
      testEnvFile.add('NODE_ENV=test')

      /**
       * Set additional .env variables for "web" boilerplate
       */
      if (this.appType === 'web') {
        testEnvFile.add(['ASSETS_DRIVER=fake', 'SESSION_DRIVER=memory'])
      }

      testEnvFile.commit()
      logger.action('create').succeeded('.env.test')
    }

    /**
     * Update "tsconfig.json"
     */
    const tsConfig = new files.JsonFile(this.application.appRoot, 'tsconfig.json')
    const existingTypes = tsConfig.get('compilerOptions.types') || []

    if (!existingTypes.includes('@japa/preset-adonis/build/adonis-typings')) {
      existingTypes.push('@japa/preset-adonis/build/adonis-typings')
    }
    tsConfig.set('compilerOptions.types', existingTypes)

    tsConfig.commit()
    logger.action('update').succeeded('tsconfig.json')

    /**
     * Set additional .env variables for "web" boilerplate
     */
    if (this.appType === 'web') {
      testEnvFile.add(['ASSETS_DRIVER=fake', 'SESSION_DRIVER=memory'])
    }

    testEnvFile.commit()
    logger.action('create').succeeded('.env.test')

    /**
     * Install required dependencies
     */
    const pkgFile = new files.PackageJsonFile(this.application.appRoot)
    pkgFile.install('@japa/runner')
    pkgFile.install('@japa/preset-adonis')

    const spinner = logger.await(logger.colors.gray('installing @japa/runner, @japa/preset-adonis'))

    try {
      await pkgFile.commitAsync()
      spinner.update('Installed')
      spinner.stop()
    } catch (error) {
      spinner.update('Unable to install packages')
      spinner.stop()
      logger.fatal(error)
    }
  }

  /**
   * Configure a give package
   */
  private async configurePackage(name: string) {
    if (name === 'encore') {
      await this.configureEncore()
      return
    }

    if (name === 'tests') {
      await this.configureTests()
      return
    }

    await new tasks.Instructions(name, this.application.appRoot, this.application, true).execute()
    await new Manifest(this.application.appRoot, this.logger).generate()
  }

  /**
   * Invoked automatically by ace
   */
  public async run() {
    for (let name of this.packages) {
      await this.configurePackage(name)
    }
  }
}
