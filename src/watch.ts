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
import { Watcher } from '@poppinss/chokidar-ts'

import type { WatchOptions } from './types.js'
import { parseConfig } from './parse_config.js'

/**
 * Watches the file system using tsconfig file
 */
export function watch(cwd: string | URL, ts: typeof tsStatic, options: WatchOptions) {
  const config = parseConfig(cwd, ts)
  if (!config) {
    return
  }

  const watcher = new Watcher(typeof cwd === 'string' ? cwd : fileURLToPath(cwd), config!)
  const chokidar = watcher.watch(['.'], { usePolling: options.poll })
  return { watcher, chokidar }
}
