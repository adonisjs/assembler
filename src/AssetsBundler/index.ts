/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import execa from 'execa'
import Emittery from 'emittery'
import { logger as uiLogger } from '@poppinss/cliui'
import { resolveDir } from '@poppinss/utils/build/helpers'

/**
 * Assets bundler uses webpack encore to build frontend dependencies
 */
export class AssetsBundler extends Emittery {
  /**
   * Binary to execute
   */
  private binaryName = 'encore'

  /**
   * Options passed to spawn a child process
   */
  private execaOptions = {
    preferLocal: true,
    buffer: false,
    stdio: 'pipe' as const,
    localDir: this.projectRoot,
    cwd: this.projectRoot,
    env: {
      FORCE_COLOR: 'true',
      ...this.env,
    },
  }

  constructor(
    private projectRoot: string,
    private encoreArgs: string[] = [],
    private buildAssets: boolean = true,
    private logger: typeof uiLogger,
    private env: { [key: string]: string } = {}
  ) {
    super()
  }

  /**
   * Find if encore is installed
   */
  private isEncoreInstalled() {
    try {
      resolveDir(this.projectRoot, '@symfony/webpack-encore')
      return true
    } catch {
      return false
    }
  }

  /**
   * Notify user that we are about use encore
   */
  private notifyAboutEncore() {
    this.logger.info(`detected { ${this.logger.colors.dim().yellow('@symfony/webpack-encore')} }`)
    this.logger.info(
      `building frontend assets. Use { ${this.logger.colors
        .dim()
        .yellow('--no-assets')} } to disable`
    )
  }

  /**
   * Logs the line to stdout
   */
  private log(line: Buffer | string) {
    line = line.toString().trim()
    if (!line.length) {
      return
    }
    console.log(`[ ${this.logger.colors.cyan('encore')} ] ${line}`)
  }

  /**
   * Logs the line to stderr
   */
  private logError(line: Buffer | string) {
    line = line.toString().trim()
    if (!line.length) {
      return
    }
    console.error(`[ ${this.logger.colors.cyan('encore')} ] ${line}`)
  }

  /**
   * Execute command
   */
  private exec(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = execa(this.binaryName, args, this.execaOptions)

      childProcess.stdout?.on('data', (line: Buffer) => this.log(line))
      childProcess.stderr?.on('data', (line: Buffer) => this.logError(line))
      childProcess.on('error', (error) => reject(error))
      childProcess.on('close', (code) => {
        if (code && code !== 0) {
          reject(`Process exited with code ${code}`)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Build assets using encore
   */
  public async build(): Promise<{ hasErrors: boolean }> {
    if (!this.buildAssets) {
      return { hasErrors: false }
    }

    if (!this.isEncoreInstalled()) {
      return { hasErrors: false }
    }

    this.notifyAboutEncore()

    try {
      await this.exec(['dev'].concat(this.encoreArgs))
      return { hasErrors: false }
    } catch (error) {
      return { hasErrors: true }
    }
  }

  /**
   * Build assets for production
   */
  public async buildForProduction(): Promise<{ hasErrors: boolean }> {
    if (!this.buildAssets) {
      return { hasErrors: false }
    }

    if (!this.isEncoreInstalled()) {
      return { hasErrors: false }
    }

    this.notifyAboutEncore()

    try {
      await this.exec(['production'].concat(this.encoreArgs))
      return { hasErrors: false }
    } catch (error) {
      return { hasErrors: true }
    }
  }

  /**
   * Start the webpack dev server
   */
  public startDevServer(): { state: 'not-installed' | 'no-assets' | 'running' } {
    if (!this.isEncoreInstalled()) {
      return { state: 'not-installed' }
    }

    if (!this.buildAssets) {
      return { state: 'no-assets' }
    }

    const childProcess = execa(
      this.binaryName,
      ['dev-server'].concat(this.encoreArgs),
      this.execaOptions
    )

    childProcess.stdout?.on('data', (line: Buffer) => this.log(line))
    childProcess.stderr?.on('data', (line: Buffer) => this.logError(line))
    childProcess.on('close', (code, signal) => this.emit('close', { code, signal }))
    childProcess.on('exit', (code, signal) => this.emit('exit', { code, signal }))

    return { state: 'running' }
  }
}
