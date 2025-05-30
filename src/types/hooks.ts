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
 * Hooks executed by the file watcher.
 *
 * - In HMR mode, assembler will rely on hot-hook to notify about the filesystem changes.
 * - Otherwise, the inbuilt watcher of the DevServer or the TestsRunner will notify.
 */
export type WatcherHooks = {
  /**
   * The hook is executed after a file has been changed in the watch mode.
   */
  fileChanged: LazyImport<(filePath: string, server: DevServer | TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after a file has been added.
   */
  fileAdded: LazyImport<(filePath: string, server: DevServer | TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after a file has been removed.
   */
  fileRemoved: LazyImport<(filePath: string, server: DevServer | TestRunner) => AsyncOrSync<void>>[]
}

/**
 * Hooks executed when running the dev server.
 */
export type DevServerHooks = {
  /**
   * The hook is executed before the child process for the dev server
   * is started.
   */
  devServerStarting: LazyImport<(server: DevServer) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the child process has been started.
   */
  devServerStarted: LazyImport<
    (server: DevServer, uiInstructions: Instructions) => AsyncOrSync<void>
  >[]
}

/**
 * Hooks executed when the production build is created.
 */
export type BundlerHooks = {
  /**
   * The hook is executed before we begin creating the production build
   */
  buildStarting: LazyImport<(server: Bundler) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the production build has been created
   */
  buildFinished: LazyImport<(server: Bundler, uiInstructions: Instructions) => AsyncOrSync<void>>[]
}

/**
 * Hooks executed when running the tests
 */
export type TestRunnerHooks = {
  /**
   * The hook is executed before we begin executing the tests
   */
  testsStarting: LazyImport<(server: TestRunner) => AsyncOrSync<void>>[]

  /**
   * The hook is executed after the tests have been executed
   */
  testsFinished: LazyImport<(server: TestRunner) => AsyncOrSync<void>>[]
}
