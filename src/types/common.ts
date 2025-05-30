/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import {
  type BundlerHooks,
  type DevServerHooks,
  type TestRunnerHooks,
  type WatcherHooks,
} from './hooks.ts'

/**
 * File inspected by the filesystem based upon the provided globs
 * and the current file path
 */
export type InspectedFile = {
  fileType: 'script' | 'meta' | 'test'
  reloadServer: boolean
  unixRelativePath: string
  unixAbsolutePath: string
}

/**
 * Subset of properties assembler needs from the "adonisrc.ts" file.
 */
export type AssemblerRcFile = {
  /**
   * An array of metaFiles glob patterns to watch
   */
  metaFiles?: {
    pattern: string
    reloadServer: boolean
  }[]

  /**
   * Hooks to execute at different stages.
   */
  hooks?: Partial<WatcherHooks & DevServerHooks & BundlerHooks & TestRunnerHooks>

  /**
   * An array of suites for which to run tests
   */
  suites?: {
    name: string
    files: string | string[]
  }[]
}

/**
 * Options needed to run a script file
 */
export type RunScriptOptions = {
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

  /**
   * Whether or not to reject the promise. Defaults
   * false
   */
  reject?: boolean
}

/**
 * Options accepted when starting the dev server
 */
export type DevServerOptions = {
  /**
   * If the dev server should use HMR.
   *
   * Default:true
   */
  hmr?: boolean

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
} & AssemblerRcFile

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
} & AssemblerRcFile

/**
 * Options accepted by the project bundler
 */
export type BundlerOptions = AssemblerRcFile
