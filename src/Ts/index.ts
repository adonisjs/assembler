/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import tsStatic from 'typescript'
import { logger as uiLogger } from '@poppinss/cliui'
import { TypescriptCompiler } from '@poppinss/chokidar-ts'
import { resolveFrom } from '@poppinss/utils/build/helpers'

import { TSCONFIG_FILE_NAME, DEFAULT_BUILD_DIR } from '../../config/paths'

/**
 * Exposes the API to work with the Typescript compiler API
 */
export class Ts {
  /**
   * Reference to the typescript compiler
   */
  public tsCompiler = new TypescriptCompiler(
    this.appRoot,
    TSCONFIG_FILE_NAME,
    require(resolveFrom(this.appRoot, 'typescript/lib/typescript'))
  )

  constructor(private appRoot: string, private logger: typeof uiLogger) {}

  /**
   * Render ts diagnostics
   */
  public renderDiagnostics(diagnostics: tsStatic.Diagnostic[], host: tsStatic.CompilerHost) {
    console.error(this.tsCompiler.ts.formatDiagnosticsWithColorAndContext(diagnostics, host))
  }

  /**
   * Parses the tsconfig file
   */
  public parseConfig(): undefined | tsStatic.ParsedCommandLine {
    const { error, config } = this.tsCompiler.configParser().parse()

    if (error) {
      this.logger.error(`unable to parse ${TSCONFIG_FILE_NAME}`)
      this.renderDiagnostics([error], this.tsCompiler.ts.createCompilerHost({}))
      return
    }

    if (config && config.errors.length) {
      this.logger.error(`unable to parse ${TSCONFIG_FILE_NAME}`)
      this.renderDiagnostics(config.errors, this.tsCompiler.ts.createCompilerHost(config.options))
      return
    }

    config!.options.rootDir = config!.options.rootDir || this.appRoot
    config!.options.outDir = config!.options.outDir || join(this.appRoot, DEFAULT_BUILD_DIR)
    return config
  }
}
