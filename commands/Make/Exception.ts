/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

import { join } from 'path'
import { args, flags } from '@adonisjs/ace'
import { RcFile } from '@ioc:Adonis/Core/Application'
import { BaseGenerator } from './Base'

/**
 * Command to make a new event exceptions class
 */
export default class MakeException extends BaseGenerator {
  /**
   * Required by BaseGenerator
   */
  protected $form = 'singular' as const
  protected $pattern = 'pascalcase' as const
  protected $resourceName: string
  protected $suffix = 'Exception'

  /**
   * Command meta data
   */
  public static commandName = 'make:exception'
  public static description = 'Make a new exception handle'

  @args.string({ description: 'Name of the exception class' })
  public name: string

  @flags.boolean({ description: 'Add handle method to self handle the exception' })
  public selfHandle: boolean

  /**
   * Returns the template stub
   */
  protected $getStub (): string {
    return join(
      __dirname,
      '..',
      '..',
      'templates',
      this.selfHandle ? 'self-handle-exception.txt' : 'exception.txt',
    )
  }

  /**
   * Pull path from the `exceptions` namespace declaration from
   * the `.adonisrc.json` file or fallback to `app/Exceptions`
   */
  protected $getDestinationPath (rcContents: RcFile): string {
    return this.$getPathForNamespace(rcContents, 'exceptions') || 'app/Exceptions'
  }

  public async handle () {
    this.$resourceName = this.name
    await super.generate()
  }
}
