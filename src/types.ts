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
 * Test suite defined in ".adonisrc.json" file
 */
export type Suite = {
  files: string | string[]
  name: string
}

/**
 * Options accepted by assets bundler
 */
export type AssetsBundlerOptions =
  | {
      serve: false
      args?: string[]
      driver?: string
      cmd?: string
    }
  | {
      serve: true
      args: string[]
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
 * Options accepted by the test runner
 */
export type TestRunnerOptions = {
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

  reporters?: string[]
  timeout?: number
  retries?: number
  failed?: boolean

  /**
   * All other tags are provided as a collection of
   * arguments
   */
  scriptArgs: string[]
  nodeArgs: string[]
  clearScreen?: boolean
  env?: NodeJS.ProcessEnv
  metaFiles?: MetaFile[]
  assets?: AssetsBundlerOptions
  suites: Suite[]
}

/**
 * Options accepted by the project bundler
 */
export type BundlerOptions = {
  metaFiles?: MetaFile[]
  assets?: AssetsBundlerOptions
}

/**
 * Entry to add a middleware to a given middleware stack
 * via the CodeTransformer
 */
export type AddMiddlewareEntry = {
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
 * Defines the structure of an environment variable validation
 * definition
 */
export type EnvValidationDefinition = {
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
