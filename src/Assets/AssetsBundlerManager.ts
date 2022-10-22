import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { BaseAssetsBundlerDriver } from './Drivers/BaseDriver'
import { Encore } from './Drivers/Encore'
import { Vite } from './Drivers/Vite'
import { logger as uiLogger } from '@poppinss/cliui'

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
    driverName: string = 'encore'
  ) {
    if (!this.drivers[driverName]) {
      throw new Error(`Assets bundler driver "${driverName}" is not supported`)
    }

    this.driver = this.drivers[driverName]()
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
