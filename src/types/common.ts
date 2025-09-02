/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Logger } from '@poppinss/cliui'
import { type Prettify } from '@poppinss/utils/types'
import {
  type BundlerHooks,
  type DevServerHooks,
  type TestRunnerHooks,
  type WatcherHooks,
} from './hooks.ts'

/**
 * Marks a given optional property as required
 *
 * @template T - The source type
 * @template K - The keys from T that should be made required
 *
 * @example
 * type User = { name?: string; email?: string; age: number }
 * type UserWithName = AsRequired<User, 'name'> // { name: string; email?: string; age: number }
 */
export type AsRequired<T, K extends keyof T> = Prettify<
  Omit<T, K> &
    Required<{
      [O in K]: T[K]
    }>
>

/**
 * Represents an import statement parsed from TypeScript/JavaScript code
 *
 * @example
 * // For: import { User } from './models/user'
 * const importInfo: Import = {
 *   specifier: './models/user',
 *   isConstant: true,
 *   clause: { type: 'named', value: 'User' }
 * }
 */
export type Import = {
  /** The module specifier being imported from */
  specifier: string
  /** Whether the import specifier is a constant string literal */
  isConstant: boolean
  /** The import clause details */
  clause: {
    /** The type of import clause */
    type: 'namespace' | 'default' | 'named'
    /** The imported identifier name */
    value: string
    /** Optional alias for named imports with 'as' keyword */
    alias?: string
  }
}

/**
 * File inspected by the filesystem based upon the provided globs
 * and the current file path
 *
 * @example
 * const inspectedFile: InspectedFile = {
 *   fileType: 'script',
 *   reloadServer: true,
 *   unixRelativePath: 'app/controllers/users_controller.ts',
 *   unixAbsolutePath: '/project/app/controllers/users_controller.ts'
 * }
 */
export type InspectedFile = {
  /** The category of the file based on its purpose */
  fileType: 'script' | 'meta' | 'test'
  /** Whether changes to this file should trigger server reload */
  reloadServer: boolean
  /** Unix-style relative path from project root */
  unixRelativePath: string
  /** Unix-style absolute path to the file */
  unixAbsolutePath: string
}

/**
 * Subset of properties assembler needs from the "adonisrc.ts" file.
 * Contains configuration for file watching, hooks, and test suites.
 *
 * @example
 * const rcFile: AssemblerRcFile = {
 *   metaFiles: [
 *     { pattern: 'config/**', reloadServer: true }
 *   ],
 *   hooks: {
 *     devServerStarted: [() => import('./hooks/server_started')]
 *   },
 *   suites: [
 *     { name: 'unit', files: ['tests/unit/**\/*.spec.ts'] }
 *   ]
 * }
 */
export type AssemblerRcFile = {
  /**
   * An array of metaFiles glob patterns to watch for changes
   */
  metaFiles?: {
    /** Glob pattern to match files */
    pattern: string
    /** Whether to reload server when these files change */
    reloadServer: boolean
  }[]

  /**
   * Hooks to execute at different stages of development and build processes
   */
  hooks?: Partial<WatcherHooks & DevServerHooks & BundlerHooks & TestRunnerHooks>

  /**
   * An array of test suites configuration
   */
  suites?: {
    /** Name of the test suite */
    name: string
    /** Glob pattern(s) for test files in this suite */
    files: string | string[]
  }[]
}

/**
 * Options needed to run a script file as a child process
 *
 * @example
 * const options: RunScriptOptions = {
 *   script: 'bin/server.ts',
 *   scriptArgs: ['--watch'],
 *   nodeArgs: ['--loader', 'ts-node/esm'],
 *   stdio: 'inherit',
 *   env: { NODE_ENV: 'development' },
 *   reject: true
 * }
 */
export type RunScriptOptions = {
  /** Path to the script file to run */
  script: string

  /** Arguments to pass to the script */
  scriptArgs: string[]

  /** Arguments to pass to the Node.js CLI */
  nodeArgs: string[]

  /** Standard input/output stream options */
  stdio?: 'pipe' | 'inherit'

  /** Environment variables to pass to the child process */
  env?: NodeJS.ProcessEnv

  /** Whether to reject the promise on script failure (defaults to false) */
  reject?: boolean
}

/**
 * Options accepted when starting the development server
 *
 * @example
 * const devOptions: DevServerOptions = {
 *   hmr: true,
 *   scriptArgs: [],
 *   nodeArgs: ['--inspect'],
 *   clearScreen: true,
 *   env: { DEBUG: 'adonis:*' },
 *   hooks: {
 *     devServerStarted: [() => import('./dev_hooks')]
 *   }
 * }
 */
export type DevServerOptions = {
  /**
   * Whether the dev server should use Hot Module Replacement (HMR)
   * @default true
   */
  hmr?: boolean

  /**
   * Arguments to pass to the "bin/server.js" file executed as a child process
   */
  scriptArgs: string[]

  /**
   * Arguments to pass to Node.js CLI when executing the "bin/server.js" file
   */
  nodeArgs: string[]

  /**
   * Whether to clear screen after every file change
   */
  clearScreen?: boolean

  /**
   * Environment variables to share with the "bin/server.js" file
   */
  env?: NodeJS.ProcessEnv
} & AssemblerRcFile

/**
 * Options accepted by the test runner for configuring test execution
 *
 * @example
 * const testOptions: TestRunnerOptions = {
 *   scriptArgs: ['--reporter', 'spec'],
 *   nodeArgs: ['--max-old-space-size=4096'],
 *   clearScreen: true,
 *   reporters: ['spec', 'json'],
 *   timeout: 30000,
 *   retries: 2,
 *   failed: false,
 *   filters: {
 *     suites: ['unit', 'integration'],
 *     tags: ['@slow']
 *   }
 * }
 */
export type TestRunnerOptions = {
  /**
   * Arguments to pass to the test script file executed as a child process
   */
  scriptArgs: string[]

  /**
   * Arguments to pass to Node.js CLI when executing the test script
   */
  nodeArgs: string[]

  /**
   * Whether to clear screen after every file change
   */
  clearScreen?: boolean

  /**
   * Environment variables to share with the test script
   */
  env?: NodeJS.ProcessEnv

  /**
   * Test reporters to use (e.g., 'spec', 'json', 'tap')
   */
  reporters?: string[]

  /**
   * Global timeout for tests in milliseconds
   */
  timeout?: number

  /**
   * Number of times to retry failed tests
   */
  retries?: number

  /**
   * Whether to run only previously failed tests
   */
  failed?: boolean

  /**
   * Filter options for controlling which tests to run
   */
  filters: Partial<{
    /** Specific test names to run */
    tests: string[]
    /** Test suite names to run */
    suites: string[]
    /** Test group names to run */
    groups: string[]
    /** Specific test file patterns to run */
    files: string[]
    /** Test tags to filter by */
    tags: string[]
  }>
} & AssemblerRcFile

/**
 * Options accepted by the project bundler for production builds
 * Extends AssemblerRcFile to inherit hooks and meta files configuration
 *
 * @example
 * const bundlerOptions: BundlerOptions = {
 *   hooks: {
 *     buildStarting: [() => import('./build_hooks')]
 *   },
 *   metaFiles: [
 *     { pattern: 'public/**', reloadServer: false }
 *   ]
 * }
 */
export type BundlerOptions = AssemblerRcFile

/**
 * Keyboard shortcut definition for development server interactions
 *
 * @example
 * const shortcut: KeyboardShortcut = {
 *   key: 'r',
 *   description: 'restart server',
 *   handler: () => server.restart()
 * }
 */
export interface KeyboardShortcut {
  /** The keyboard key that triggers this shortcut */
  key: string
  /** Human-readable description of what this shortcut does */
  description: string
  /** Function to execute when the shortcut is triggered */
  handler: () => void
}

/**
 * Callbacks for keyboard shortcuts actions in the development server
 *
 * @example
 * const callbacks: KeyboardShortcutsCallbacks = {
 *   onRestart: () => devServer.restart(),
 *   onClear: () => process.stdout.write('\u001B[2J\u001B[0;0f'),
 *   onQuit: () => process.exit(0)
 * }
 */
export interface KeyboardShortcutsCallbacks {
  /** Callback to restart the development server */
  onRestart: () => void
  /** Callback to clear the console screen */
  onClear: () => void
  /** Callback to quit the development server */
  onQuit: () => void
}

/**
 * Configuration options for the keyboard shortcuts manager
 *
 * @example
 * const options: ShortcutsManagerOptions = {
 *   logger: cliui().logger,
 *   callbacks: {
 *     onRestart: () => devServer.restart(),
 *     onClear: () => console.clear(),
 *     onQuit: () => process.exit()
 *   }
 * }
 */
export interface ShortcutsManagerOptions {
  /** Logger instance for displaying messages */
  logger: Logger
  /** Callback functions for different shortcut actions */
  callbacks: KeyboardShortcutsCallbacks
}
