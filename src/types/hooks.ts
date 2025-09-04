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
import { type RoutesScanner } from '../code_scanners/routes_scanner/main.ts'
import { type IndexGenerator } from '../index_generator/main.ts'

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
  init: LazyImport<
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
  routesCommitted: LazyImport<
    (parent: DevServer, routes: Record<string, RoutesListItem[]>) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed when dev server begins the routes scanning process.
   * Use this hook to prepare for route scanning or modify scanner configuration.
   *
   * @param parent - The DevServer instance
   * @param routesScanner - The RoutesScanner instance being used
   */
  routesScanning: LazyImport<
    (parent: DevServer, routesScanner: RoutesScanner) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed when routes scanning process has finished.
   * Use this hook to process the scanned routes or clean up resources.
   *
   * @param parent - The DevServer instance
   * @param routesScanner - The RoutesScanner instance that was used
   */
  routesScanned: LazyImport<
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
  fileChanged: LazyImport<
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
  fileAdded: LazyImport<
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
  fileRemoved: LazyImport<
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
  devServerStarting: LazyImport<(server: DevServer) => AsyncOrSync<void>>[]

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
  devServerStarted: LazyImport<
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
  buildStarting: LazyImport<(server: Bundler) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the production build has been created.
   * Use this hook to perform post-build tasks or display build statistics.
   *
   * @param server - The Bundler instance that created the build
   * @param uiInstructions - UI instructions for displaying build information
   */
  buildFinished: LazyImport<(server: Bundler, uiInstructions: Instructions) => AsyncOrSync<void>>[]
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
  testsStarting: LazyImport<(server: TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the tests have been executed.
   * Use this hook to clean up resources or generate test reports.
   *
   * @param server - The TestRunner instance that executed the tests
   */
  testsFinished: LazyImport<(server: TestRunner) => AsyncOrSync<void>>[]
}
