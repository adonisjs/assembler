/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import slash from 'slash'
import { join, extname } from 'path'
import { args, flags } from '@adonisjs/ace'

import { BaseGenerator } from './Base'
import { ADONIS_ACE_CWD } from '../../config/env'

/**
 * Command to make a new preloaded file
 */
export default class MakePreloadFile extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected resourceName: string

  /**
   * List of allowed environments
   */
  private allowedEnvironments = ['console', 'web', 'test']

  /**
   * Command meta data
   */
  public static commandName = 'make:prldfile'
  public static description = 'Make a new preloaded file. Preloaded files are loaded automatically on boot'

  @args.string({ description: 'Name of the file' })
  public name: string

  @flags.string({
    description: 'Explicitly define the environment in which you want to load this file',
  })
  public environment: string

  /**
   * Returns the environments for the preloaded file
   */
  private async getEnvironments (): Promise<string[]> {
    if (this.environment) {
      return this.environment.split(',')
    }

    return this.prompt.multiple('Select the environment(s) in which you want to load this file', [
      {
        name: 'console',
        message: 'During ace commands',
      },
      {
        name: 'web',
        message: 'During HTTP server',
      },
    ])
  }

  /**
   * Validates environments to ensure they are allowed. Especially when
   * define as a flag.
   */
  private validateEnvironments (
    environments: string[],
  ): environments is ('console' | 'web' | 'test')[] {
    return !environments.find((environment) => !this.allowedEnvironments.includes(environment))
  }

  /**
   * Returns the template stub path
   */
  protected getStub (): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      'preload-file.txt',
    )
  }

  /**
   * Path to the start directory
   */
  protected getDestinationPath (): string {
    return this.application.rcFile.directories.start || 'start'
  }

  public async handle () {
    const environments = await this.getEnvironments()

    /**
     * Show error when defined environments are invalid
     */
    if (!this.validateEnvironments(environments)) {
      this.logger.error(
        `Invalid environments "${environments}". Only "${this.allowedEnvironments}" are allowed`,
      )
      return
    }

    /**
     * Generate resource file
     */
    this.resourceName = this.name
    const file = await super.generate()

    if (!file) {
      return
    }

    /**
     * Update preload file
     */
    const { files } = await import('@adonisjs/sink')
    const relativePath = file.toJSON().relativepath
    const rcFile = new files.AdonisRcFile(ADONIS_ACE_CWD()!)

    rcFile.setPreload(`./${slash(relativePath).replace(extname(relativePath), '')}`, environments)
    rcFile.commit()
  }
}
