/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { cliui } from '@poppinss/cliui'
import { fileURLToPath } from 'node:url'
import type Hooks from '@poppinss/hooks'
import string from '@poppinss/utils/string'

import { loadHooks, processRoutes } from './utils.ts'
import { IndexGenerator } from './index_generator/main.ts'
import { type RoutesScanner } from './code_scanners/routes_scanner/main.ts'
import { type CodeGenOptions, type CodeGenSnapshot } from './types/common.ts'
import { type CommonHooks, type HookParams, type RouterHooks } from './types/hooks.ts'

/**
 * CodeGen runs the codegen performed by the dev-server, without the server
 * and without the file watcher.
 *
 * The dev-server, the bundler and the test runner all generate code as a
 * side-effect of doing something else. CodeGen exists to perform the same work
 * on its own, so the contents of the ".adonisjs" directory can be refreshed
 * deterministically. For example, inside a CI pipeline before typechecking or
 * creating a build.
 *
 * The class covers both the codegen stages.
 *
 * - The static stage runs the "init" hooks against an index generator and
 *   writes the index files. Nothing but the file-system is needed for it.
 *
 * - The runtime stage runs the routes hooks. It needs a snapshot of the state
 *   that only a booted application knows about, therefore the snapshot has to
 *   be supplied by the caller. Assembler never boots the app itself.
 *
 * The stages run in that order, because an application imports the generated
 * index files from its preload files and hence cannot be booted before they
 * exist.
 *
 * Unlike the dev-server, errors are not swallowed. A codegen run either
 * completes or throws, so the caller can exit with a non-zero code.
 *
 * @example
 * const codegen = new CodeGen(cwd, { hooks: rcFile.hooks })
 * codegen.ui.logger = command.logger
 *
 * await codegen.run(async () => {
 *   await warmUpApp()
 *   return { routes: router.toJSON() }
 * })
 */
export class CodeGen {
  /**
   * Hooks to execute custom actions during the codegen process
   */
  #hooks!: Hooks<
    {
      [K in keyof CommonHooks]: [HookParams<K>, HookParams<K>]
    } & {
      [K in keyof RouterHooks]: [HookParams<K>, HookParams<K>]
    }
  >

  /**
   * Index generator for managing auto-generated index files
   */
  #indexGenerator!: IndexGenerator

  /**
   * Routes scanner created when a routes snapshot has been supplied and
   * there are hooks interested in scanning them
   */
  #routesScanner?: RoutesScanner

  /**
   * CLI UI instance for displaying colorful messages and progress information
   */
  ui = cliui()

  /**
   * The current working directory URL
   */
  cwd: URL

  /**
   * The current working project directory path as string
   */
  cwdPath: string

  /**
   * CodeGen configuration options including hooks
   */
  options: CodeGenOptions

  /**
   * Create a new codegen instance
   *
   * @param cwd - The current working directory URL
   * @param options - CodeGen configuration options
   */
  constructor(cwd: URL, options: CodeGenOptions) {
    this.cwd = cwd
    this.options = options
    this.cwdPath = string.toUnixSlash(fileURLToPath(this.cwd))
  }

  /**
   * Reference to the index generator used by the last run
   */
  get indexGenerator(): IndexGenerator | undefined {
    return this.#indexGenerator
  }

  /**
   * Reference to the routes scanner used by the last run. Stays undefined
   * when no routes were supplied or no hook asked for them to be scanned
   */
  get routesScanner(): RoutesScanner | undefined {
    return this.#routesScanner
  }

  /**
   * Generate the codegen files.
   *
   * The index files are written first, because the application cannot be booted
   * without them. The preload files of an application import the generated
   * barrel files, for example "start/routes.ts" imports the controllers barrel,
   * so those files have to exist on disk before anything imports them. The
   * dev-server generates them ahead of spawning the app for the same reason.
   *
   * Therefore the caller boots the application from inside the "collectSnapshot"
   * callback and returns the state only a booted app knows about. Skip the
   * callback to generate the index files alone.
   *
   * @param collectSnapshot - Called once the index files exist. Boot the app
   *   here and return the runtime state to generate the rest from
   *
   * @example
   * // Index files only
   * await codegen.run()
   *
   * // Index files, then everything derived from the routes
   * await codegen.run(async () => {
   *   await app.boot()
   *   await app.warmUp()
   *   router.commit()
   *   return { routes: router.toJSON() }
   * })
   */
  async run(collectSnapshot?: () => CodeGenSnapshot | Promise<CodeGenSnapshot>): Promise<void> {
    this.ui.logger.info('loading hooks...')
    this.#hooks = await loadHooks(this.options.hooks, [
      'init',
      'routesCommitted',
      'routesScanning',
      'routesScanned',
    ])

    this.#indexGenerator = new IndexGenerator(this.cwdPath, this.ui.logger)

    /**
     * Static stage. Run the init hooks and write the index files. Nothing but
     * the file-system is needed for it
     */
    await this.#hooks.runner('init').run(this, this.#hooks, this.#indexGenerator)
    this.#hooks.clear('init')

    this.ui.logger.info('generating indexes...')
    await this.#indexGenerator.generate()

    if (!collectSnapshot) {
      return
    }

    /**
     * Runtime stage. The index files exist by now, so the caller is able to
     * boot the app and hand over the state we cannot collect ourselves
     */
    const snapshot = await collectSnapshot()
    if (snapshot.routes) {
      /**
       * The cast is needed because a hooks instance is invariant over its
       * events map. This instance carries the "init" hook as well, which the
       * helper has no interest in
       */
      this.#routesScanner = await processRoutes(this.#hooks, this, this.cwdPath, snapshot.routes)
    }
  }
}
