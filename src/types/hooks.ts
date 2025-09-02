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
   */
  fileChanged: LazyImport<
    (
      filePath: string,
      info: {
        /** Source of the file change notification */
        source: 'hot-hook' | 'watcher'
        /** Whether the file was hot reloaded without server restart */
        hotReloaded: boolean
        /** Whether a full server reload is required */
        fullReload: boolean
      },
      server: DevServer | TestRunner
    ) => AsyncOrSync<void>
  >[]

  /**
   * The hook is executed after a file has been added to the filesystem.
   */
  fileAdded: LazyImport<(filePath: string, server: DevServer | TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after a file has been removed from the filesystem.
   */
  fileRemoved: LazyImport<(filePath: string, server: DevServer | TestRunner) => AsyncOrSync<void>>[]
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
   */
  devServerStarting: LazyImport<(server: DevServer) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the child process has been started.
   * Use this hook to display additional information or perform post-startup tasks.
   */
  devServerStarted: LazyImport<
    (server: DevServer, uiInstructions: Instructions) => AsyncOrSync<void>
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
   */
  buildStarting: LazyImport<(server: Bundler) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the production build has been created.
   * Use this hook to perform post-build tasks or display build statistics.
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
   */
  testsStarting: LazyImport<(server: TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the tests have been executed.
   * Use this hook to clean up resources or generate test reports.
   */
  testsFinished: LazyImport<(server: TestRunner) => AsyncOrSync<void>>[]
}
