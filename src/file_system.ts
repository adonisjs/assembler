/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import picomatch from 'picomatch'
import { relative } from 'node:path'
import type tsStatic from 'typescript'
import { fileURLToPath } from 'node:url'
import string from '@poppinss/utils/string'

import debug from './debug.ts'
import { memoize } from './utils.ts'
import { type InspectedFile, type AssemblerRcFile } from './types/common.ts'

const DEFAULT_INCLUDES = ['**/*']
const ALWAYS_EXCLUDE = ['.git/**', 'coverage/**', '.github/**']
const DEFAULT_EXCLUDES = ['node_modules/**', 'bower_components/**', 'jspm_packages/**']

/**
 * Exposes an intutive API to run actions when different kind of files
 * are changed. The FileSystem is built around the vocabulary used by
 * AdonisJS. Which includes:
 *
 * - Source files: TypeScript, JavaScript, JSON, JSX, TSX files that are included
 *   inside the "tsconfig.json" file are considered as source files.
 * - Meta files: Files registered under the "metaFiles" array of "adonisrc.ts" file
 *   are called meta files.
 * - Meta restart files: Meta files with "restart: true" enabled are called meta restart
 *   files.
 *
 * Using FileSystem you can register actions to be executed when a file changes in
 * one of the above categories.
 *
 * @example
 * const fs = new FileSystem(cwd, tsConfig, rcFile)
 * const file = fs.inspect('./app/controllers/users_controller.ts')
 */
export class FileSystem {
  /**
   * The current working project directory
   */
  #cwd: string

  /**
   * Referenced to the parsed ts config file. We use it to read the includes,
   * excludes and pre-scanned files.
   */
  #tsConfig: tsStatic.ParsedCommandLine

  /**
   * Set of pre-scanned typeScript files provided by tsconfig
   */
  #scannedTypeScriptFiles: Set<string> = new Set()

  /**
   * Picomatch matcher function to know if a file path is
   * part of includes
   */
  #isIncluded: picomatch.Matcher

  /**
   * Picomatch matcher function to know if a file path is
   * part of excludes
   */
  #isExcluded: picomatch.Matcher

  /**
   * Picomatch matcher function to know if a file path is a
   * meta file with reloadServer option enabled
   */
  #isMetaFileWithReloadsEnabled: picomatch.Matcher

  /**
   * Picomatch matcher function to know if a file path is a
   * meta file with reloadServer option disabled
   */
  #isMetaFileWithReloadsDisabled: picomatch.Matcher

  /**
   * Picomatch matcher function to know if a file path is a
   * test file or not
   */
  #isTestFile: picomatch.Matcher

  /**
   * References to includes and excludes glob patterns
   */
  #includes: string[]
  #excludes: string[]

  /**
   * Includes glob patterns extracted from "tsconfig.json" file.
   * Defaults to: ["**\/*"]
   */
  get includes(): string[] {
    return this.#includes
  }

  /**
   * Excludes glob patterns extracted from "tsconfig.json" file.
   *
   * Defaults to: [
   *   'node_modules/**',
   *   'bower_components/**',
   *   'jspm_packages/**,
   * ]
   *
   * Following patterns are always ignored
   *
   * '.git/**', 'coverage/**', '.github/**'
   */
  get excludes(): string[] {
    return this.#excludes
  }

  /**
   * Inspect a relative path to find its source in the project
   */
  inspect = memoize<[string], InspectedFile | null>((absolutePath, relativePath) => {
    /**
     * If a file is a script file and part of the backend project, then we consider
     * the file.
     *
     * Non script files are not checked inside the backend project, since there are
     * anyways cannot be processed by TypeScript.
     */
    if (
      this.#isScriptFile(relativePath) &&
      (this.#scannedTypeScriptFiles.has(absolutePath) || this.#isPartOfBackendProject(relativePath))
    ) {
      debug('backend project file "%s"', relativePath)
      const isTestFile = this.#isTestFile(relativePath)

      return {
        fileType: isTestFile ? 'test' : 'script',
        reloadServer: !isTestFile,
        unixRelativePath: relativePath,
        unixAbsolutePath: absolutePath,
      } satisfies InspectedFile
    }

    /**
     * Check for meta files with reload flag enabled
     */
    if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
      debug('meta file "%s"', relativePath)
      return {
        fileType: 'meta',
        reloadServer: true,
        unixRelativePath: relativePath,
        unixAbsolutePath: absolutePath,
      } satisfies InspectedFile
    }

    /**
     * Check for meta files with reload flag disabled
     */
    if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
      debug('meta file "%s"', relativePath)
      return {
        fileType: 'meta',
        reloadServer: false,
        unixRelativePath: relativePath,
        unixAbsolutePath: absolutePath,
      } satisfies InspectedFile
    }

    debug('ignored file "%s"', relativePath)
    return null
  })

  /**
   * Returns true if the directory should be watched. Chokidar sends
   * absolute unix paths to the ignored callback.
   *
   * You must use "shouldWatchFile" method for files and call this method
   * for directories only.
   */
  shouldWatchDirectory = memoize((absolutePath: string) => {
    /**
     * Always watch the project root
     */
    if (absolutePath === this.#cwd) {
      debug('watching project root')
      return true
    }

    /**
     * Ignore directories excluded by tsconfig.json file. If tsconfig excludes
     * directories include by metaFiles, then its a mis-configuration and we
     * should update excludes to be more specific.
     *
     * Overriding excludes via metaFiles patterns is close to impossible because
     * of how undeterministic glob patterns are.
     */
    const relativePath = string.toUnixSlash(relative(this.#cwd, absolutePath))
    if (this.#isExcluded(relativePath)) {
      debug('watching "%s"', absolutePath)
      return false
    }

    return true
  })

  /**
   * Create a new FileSystem instance
   *
   * @param cwd - The current working directory URL or string path
   * @param tsConfig - Parsed TypeScript configuration
   * @param rcFile - AdonisJS RC file configuration
   */
  constructor(cwd: URL | string, tsConfig: tsStatic.ParsedCommandLine, rcFile: AssemblerRcFile) {
    this.#cwd = string.toUnixSlash(typeof cwd === 'string' ? cwd : fileURLToPath(cwd))
    this.#tsConfig = tsConfig

    const files = tsConfig.fileNames
    const metaFiles = rcFile.metaFiles ?? []
    const testSuites = rcFile.suites ?? []
    const outDir = tsConfig.raw.compilerOptions?.outDir

    /**
     * Register files we know ahead of time
     */
    files.forEach((file) => this.#scannedTypeScriptFiles.add(string.toUnixSlash(file)))

    /**
     * Compute includes and excludes
     */
    this.#includes = tsConfig.raw.include || DEFAULT_INCLUDES
    this.#excludes = ALWAYS_EXCLUDE.concat(
      tsConfig.raw.exclude || (outDir ? DEFAULT_EXCLUDES.concat(outDir) : DEFAULT_EXCLUDES)
    )

    /**
     * Initiate picomatch matchers we will need to identify metafiles
     */
    this.#isMetaFileWithReloadsEnabled = picomatch(
      metaFiles.filter((file) => !!file.reloadServer).map((file) => file.pattern),
      {
        cwd: this.#cwd,
      }
    )
    this.#isMetaFileWithReloadsDisabled = picomatch(
      metaFiles.filter((file) => !file.reloadServer).map((file) => file.pattern),
      {
        cwd: this.#cwd,
      }
    )
    this.#isTestFile = picomatch(
      testSuites.flatMap((suite) => suite.files),
      {
        cwd: this.#cwd,
      }
    )

    /**
     * Initiate picomatch matchers we will need to identify included or
     * excluded files
     */
    this.#isIncluded = picomatch(this.#includes, {
      cwd: this.#cwd,
    })
    this.#isExcluded = picomatch(this.#excludes, {
      cwd: this.#cwd,
    })

    debug('initiating file system %O', {
      includes: this.#includes,
      excludes: this.#includes,
      outDir,
      files,
      metaFiles,
      testSuites,
    })
  }

  /**
   * Returns a boolean telling if a file path is a script file or not.
   *
   * - Files ending with ".ts", ".tsx" are considered are script files.
   * - Files ending with ".js" with "allowJs" option enabled are considered are script files.
   * - Files ending with ".json" with "resolveJsonModule" option enabled are considered are script files.
   */
  #isScriptFile(relativePath: string): boolean {
    if (
      (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')) &&
      !relativePath.endsWith('.d.ts')
    ) {
      return true
    }
    if (this.#tsConfig.options.allowJs && relativePath.endsWith('.js')) {
      return true
    }
    if (this.#tsConfig.options.resolveJsonModule && relativePath.endsWith('.json')) {
      return true
    }
    return false
  }

  /**
   * Check if the file path is part of the backend TypeScript project. We use
   * tsconfig "includes", "excludes", and "files" paths to test if the file
   * should be considered or not.
   */
  #isPartOfBackendProject(relativePath: string) {
    /**
     * Script and non-script files can be excluded using tsconfig
     */
    if (this.#isExcluded(relativePath)) {
      debug('excluded by tsconfig "%s"', relativePath)
      return false
    }

    /**
     * Return true when included
     */
    if (this.#isIncluded(relativePath)) {
      debug('included by tsconfig "%s"', relativePath)
      return true
    }

    return false
  }

  /**
   * Returns true if the file should be watched. Chokidar sends
   * absolute unix paths to the ignored callback.
   *
   * You must use "shouldWatchDirectory" method for directories and call
   * this method for files only.
   *
   * @param absolutePath - The absolute path to the file
   * @returns True if the file should be watched
   */
  shouldWatchFile(absolutePath: string) {
    return this.inspect(absolutePath, relative(this.#cwd, absolutePath)) !== null
  }
}
