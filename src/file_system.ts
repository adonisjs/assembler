/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import picomatch from 'picomatch'
import { relative } from 'node:path/posix'
import string from '@poppinss/utils/string'
import { type TsConfigResult } from 'get-tsconfig'

import debug from './debug.ts'
import { memoize } from './utils.ts'
import { type InspectedFile, type AssemblerRcFile } from './types/common.ts'

const DEFAULT_INCLUDES = ['**/*']
const ALWAYS_EXCLUDE = [
  '.git/**',
  'coverage/**',
  '.github/**',
  '.adonisjs/**',
  'tmp/**',
  'storage/**',
  'build/**',
]
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
  #tsConfig: TsConfigResult

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
   * '.git/**', 'coverage/**', '.github/**', '.adonisjs/**', 'tmp/**', 'storage/**', 'build/**'
   */
  get excludes(): string[] {
    return this.#excludes
  }

  /**
   * Inspect a file path to determine its type and properties within the project.
   *
   * This method analyzes a file to categorize it as a script file, test file, or meta file,
   * and determines whether changes to the file should trigger server restarts. Results
   * are memoized for performance optimization.
   *
   * @param absolutePath - The absolute Unix path to the file
   * @param relativePath - The relative Unix path from the project root
   * @returns File inspection result or null if the file should be ignored
   *
   * @example
   * const file = fileSystem.inspect('/project/app/models/user.ts', 'app/models/user.ts')
   * if (file) {
   *   console.log(file.fileType) // 'script'
   *   console.log(file.reloadServer) // true
   * }
   */
  inspect = memoize<[string?], InspectedFile | null>((absolutePath, relativePath) => {
    relativePath = relativePath ?? relative(this.#cwd, absolutePath)

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
   * Determines if a directory should be watched by the file watcher.
   *
   * This method checks if a directory should be monitored for file changes
   * based on the TypeScript configuration includes/excludes patterns.
   * Results are memoized for performance. Chokidar sends absolute Unix paths.
   *
   * Note: Use shouldWatchFile for files and this method for directories only.
   *
   * @param absolutePath - The absolute Unix path to the directory
   * @returns True if the directory should be watched
   *
   * @example
   * const shouldWatch = fileSystem.shouldWatchDirectory('/project/app/controllers')
   * console.log(shouldWatch) // true
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
    const relativePath = relative(this.#cwd, absolutePath)
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
  constructor(cwd: string, tsConfig: TsConfigResult, rcFile: AssemblerRcFile) {
    this.#cwd = cwd
    this.#tsConfig = tsConfig

    const files = tsConfig.config.files ?? []
    const metaFiles = rcFile.metaFiles ?? []
    const testSuites = rcFile.suites ?? []
    const outDir = tsConfig.config.compilerOptions?.outDir

    /**
     * Register files we know ahead of time
     */
    for (const file of files) {
      this.#scannedTypeScriptFiles.add(string.toUnixSlash(file))
    }

    /**
     * Compute includes and excludes
     */
    this.#includes = tsConfig.config.include || DEFAULT_INCLUDES
    this.#excludes = ALWAYS_EXCLUDE.concat(
      tsConfig.config.exclude || (outDir ? DEFAULT_EXCLUDES.concat(outDir) : DEFAULT_EXCLUDES)
    )

    /**
     * Pre-compute meta file patterns to avoid repeated array operations
     */
    const metaFilesWithReloads: string[] = []
    const metaFilesWithoutReloads: string[] = []

    for (const file of metaFiles) {
      if (file.reloadServer) {
        metaFilesWithReloads.push(file.pattern)
      } else {
        metaFilesWithoutReloads.push(file.pattern)
      }
    }

    const testFilePatterns = testSuites.flatMap((suite) => suite.files)
    const picomatcchOptions = { cwd: this.#cwd }

    /**
     * Initiate picomatch matchers we will need to identify metafiles
     */
    this.#isMetaFileWithReloadsEnabled = picomatch(metaFilesWithReloads, picomatcchOptions)
    this.#isMetaFileWithReloadsDisabled = picomatch(metaFilesWithoutReloads, picomatcchOptions)
    this.#isTestFile = picomatch(testFilePatterns, picomatcchOptions)
    this.#isIncluded = picomatch(this.#includes, picomatcchOptions)
    this.#isExcluded = picomatch(this.#excludes, picomatcchOptions)

    debug('initiating file system %O', {
      includes: this.#includes,
      excludes: this.#excludes,
      outDir,
      files,
      metaFiles,
      testSuites,
    })
  }

  /**
   * Determines if a file path represents a script file based on TypeScript configuration.
   *
   * Script files are those that can be processed by the TypeScript compiler:
   * - Files ending with ".ts" or ".tsx" (excluding ".d.ts" declaration files)
   * - Files ending with ".js" when "allowJs" option is enabled in tsconfig
   * - Files ending with ".json" when "resolveJsonModule" option is enabled in tsconfig
   *
   * @param relativePath - The relative file path to check
   * @returns True if the file is a script file
   */
  #isScriptFile(relativePath: string): boolean {
    if (
      (relativePath.endsWith('.ts') || relativePath.endsWith('.tsx')) &&
      !relativePath.endsWith('.d.ts')
    ) {
      return true
    }
    if (this.#tsConfig.config.compilerOptions?.allowJs && relativePath.endsWith('.js')) {
      return true
    }
    if (
      this.#tsConfig.config.compilerOptions?.resolveJsonModule &&
      relativePath.endsWith('.json')
    ) {
      return true
    }
    return false
  }

  /**
   * Checks if a file path is part of the backend TypeScript project.
   *
   * Uses TypeScript configuration "includes", "excludes", and "files" paths
   * to determine if a file should be considered part of the project compilation.
   *
   * @param relativePath - The relative file path to check
   * @returns True if the file is part of the backend project
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
    return this.inspect(absolutePath) !== null
  }
}
