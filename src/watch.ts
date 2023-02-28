/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type tsStatic from 'typescript'
import { fileURLToPath } from 'node:url'
import { ConfigParser, Watcher } from '@poppinss/chokidar-ts'

import type { WatchOptions } from './types.js'

/**
 * Watches the file system using tsconfig file
 */
export function watch(cwd: string | URL, ts: typeof tsStatic, options: WatchOptions) {
  /**
   * Parsing config to get a list of includes, excludes and initial
   * set of files
   */
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

  const watcher = new Watcher(typeof cwd === 'string' ? cwd : fileURLToPath(cwd), config!)
  const chokidar = watcher.watch(['.'], { usePolling: options.poll })
  return { watcher, chokidar }
}
