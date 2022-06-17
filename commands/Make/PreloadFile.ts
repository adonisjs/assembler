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
import { args, flags } from '@adonisjs/core/build/standalone'

import { BaseGenerator } from './Base'
import type { AppEnvironments } from '@ioc:Adonis/Core/Application'

const ALLOWED_ENVIRONMENTS: AppEnvironments[] = ['console', 'web', 'repl', 'test']

/**
 * Command to make a new preloaded file
 */
export default class MakePreloadFile extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected resourceName: string
  protected createExact = true

  /**
   * Command name
   */
  public static commandName = 'make:prldfile'

  /**
   * Command description
   */
  public static description = 'Make a new preload file'

  @args.string({ description: 'Name of the file' })
  public name: string

  @flags.array({
    description: `Define the preload file environment. Accepted values "${ALLOWED_ENVIRONMENTS}"`,
  })
  public environment: AppEnvironments[]

  /**
   * Check if the mentioned environments are valid
   */
  private isValidEnviroment(environment: string[]): environment is AppEnvironments[] {
    return !environment.find((one) => !ALLOWED_ENVIRONMENTS.includes(one as any))
  }

  /**
   * Returns the template stub path
   */
  protected getStub(): string {
    return join(__dirname, '..', '..', 'templates', 'preload-file.txt')
  }

  /**
   * Path to the start directory
   */
  protected getDestinationPath(): string {
    return this.application.rcFile.directories.start || 'start'
  }

  /**
   * Run command
   */
  public async run() {
    /**
     * Ensure the environments are valid when provided via flag
     */
    if (this.environment && this.environment.length && !this.isValidEnviroment(this.environment)) {
      this.logger.error(
        `Invalid environment(s) "${this.environment}". Only "${ALLOWED_ENVIRONMENTS}" are allowed`
      )
      return
    }

    let environments: string[] = this.environment

    /**
     * Prompt user to select one or more environments
     */
    if (!environments) {
      environments = await this.prompt.multiple(
        'Select the environment(s) in which you want to load this file',
        [
          {
            name: 'all',
            message: 'Load file in all environments',
          },
          {
            name: 'console',
            message: 'Environment for ace commands',
          },
          {
            name: 'repl',
            message: 'Environment for the REPL session',
          },
          {
            name: 'web',
            message: 'Environment for HTTP requests',
          },
          {
            name: 'test',
            message: 'Environment for the test process',
          },
        ]
      )
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
    const rcFile = new files.AdonisRcFile(this.application.appRoot)

    if (!environments || !environments.length || environments.includes('all')) {
      rcFile.setPreload(`./${slash(relativePath).replace(extname(relativePath), '')}`)
    } else {
      rcFile.setPreload(
        `./${slash(relativePath).replace(extname(relativePath), '')}`,
        environments as AppEnvironments[]
      )
    }

    rcFile.commit()
  }
}
