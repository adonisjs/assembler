/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import slash from 'slash'
import fs from 'node:fs/promises'
import { relative } from 'node:path'
import type tsStatic from 'typescript'
import { fileURLToPath } from 'node:url'
import { cliui, type Logger } from '@poppinss/cliui'
import { detectPackageManager } from '@antfu/install-pkg'

import type { BundlerOptions } from './types.js'
import { run, parseConfig, copyFiles } from './helpers.js'

type SupportedPackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

/**
 * List of package managers we support in order to
 * copy lockfiles
 */
const SUPPORT_PACKAGE_MANAGERS: {
  [K in SupportedPackageManager]: {
    lockFile: string
    installCommand: string
  }
} = {
  npm: {
    lockFile: 'package-lock.json',
    installCommand: 'npm ci --omit="dev"',
  },
  yarn: {
    lockFile: 'yarn.lock',
    installCommand: 'yarn install --production',
  },
  pnpm: {
    lockFile: 'pnpm-lock.yaml',
    installCommand: 'pnpm i --prod',
  },
  bun: {
    lockFile: 'bun.lockb',
    installCommand: 'bun install --production',
  },
}

/**
 * Instance of CLIUI
 */
const ui = cliui()

/**
 * The bundler class exposes the API to build an AdonisJS project.
 */
export class Bundler {
  #cwd: URL
  #cwdPath: string
  #ts: typeof tsStatic
  #logger = ui.logger
  #options: BundlerOptions

  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors()
  }

  constructor(cwd: URL, ts: typeof tsStatic, options: BundlerOptions) {
    this.#cwd = cwd
    this.#cwdPath = fileURLToPath(this.#cwd)
    this.#ts = ts
    this.#options = options
  }

  /**
   * Returns the relative unix path for an absolute
   * file path
   */
  #getRelativeName(filePath: string) {
    return slash(relative(this.#cwdPath, filePath))
  }

  /**
   * Cleans up the build directory
   */
  async #cleanupBuildDirectory(outDir: string) {
    await fs.rm(outDir, { recursive: true, force: true, maxRetries: 5 })
  }

  /**
   * Runs assets bundler command to build assets
   */
  async #buildAssets(): Promise<boolean> {
    const assetsBundler = this.#options.assets
    if (!assetsBundler?.enabled) {
      return true
    }

    try {
      this.#logger.info('compiling frontend assets', { suffix: assetsBundler.cmd })
      await run(this.#cwd, {
        stdio: 'inherit',
        script: assetsBundler.cmd,
        scriptArgs: assetsBundler.args,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Runs tsc command to build the source.
   */
  async #runTsc(outDir: string): Promise<boolean> {
    try {
      await run(this.#cwd, {
        stdio: 'inherit',
        script: 'tsc',
        scriptArgs: ['--outDir', outDir],
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Copy meta files to the output directory
   */
  async #copyMetaFiles(outDir: string, additionalFilesToCopy: string[]) {
    const metaFiles = (this.#options.metaFiles || [])
      .map((file) => file.pattern)
      .concat(additionalFilesToCopy)

    await copyFiles(metaFiles, this.#cwdPath, outDir)
  }

  /**
   * Detect the package manager used by the project
   * and return the lockfile name and install command
   * related to it.
   */
  async #getPackageManager(client?: SupportedPackageManager) {
    let pkgManager: string | null | undefined = client

    if (!pkgManager) {
      pkgManager = await detectPackageManager(this.#cwdPath)
    }
    if (!pkgManager) {
      pkgManager = 'npm'
    }

    if (!Object.keys(SUPPORT_PACKAGE_MANAGERS).includes(pkgManager)) {
      return null
    }

    return SUPPORT_PACKAGE_MANAGERS[pkgManager as SupportedPackageManager]
  }

  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger: Logger) {
    this.#logger = logger
    return this
  }

  /**
   * Bundles the application to be run in production
   */
  async bundle(stopOnError: boolean = true, client?: SupportedPackageManager): Promise<boolean> {
    /**
     * Step 1: Parse config file to get the build output directory
     */
    const config = parseConfig(this.#cwd, this.#ts)
    if (!config) {
      return false
    }

    /**
     * Step 2: Cleanup existing build directory (if any)
     */
    const outDir = config.options.outDir || fileURLToPath(new URL('build/', this.#cwd))
    this.#logger.info('cleaning up output directory', { suffix: this.#getRelativeName(outDir) })
    await this.#cleanupBuildDirectory(outDir)

    /**
     * Step 3: Build frontend assets
     */
    if (!(await this.#buildAssets())) {
      return false
    }

    /**
     * Step 4: Build typescript source code
     */
    this.#logger.info('compiling typescript source', { suffix: 'tsc' })
    const buildCompleted = await this.#runTsc(outDir)
    await copyFiles(['ace.js'], this.#cwdPath, outDir)

    /**
     * Remove incomplete build directory when tsc build
     * failed and stopOnError is set to true.
     */
    if (!buildCompleted && stopOnError) {
      await this.#cleanupBuildDirectory(outDir)
      const instructions = ui
        .sticker()
        .fullScreen()
        .drawBorder((borderChar, colors) => colors.red(borderChar))

      instructions.add(
        this.#colors.red('Cannot complete the build process as there are TypeScript errors.')
      )
      instructions.add(
        this.#colors.red(
          'Use "--ignore-ts-errors" flag to ignore TypeScript errors and continue the build.'
        )
      )

      this.#logger.logError(instructions.prepare())
      return false
    }

    /**
     * Step 5: Copy meta files to the build directory
     */
    const pkgManager = await this.#getPackageManager(client)
    const pkgFiles = pkgManager ? ['package.json', pkgManager.lockFile] : ['package.json']
    this.#logger.info('copying meta files to the output directory')
    await this.#copyMetaFiles(outDir, pkgFiles)

    this.#logger.success('build completed')
    this.#logger.log('')

    /**
     * Next steps
     */
    ui.instructions()
      .useRenderer(this.#logger.getRenderer())
      .heading('Run the following commands to start the server in production')
      .add(this.#colors.cyan(`cd ${this.#getRelativeName(outDir)}`))
      .add(
        this.#colors.cyan(
          pkgManager ? pkgManager.installCommand : 'Install production dependencies'
        )
      )
      .add(this.#colors.cyan('node bin/server.js'))
      .render()

    return true
  }
}
