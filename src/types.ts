/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Options needed to run a script file
 */
export type RunOptions = {
  script: string
  scriptArgs: string[]
  nodeArgs: string[]
  env?: NodeJS.ProcessEnv
}

/**
 * Watcher options
 */
export type WatchOptions = {
  poll?: boolean
}

/**
 * Options accepted by the dev server
 */
export type DevServerOptions = {
  scriptArgs: string[]
  nodeArgs: string[]
  clearScreen?: boolean
  env?: NodeJS.ProcessEnv
  metaFiles?: {
    pattern: string
    reloadServer: boolean
  }[]
}

/**
 * Options accepted by the project bundler
 */
export type BundlerOptions = {
  metaFiles?: {
    pattern: string
    reloadServer: boolean
  }[]
}
