/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { args, flags } from '@adonisjs/core/build/standalone'
import { BaseGenerator } from './Base'

/**
 * Command to make a new Factory
 */
export default class MakeFactory extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected suffix = 'Factory'
  protected pattern = 'pascalcase' as const
  protected resourceName: string
  protected createExact: boolean

  /**
   * Command meta data
   */
  public static commandName = 'make:factory'
  public static description = 'Make a new factory'

  /**
   * Name of the model to be used in the factory
   */
  @args.string({ description: 'The name of the model' })
  public model: string

  /**
   * Import path to the model used in the factory
   */
  @flags.string({ description: 'The path to the model' })
  public modelPath: string

  @flags.boolean({
    description: 'Create the factory with the exact name as provided',
    alias: 'e',
  })
  public exact: boolean

  /**
   * Generate model import path used in the factory
   */
  private generateModelImportPath() {
    let base = this.application.rcFile.namespaces.models || 'App/Models'
    if (!base.endsWith('/')) {
      base += '/'
    }

    let importPath = this.model
    if (this.modelPath) {
      importPath = this.modelPath
    } else if (importPath.endsWith('Factory')) {
      importPath = importPath.replace(/Factory$/, '')
    }

    if (importPath.startsWith(base)) {
      return importPath
    }

    return base + importPath
  }

  /**
   * Returns the template stub path
   */
  protected getStub() {
    return join(__dirname, '..', '..', 'templates', 'factory.txt')
  }

  /**
   * Path to the factories directory
   */
  protected getDestinationPath() {
    const base = this.application.rcFile.directories.database || 'database'
    return join(base, 'factories')
  }

  /**
   * Passed down to the stub template
   */
  protected templateData() {
    return {
      model: this.model,
      modelImportPath: this.generateModelImportPath(),
      toModelName: () => {
        return function (model: string, render: any) {
          return render(model).split('/').pop()
        }
      },
    }
  }

  public async run() {
    this.resourceName = this.model
    this.createExact = this.exact
    await super.generate()
  }
}
