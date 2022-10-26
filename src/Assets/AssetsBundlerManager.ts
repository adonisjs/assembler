import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { BaseAssetsBundlerDriver } from './Drivers/BaseDriver'
import { Encore } from './Drivers/Encore'
import { Vite } from './Drivers/Vite'
import { logger as uiLogger } from '@poppinss/cliui'
import { existsSync } from 'fs'
import { join } from 'path'
import { Exception } from '@poppinss/utils'

export class AssetsBundlerManager {
  /**
   * Map of assets bundler drivers
   */
  private drivers: Record<string, () => BaseAssetsBundlerDriver> = {
    vite: () => new Vite(this.application, this.assetsBundlerArgs, this.logger),
    encore: () => new Encore(this.application, this.assetsBundlerArgs, this.logger),
  }

  /**
   * Reference to the assets bundler instance of the selected driver
   */
  public readonly driver: BaseAssetsBundlerDriver

  constructor(
    public application: ApplicationContract,
    private assetsBundlerArgs: string[] = [],
    private logger: typeof uiLogger = uiLogger,
    driverName?: 'vite' | 'encore'
  ) {
    const finalDriverName = driverName || this.tryDetectingDriver()
    if (!this.drivers[finalDriverName]) {
      throw new Error(`Assets bundler driver "${finalDriverName}" is not supported`)
    }

    this.driver = this.drivers[finalDriverName]()
  }

  /**
   * Check if any of the files exists at the application root
   */
  private areSomeFilesExists(files: string[]) {
    return files.some((file) => existsSync(join(this.application.appRoot, file)))
  }

  /**
   * Try to detecting the assets driver
   *
   * - Pick the one defined in the RC File
   * - Or try to detect based on the presence of the assets bundler config file
   */
  private tryDetectingDriver(): string {
    const rcFileDefined = this.application.rcFile.assetsDriver
    if (rcFileDefined) {
      this.logger.info(`assets driver set to "${rcFileDefined}" in .adonisrc.json`)
      return rcFileDefined
    }

    if (this.areSomeFilesExists(['webpack.config.js', 'webpack.config.ts'])) {
      this.logger.info(`found Webpack config file. Using it as the assets driver.`)
      return 'encore'
    }

    if (this.areSomeFilesExists(['vite.config.js', 'vite.config.ts'])) {
      this.logger.info(`found Vite config file. Using it as the assets driver.`)
      return 'vite'
    }

    throw new Exception(
      'Unable to detect assets bundler. Please install Encore or Vite and configure it in .adonisrc.json',
      500,
      'E_UNABLE_TO_DETECT_ASSETS_BUNDLER'
    )
  }

  /**
   * Configure assets bundler
   */
  public async configure() {
    return this.driver.configure()
  }

  /**
   * Build the assets either for production or development
   */
  public async build(env: 'production' | 'dev') {
    return this.driver.build(env)
  }

  /**
   * Start the assets bundler dev server
   */
  public async startDevServer() {
    return this.driver.startDevServer()
  }
}
