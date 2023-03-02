/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { execaNode, execa } from 'execa'
import type { RunOptions } from './types.js'

/**
 * Default set of args to pass in order to run TypeScript
 * source
 */
const DEFAULT_NODE_ARGS = [
  // Use ts-node/esm loader. The project must install it
  '--loader=ts-node/esm',
  // Disable annonying warnings
  '--no-warnings',
  // Enable expiremental meta resolve for cases where someone uses magic import string
  '--experimental-import-meta-resolve',
]

/**
 * Runs a Node.js script as a child process and inherits the stdio streams
 */
export function runNode(cwd: string | URL, options: RunOptions) {
  const childProces = execaNode(options.script, options.scriptArgs, {
    nodeOptions: DEFAULT_NODE_ARGS.concat(options.nodeArgs),
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    buffer: false,
    stdio: 'inherit',
    env: options.env,
  })

  return childProces
}

/**
 * Runs a script as a child process and inherits the stdio streams
 */
export function run(cwd: string | URL, options: Omit<RunOptions, 'nodeArgs'>) {
  const childProces = execa(options.script, options.scriptArgs, {
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    buffer: false,
    stdio: 'inherit',
    env: options.env,
  })

  return childProces
}
