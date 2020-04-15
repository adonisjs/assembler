/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { join } from 'path'
import { pathExists } from 'fs-extra'
import { BaseCommand } from '@adonisjs/ace'
import { GeneratorFile } from '@adonisjs/ace/build/src/Generator/File'

import { ADONIS_ACE_CWD } from '../../config/env'

/**
 * Base class to generate framework entities
 */
export abstract class BaseGenerator extends BaseCommand {
  protected abstract resourceName: string
  protected abstract getStub (): string
  protected abstract getDestinationPath (): string

  protected suffix?: string
  protected extname: string = '.ts'
  protected form?: 'singular' | 'plural'
  protected pattern?: 'camelcase' | 'snakecase' | 'pascalcase'
  protected formIgnoreList?: string[]
  protected templateData (): any {
    return {}
  }

  /**
   * Returns path for a given namespace by replacing the base namespace
   * with the defined directories map inside the `.adonisrc.json`
   * file
   */
  protected getPathForNamespace (namespaceFor: string): string | null {
    return this.application.resolveNamespaceDirectory(namespaceFor)
  }

  /**
   * Returns contents of the rcFile
   */
  protected async hasRcFile (cwd: string) {
    const filePath = join(cwd, '.adonisrc.json')
    return pathExists(filePath)
  }

  /**
   * Handle command
   */
  public async generate (): Promise<GeneratorFile | undefined> {
    const cwd = ADONIS_ACE_CWD()
    if (!cwd) {
      const commandName = this.constructor['commandName']
      this.logger.error(
        `Cannot run "${commandName}". Make sure you running this command as "node ace ${commandName}"`,
      )
      return
    }

    const hasRcFile = await this.hasRcFile(cwd)

    /**
     * Ensure `.adonisrc.json` file exists
     */
    if (!hasRcFile) {
      this.logger.error('Make sure your project root has ".adonisrc.json" file')
      return
    }

    const file = this
      .generator
      .addFile(this.resourceName, {
        form: this.form,
        suffix: this.suffix,
        formIgnoreList: this.formIgnoreList,
        pattern: this.pattern,
        extname: this.extname,
      })
      .stub(this.getStub())
      .useMustache()
      .destinationDir(this.getDestinationPath())
      .appRoot(cwd)
      .apply(this.templateData())

    await this.generator.run()
    return file
  }
}
