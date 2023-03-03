/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type tsStatic from 'typescript'
import { ConfigParser } from '@poppinss/chokidar-ts'

/**
 * Parses tsconfig.json and prints errors using typescript compiler
 * host
 */
export function parseConfig(cwd: string | URL, ts: typeof tsStatic) {
  const { config, error } = new ConfigParser(cwd, 'tsconfig.json', ts).parse()
  if (error) {
    const compilerHost = ts.createCompilerHost({})
    console.log(ts.formatDiagnosticsWithColorAndContext([error], compilerHost))
    return
  }

  if (config!.errors.length) {
    const compilerHost = ts.createCompilerHost({})
    console.log(ts.formatDiagnosticsWithColorAndContext(config!.errors, compilerHost))
    return
  }

  return config
}
