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
import { RcFile } from '@ioc:Adonis/Core/Application'
import { rcParser } from '@adonisjs/application/build/standalone'

import { ADONIS_ACE_CWD } from '../../config/env'

/**
 * Base class to generate framework entities
 */
export abstract class BaseGenerator extends BaseCommand {
  protected abstract $resourceName: string
  protected abstract $getStub (rcContents: RcFile): string
  protected abstract $getDestinationPath (rcContents: RcFile): string

  protected $suffix?: string
  protected $extname: string = '.ts'
  protected $form?: 'singular' | 'plural'
  protected $pattern?: 'camelcase' | 'snakecase' | 'pascalcase'
  protected $formIgnoreList?: string[]
  protected $templateData (_rcContents: RcFile): any {
    return {}
  }

  /**
   * Returns path for a given namespace by replacing the base namespace
   * with the defined directories map inside the `.adonisrc.json`
   * file
   */
  protected $getPathForNamespace (rcContents: RcFile, namespaceFor: string): string | null {
    /**
     * Return null when rcfile doesn't have a special
     * entry for namespaces
    */
    if (!rcContents.namespaces[namespaceFor]) {
      return null
    }

    let output: string | null = null
    Object.keys(rcContents.aliases).forEach((baseNamespace) => {
      const autoloadPath = rcContents.aliases[baseNamespace]
      if (rcContents.namespaces[namespaceFor].startsWith(`${baseNamespace}/`)) {
        output = rcContents.namespaces[namespaceFor].replace(baseNamespace, autoloadPath)
      }
      return output
    })

    return output
  }

  /**
   * Returns contents of the rcFile
   */
  protected async $getRcContents (cwd: string) {
    const filePath = join(cwd, '.adonisrc.json')
    const hasRcFile = await pathExists(filePath)
    if (!hasRcFile) {
      return null
    }

    return rcParser.parse(require(filePath))
  }

  /**
   * Handle command
   */
  public async handle () {
    const cwd = ADONIS_ACE_CWD()
    if (!cwd) {
      const commandName = this.constructor['commandName']
      this.logger.error(
        `Cannot run "${commandName}". Make sure you running this command as "node ace ${commandName}"`,
      )
      return
    }

    const rcContents = await this.$getRcContents(cwd)

    /**
     * Ensure `.adonisrc.json` file exists
     */
    if (!rcContents) {
      this.logger.error('Make sure your project root has .adonisrc.json file to continue')
      return
    }

    this.generator
      .addFile(this.$resourceName, {
        form: this.$form,
        suffix: this.$suffix,
        formIgnoreList: this.$formIgnoreList,
        pattern: this.$pattern,
        extname: this.$extname,
      })
      .stub(this.$getStub(rcContents))
      .destinationDir(this.$getDestinationPath(rcContents))
      .appRoot(cwd)
      .apply(this.$templateData(rcContents))

    await this.generator.run()
  }
}
