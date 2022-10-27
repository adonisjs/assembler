import execa from 'execa'
import { BaseAssetsBundlerDriver, DevServerResponse } from './BaseDriver'
import { ViteConfigurer } from './ViteConfigurer'

export class Vite extends BaseAssetsBundlerDriver {
  public name = 'vite'

  private configurer = new ViteConfigurer(this.application)

  /**
   * Binary to execute
   */
  protected binaryName = 'vite'

  /**
   * Check if vite is installed
   */
  private isViteInstalled() {
    return this.isPackageInstalled('vite')
  }

  /**
   * Configure the driver
   */
  public configure() {
    return this.configurer.invoke()
  }

  /**
   * Build assets either for production or development
   */
  public async build(env: 'dev' | 'production'): Promise<{ hasErrors: boolean }> {
    if (!this.isViteInstalled()) {
      return { hasErrors: false }
    }

    this.notifyAboutVite()

    try {
      const command = env === 'dev' ? 'dev' : 'build'

      await this.exec([command].concat(this.bundlerArgs))
      return { hasErrors: false }
    } catch (error) {
      return { hasErrors: true }
    }
  }

  /**
   * Start the vite dev server
   */
  public async startDevServer(): Promise<DevServerResponse> {
    if (!this.isViteInstalled()) {
      return { state: 'not-installed' }
    }

    const customHost = this.findCustomHost() || 'localhost'
    const customPort = this.findCustomPort() || '5173'

    const childProcess = execa(this.binaryName, ['dev'].concat(this.bundlerArgs), this.execaOptions)

    childProcess.stdout?.on('data', (line: Buffer) => this.log(line))
    childProcess.stderr?.on('data', (line: Buffer) => this.log(line, 'error'))
    childProcess.on('close', (code, signal) => this.emit('close', { code, signal }))
    childProcess.on('exit', (code, signal) => this.emit('exit', { code, signal }))

    return { state: 'running', port: customPort, host: customHost }
  }
}
