/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Instructions } from '@poppinss/cliui'
import { type AsyncOrSync, type LazyImport } from '@poppinss/utils/types'

import { type Bundler } from '../bundler.ts'
import { type DevServer } from '../dev_server.ts'
import { type TestRunner } from '../test_runner.ts'
import { type RoutesListItem } from './code_scanners.ts'
import { type IndexGenerator } from '../index_generator/main.ts'
import { type RoutesScanner } from '../code_scanners/routes_scanner/main.ts'

/**
 * Defines a hook that can be either a lazy import or an object with a run method.
 * This type provides flexibility in how hooks are defined and imported, supporting
 * both dynamic imports for code splitting and direct object definitions.
 *
 * @template Fn - The function signature that the hook must conform to
 *
 * @example
 * // Using lazy import
 * const hook: DefineHook<(server: DevServer) => void> = () => import('./my-hook')
 *
 * // Using direct object
 * const hook: DefineHook<(server: DevServer) => void> = {
 *   run: (server) => console.log('Hook executed')
 * }
 */
type DefineHook<Fn extends (...args: any) => any> = LazyImport<Fn> | { run: Fn }

/**
 * Common hooks executed by the dev-server, test runner and the bundler.
 * These hooks are shared across all assembler operations and provide
 * lifecycle management for initialization tasks.
 *
 * @example
 * const commonHooks: CommonHooks = {
 *   init: [
 *     () => import('./hooks/create_barrel_files')
 *   ]
 * }
 */
export type CommonHooks = {
  /**
   * The hook is executed as the first step when assembler starts the
   * dev-server, runs tests or creates a build. Use this hook to perform
   * initialization tasks that are common across all operations.
   *
   * @param parent - The parent instance (DevServer, TestRunner, or Bundler)
   */
  init: DefineHook<
    (parent: DevServer | TestRunner | Bundler, indexGenerator: IndexGenerator) => AsyncOrSync<void>
  >[]
}

/**
 * Hooks executed by the dev server around the router.
 * These hooks provide lifecycle management for route scanning and processing.
 *
 * @example
 * const routerHooks: RouterHooks = {
 *   routesCommitted: [
 *     () => import('./hooks/on_routes_committed')
 *   ],
 *   routesScanning: [
 *     () => import('./hooks/before_routes_scan')
 *   ],
 *   routesScanned: [
 *     () => import('./hooks/after_routes_scan')
 *   ]
 * }
 */
export type RouterHooks = {
  /**
   * The hook is executed when routes are committed by the dev server child
   * process. Use this hook to react to route changes and perform related tasks.
   *
   * @param parent - The DevServer instance
   * @param routes - Record of routes grouped by domain or method
   */
  routesCommitted: DefineHook<
    (parent: DevServer, routes: Record<string, RoutesListItem[]>) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed when dev server begins the routes scanning process.
   * Use this hook to prepare for route scanning or modify scanner configuration.
   *
   * @param parent - The DevServer instance
   * @param routesScanner - The RoutesScanner instance being used
   */
  routesScanning: DefineHook<
    (parent: DevServer, routesScanner: RoutesScanner) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed when routes scanning process has finished.
   * Use this hook to process the scanned routes or clean up resources.
   *
   * @param parent - The DevServer instance
   * @param routesScanner - The RoutesScanner instance that was used
   */
  routesScanned: DefineHook<
    (parent: DevServer, routesScanner: RoutesScanner) => AsyncOrSync<void>
  >[]
}

/**
 * Hooks executed by the file watcher during development and testing.
 *
 * - In HMR mode, assembler will rely on hot-hook to notify about the filesystem changes.
 * - Otherwise, the inbuilt watcher of the DevServer or the TestsRunner will notify.
 *
 * @example
 * const watcherHooks: WatcherHooks = {
 *   fileChanged: [
 *     () => import('./hooks/on_file_changed')
 *   ],
 *   fileAdded: [
 *     () => import('./hooks/on_file_added')
 *   ],
 *   fileRemoved: [
 *     () => import('./hooks/on_file_removed')
 *   ]
 * }
 */
export type WatcherHooks = {
  /**
   * The hook is executed after a file has been changed in watch mode.
   * Provides information about the change source and reload behavior.
   * Use this hook to react to file changes and trigger custom actions.
   *
   * @param filePath - The relative path to the changed file
   * @param info - Information about the file change
   * @param info.source - Source of the file change notification
   * @param info.hotReloaded - Whether the file was hot reloaded without server restart
   * @param info.fullReload - Whether a full server reload is required
   * @param parent - The parent DevServer or TestRunner instance
   */
  fileChanged: DefineHook<
    (
      relativePath: string,
      absolutePath: string,
      info: {
        /** Source of the file change notification */
        source: 'hot-hook' | 'watcher'
        /** Whether the file was hot reloaded without server restart */
        hotReloaded: boolean
        /** Whether a full server reload is required */
        fullReload: boolean
      },
      parent: DevServer | TestRunner
    ) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed after a file has been added to the filesystem.
   * Use this hook to react to new files being added to the project.
   *
   * @param filePath - The absolute path to the added file
   * @param server - The DevServer or TestRunner instance
   */
  fileAdded: DefineHook<
    (
      relativePath: string,
      absolutePath: string,
      server: DevServer | TestRunner
    ) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed after a file has been removed from the filesystem.
   * Use this hook to clean up resources or update caches when files are deleted.
   *
   * @param filePath - The absolute path to the removed file
   * @param server - The DevServer or TestRunner instance
   */
  fileRemoved: DefineHook<
    (
      relativePath: string,
      absolutePath: string,
      server: DevServer | TestRunner
    ) => AsyncOrSync<void>
  >[]
}

/**
 * Hooks executed when running the development server.
 *
 * @example
 * const devServerHooks: DevServerHooks = {
 *   devServerStarting: [
 *     () => import('./hooks/before_dev_server_start')
 *   ],
 *   devServerStarted: [
 *     () => import('./hooks/after_dev_server_start')
 *   ]
 * }
 */
export type DevServerHooks = {
  /**
   * The hook is executed before the child process for the dev server is started.
   * Use this hook to perform setup tasks or modify server configuration.
   *
   * @param server - The DevServer instance that is about to start
   */
  devServerStarting: DefineHook<(server: DevServer) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the child process has been started.
   * Use this hook to display additional information or perform post-startup tasks.
   *
   * @param server - The DevServer instance that has started
   * @param info - Server information containing port and host
   * @param info.port - The port number the server is running on
   * @param info.host - The host address the server is bound to
   * @param uiInstructions - UI instructions for displaying server information
   */
  devServerStarted: DefineHook<
    (
      server: DevServer,
      info: { port: number; host: string },
      uiInstructions: Instructions
    ) => AsyncOrSync<void>
  >[]
}

/**
 * Hooks executed when the production build is created.
 *
 * @example
 * const bundlerHooks: BundlerHooks = {
 *   buildStarting: [
 *     () => import('./hooks/before_build')
 *   ],
 *   buildFinished: [
 *     () => import('./hooks/after_build')
 *   ]
 * }
 */
export type BundlerHooks = {
  /**
   * The hook is executed before we begin creating the production build.
   * Use this hook to perform pre-build tasks like asset optimization.
   *
   * @param server - The Bundler instance that will create the build
   */
  buildStarting: DefineHook<(server: Bundler) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the production build has been created.
   * Use this hook to perform post-build tasks or display build statistics.
   *
   * @param server - The Bundler instance that created the build
   * @param uiInstructions - UI instructions for displaying build information
   */
  buildFinished: DefineHook<(server: Bundler, uiInstructions: Instructions) => AsyncOrSync<void>>[]
}

/**
 * Hooks executed when running the test suite.
 *
 * @example
 * const testRunnerHooks: TestRunnerHooks = {
 *   testsStarting: [
 *     () => import('./hooks/before_tests')
 *   ],
 *   testsFinished: [
 *     () => import('./hooks/after_tests')
 *   ]
 * }
 */
export type TestRunnerHooks = {
  /**
   * The hook is executed before we begin executing the tests.
   * Use this hook to set up test databases or perform pre-test setup.
   *
   * @param server - The TestRunner instance that will execute the tests
   */
  testsStarting: DefineHook<(server: TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the tests have been executed.
   * Use this hook to clean up resources or generate test reports.
   *
   * @param server - The TestRunner instance that executed the tests
   */
  testsFinished: DefineHook<(server: TestRunner) => AsyncOrSync<void>>[]
}

/**
 * Combined type representing all available hooks across the assembler ecosystem.
 * This intersection type merges all hook categories into a single type for
 * comprehensive hook management and type safety.
 *
 * @example
 * ```js
 * const allHooks: AllHooks = {
 *   init: [() => import('./hooks/init')],
 *   fileChanged: [() => import('./hooks/file_changed')],
 *   devServerStarted: [() => import('./hooks/dev_server_started')],
 *   buildFinished: [() => import('./hooks/build_finished')],
 *   testsFinished: [() => import('./hooks/tests_finished')],
 *   routesCommitted: [() => import('./hooks/routes_committed')]
 * }
 * ```
 */
export type AllHooks = CommonHooks &
  WatcherHooks &
  DevServerHooks &
  BundlerHooks &
  TestRunnerHooks &
  RouterHooks

/**
 * Utility type that extracts the parameter types for a specific hook.
 * This type helps maintain type safety when working with hook callbacks
 * by providing the exact parameter signature for any given hook name.
 *
 * @template Hook - The name of the hook to extract parameters for
 *
 * @example
 * ```js
 * // Get parameters for the fileChanged hook
 * type FileChangedParams = HookParams<'fileChanged'>
 * // Result: [string, string, {...}, DevServer | TestRunner]
 *
 * // Get parameters for the devServerStarted hook
 * type DevServerStartedParams = HookParams<'devServerStarted')
 * // Result: [DevServer, {port: number, host: string}, Instructions]
 * ```
 */
export type HookParams<Hook extends keyof AllHooks> =
  AllHooks[Hook][number] extends DefineHook<infer A> ? Parameters<A> : never
