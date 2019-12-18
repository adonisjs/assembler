/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { args } from '@adonisjs/ace'
import { join, extname } from 'path'
import { RcFile as SinkRcFile } from '@adonisjs/sink'
import { RcFile } from '@ioc:Adonis/Core/Application'

import { BaseGenerator } from './Base'
import { ADONIS_ACE_CWD } from '../../config/env'

/**
 * Command to make a new provider
 */
export default class MakeProvider extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected $suffix = 'Provider'
  protected $form = 'singular' as const
  protected $pattern = 'pascalcase' as const
  protected $resourceName: string

  /**
   * Command meta data
   */
  public static commandName = 'make:provider'
  public static description = 'Make a new IoC container provider'

  @args.string({ description: 'Make of the provider class' })
  public name: string

  /**
   * Returns the template stub path
   */
  protected $getStub (): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      'provider.txt',
    )
  }

  /**
   * Path to the providers directory
   */
  protected $getDestinationPath (rcFile: RcFile): string {
    return rcFile.directories.providers || 'providers'
  }

  public async handle () {
    this.$resourceName = this.name
    const file = await super.generate()

    if (!file) {
      return
    }

    const relativePath = file.toJSON().relativepath
    const rcFile = new SinkRcFile(ADONIS_ACE_CWD()!)
    rcFile.addProvider(`./${relativePath.replace(extname(relativePath), '')}`)
    rcFile.commit()
  }
}
