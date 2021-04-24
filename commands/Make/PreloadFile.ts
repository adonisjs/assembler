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
   * List of allowed environments
   */
  private allowedEnvironments = ['console', 'web', 'repl']

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

  @flags.string({
    description: 'Define the environment in which you want to load this file',
  })
  public environment: ('console' | 'web' | 'repl')[]

  /**
   * Validates environments to ensure they are allowed. Especially when
   * defined as a flag.
   */
  private validateEnvironments(
    environments: string[]
  ): environments is ('console' | 'web' | 'repl')[] {
    return !environments.find((environment) => !this.allowedEnvironments.includes(environment))
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

  public async prepare() {
    this.environment = await this.prompt.multiple(
      'Select the environment(s) in which you want to load this file',
      [
        {
          name: 'console',
          message: 'During ace commands',
        },
        {
          name: 'repl',
          message: 'During repl session',
        },
        {
          name: 'web',
          message: 'During HTTP server',
        },
      ],
      {
        validate(choices) {
          return choices && choices.length ? true : 'Use space to select the environment'
        },
      }
    )
  }

  /**
   * Run command
   */
  public async run() {
    const environments =
      typeof this.environment === 'string'
        ? (this.environment as string).split(',')
        : this.environment

    /**
     * Show error when defined environments are invalid
     */
    if (!this.validateEnvironments(environments)) {
      this.logger.error(
        `Invalid environments "${environments}". Only "${this.allowedEnvironments}" are allowed`
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
    const rcFile = new files.AdonisRcFile(this.application.appRoot)

    if (environments && environments.length) {
      rcFile.setPreload(`./${slash(relativePath).replace(extname(relativePath), '')}`, environments)
    } else {
      rcFile.setPreload(`./${slash(relativePath).replace(extname(relativePath), '')}`)
    }

    rcFile.commit()
  }
}
