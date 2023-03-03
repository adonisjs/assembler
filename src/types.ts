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
  stdio?: 'pipe' | 'inherit'
  env?: NodeJS.ProcessEnv
}

/**
 * Watcher options
 */
export type WatchOptions = {
  poll?: boolean
}

/**
 * Meta file config defined in ".adonisrc.json" file
 */
export type MetaFile = {
  pattern: string
  reloadServer: boolean
}

/**
 * Options accepted by assets bundler
 */
export type AssetsBundlerOptions =
  | {
      serve: false
      driver?: string
      cmd?: string
    }
  | {
      serve: true
      driver: string
      cmd: string
    }

/**
 * Options accepted by the dev server
 */
export type DevServerOptions = {
  scriptArgs: string[]
  nodeArgs: string[]
  clearScreen?: boolean
  env?: NodeJS.ProcessEnv
  metaFiles?: MetaFile[]
  assets?: AssetsBundlerOptions
}

/**
 * Options accepted by the project bundler
 */
export type BundlerOptions = {
  metaFiles?: MetaFile[]
  assets?: AssetsBundlerOptions
}
