import { BaseAssetsBundlerDriver, DevServerResponse } from './BaseDriver'
import { EncoreConfigurer } from './EncoreConfigurer'
import execa from 'execa'
import getPort from 'get-port'

export class Encore extends BaseAssetsBundlerDriver {
  public name = 'encore'

  private configurer = new EncoreConfigurer(this.application)

  /**
   * Binary to execute
   */
  protected binaryName = 'encore'

  /**
   * Check if webpack encore is installed
   */
  private isEncoreInstalled() {
    return this.isPackageInstalled('@symfony/webpack-encore')
  }

  /**
   * Configure the driver
   */
  public async configure() {
    return this.configurer.invoke()
  }

  /**
   * Build assets either for production or development
   */
  public async build(env: 'dev' | 'production') {
    if (!this.isEncoreInstalled()) {
      return { hasErrors: false }
    }

    try {
      await this.exec(([env] as string[]).concat(this.bundlerArgs))
      return { hasErrors: false }
    } catch (error) {
      return { hasErrors: true }
    }
  }

  /**
   * Start the webpack dev server
   */
  public async startDevServer(): Promise<DevServerResponse> {
    if (!this.isEncoreInstalled()) {
      return { state: 'not-installed' }
    }

    const customHost = this.findCustomHost() || 'localhost'

    /**
     * Define a random port when the "--port" flag is not passed.
     *
     * Encore anyways doesn't allow defining port inside the webpack.config.js
     * file for generating the manifest and entrypoints file.
     *
     * @see
     * https://github.com/symfony/webpack-encore/issues/941#issuecomment-787568811
     */
    let customPort = this.findCustomPort()
    if (!customPort) {
      const randomPort = await getPort({ port: 8080, host: 'localhost' })
      customPort = String(randomPort)
      this.bundlerArgs.push('--port', customPort)
    }

    const childProcess = execa(
      this.binaryName,
      ['dev-server'].concat(this.bundlerArgs),
      this.execaOptions
    )

    childProcess.stdout?.on('data', (line: Buffer) => this.log(line))
    childProcess.stderr?.on('data', (line: Buffer) => this.log(line, 'error'))
    childProcess.on('close', (code, signal) => this.emit('close', { code, signal }))
    childProcess.on('exit', (code, signal) => this.emit('exit', { code, signal }))

    return { state: 'running', port: customPort, host: customHost }
  }
}
