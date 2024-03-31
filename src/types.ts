/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { RcFile } from '@adonisjs/application/types'

/**
 * Options needed to run a script file
 */
export type RunOptions = {
  /**
   * Script to run
   */
  script: string

  /**
   * Arguments to pass to the script
   */
  scriptArgs: string[]

  /**
   * Arguments to pass to NodeJS CLI
   */
  nodeArgs: string[]

  /**
   * Standard input ouput stream options
   */
  stdio?: 'pipe' | 'inherit'

  /**
   * Environment variables to pass to the child process
   */
  env?: NodeJS.ProcessEnv
}

/**
 * Watcher options
 */
export type WatchOptions = {
  poll?: boolean
}

/**
 * Meta file config defined in "adonisrc.ts" file
 */
export type MetaFile = {
  pattern: string
  reloadServer: boolean
}

/**
 * Test suite defined in "adonisrc.ts" file
 */
export type Suite = {
  name: string
  files: string | string[]
}

/**
 * Options accepted by assets bundler
 */
export type AssetsBundlerOptions =
  | {
      enabled: false
      driver?: string
      cmd?: string
      args?: string[]
    }
  | {
      enabled: true
      driver: string
      cmd: string
      args: string[]
    }

/**
 * Options accepted when starting the dev
 * server
 */
export type DevServerOptions = {
  /**
   * Arguments to pass to the "bin/server.js" file
   * executed a child process
   */
  scriptArgs: string[]

  /**
   * Arguments to pass to Node.js CLI when executing
   * the "bin/server.js" file
   */
  nodeArgs: string[]

  /**
   * Clear screen after every file change
   */
  clearScreen?: boolean

  /**
   * Environment variables to share with the "bin/server.js"
   * file.
   */
  env?: NodeJS.ProcessEnv

  /**
   * An array of metaFiles glob patterns to watch
   */
  metaFiles?: MetaFile[]

  /**
   * Assets bundler options to start its dev server
   */
  assets?: AssetsBundlerOptions
  /**
   * Hooks to execute at different stages
   */
  hooks?: Pick<
    NonNullable<RcFile['unstable_assembler']>,
    'onDevServerStarted' | 'onSourceFileChanged' | 'onHttpServerMessage'
  >
}

/**
 * Options accepted by the test runner
 */
export type TestRunnerOptions = {
  /**
   * Arguments to pass to the "bin/server.js" file
   * executed a child process
   */
  scriptArgs: string[]

  /**
   * Arguments to pass to Node.js CLI when executing
   * the "bin/server.js" file
   */
  nodeArgs: string[]

  /**
   * Clear screen after every file change
   */
  clearScreen?: boolean

  /**
   * Environment variables to share with the "bin/server.js"
   * file.
   */
  env?: NodeJS.ProcessEnv

  /**
   * An array of metaFiles glob patterns to watch
   */
  metaFiles?: MetaFile[]

  /**
   * Assets bundler options to start its dev server
   */
  assets?: AssetsBundlerOptions

  /**
   * An array of suites for which to run tests
   */
  suites: Suite[]

  /**
   * Set the tests runner reporter via the CLI flag
   */
  reporters?: string[]

  /**
   * Set the tests global timeout via the CLI flag
   */
  timeout?: number

  /**
   * Define retries via the CLI flag
   */
  retries?: number

  /**
   * Run only failed tests
   */
  failed?: boolean

  /**
   * Filter arguments are provided as a key-value
   * pair, so that we can mutate them (if needed)
   */
  filters: Partial<{
    tests: string[]
    suites: string[]
    groups: string[]
    files: string[]
    tags: string[]
  }>
}

/**
 * Options accepted by the project bundler
 */
export type BundlerOptions = {
  /**
   * An array of metaFiles glob patterns to copy the
   * files to the build folder
   */
  metaFiles?: MetaFile[]

  /**
   * Assets bundler options to create the production build
   * for assets
   */
  assets?: AssetsBundlerOptions

  /**
   * Hooks to execute at different stages
   */
  hooks?: Pick<NonNullable<RcFile['unstable_assembler']>, 'onBuildCompleted' | 'onBuildStarting'>
}

/**
 * Entry to add a middleware to a given middleware stack
 * via the CodeTransformer
 */
export type MiddlewareNode = {
  /**
   * If you are adding a named middleware, then you must
   * define the name.
   */
  name?: string

  /**
   * The path to the middleware file
   *
   * @example
   *  `@adonisjs/static/static_middleware`
   *  `#middlewares/silent_auth.js`
   */
  path: string

  /**
   * The position to add the middleware. If `before`
   * middleware will be added at the first position and
   * therefore will be run before all others
   *
   * @default 'after'
   */
  position?: 'before' | 'after'
}

/**
 * Policy node to be added to the list of policies.
 */
export type BouncerPolicyNode = {
  /**
   * Policy name
   */
  name: string

  /**
   * Policy import path
   */
  path: string
}

/**
 * Defines the structure of an environment variable validation
 * definition
 */
export type EnvValidationNode = {
  /**
   * Write a leading comment on top of your variables
   */
  leadingComment?: string

  /**
   * A key-value pair of env variables and their validation
   *
   * @example
   *  MY_VAR: 'Env.schema.string.optional()'
   */
  variables: Record<string, string>
}
