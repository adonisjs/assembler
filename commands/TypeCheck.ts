/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import { TSCONFIG_FILE_NAME } from '../config/paths'

/**
 * TypeCheck project without writing the compiled output to the disk
 */
export default class TypeCheck extends BaseCommand {
  public static commandName = 'type-check'
  public static description =
    'Type check TypeScript source without writing the compiled output on disk'

  /**
   * Path to the TypeScript project configuration file. Defaults to "tsconfig.json"
   */
  @flags.string({
    description: 'Path to the TypeScript project configuration file',
  })
  public tsconfig: string = TSCONFIG_FILE_NAME

  /**
   * Invoked automatically by ace
   */
  public async run() {
    const { Compiler } = await import('../src/Compiler')

    try {
      const compiler = new Compiler(this.application, [], false, this.logger, this.tsconfig)
      const success = await compiler.typeCheck()

      /**
       * Set exitCode based upon the typecheck status
       */
      if (!success) {
        this.exitCode = 1
      }
    } catch (error) {
      this.logger.fatal(error)
      this.exitCode = 1
    }
  }
}
