/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fdir } from 'fdir'
import Cache from 'tmp-cache'
import { relative } from 'node:path'
import lodash from '@poppinss/utils/lodash'
import string from '@poppinss/utils/string'
import { readFile } from 'node:fs/promises'
import { naturalSort } from '@poppinss/utils'
import { Lang, parse, type SgNode } from '@ast-grep/napi'
import picomatch, { type PicomatchOptions, type Matcher } from 'picomatch'

import debug from './debug.ts'
import { removeExtension } from './utils.ts'
import { type RecursiveFileTree, type VirtualFileSystemOptions } from './types/common.ts'

const BYPASS_FN = <T>(input: T) => input
const DEFAULT_GLOB = ['**/!(*.d).ts', '**/*.tsx', '**/*.js']

/**
 * Virtual file system for managing and tracking files with AST parsing capabilities.
 *
 * The VirtualFileSystem provides an abstraction layer over the physical file system,
 * allowing efficient file scanning, filtering, and AST parsing with caching. It's
 * designed to work with TypeScript/JavaScript files and provides various output
 * formats for different use cases.
 *
 * @example
 * const vfs = new VirtualFileSystem('/src', { glob: ['**\/*.ts'] })
 * await vfs.scan()
 * const fileTree = vfs.asTree()
 * const astNode = await vfs.get('/src/app.ts')
 */
export class VirtualFileSystem {
  /**
   * Absolute path to the source directory from where to read the files.
   * Additionally, a glob pattern or a filter could be specified to
   * narrow down the scanned files list.
   */
  #source: string

  /**
   * Filesystem options
   */
  #options: VirtualFileSystemOptions

  /**
   * Files collected from the initial scan with pre-computed relative paths
   */
  #files: Map<string, string> = new Map()

  /**
   * LRU cache storing parsed AST nodes by file path with size limit
   */
  #astCache: Cache<string, SgNode> = new Cache({ max: 60 })

  /**
   * Matcher is defined when glob is defined via the options
   */
  #matcher: Matcher

  /**
   * Picomatch options used for file pattern matching
   */
  #picoMatchOptions: PicomatchOptions

  /**
   * Create a new VirtualFileSystem instance
   *
   * @param source - Absolute path to the source directory
   * @param options - Optional configuration for file filtering and processing
   */
  constructor(source: string, options?: VirtualFileSystemOptions) {
    this.#source = string.toUnixSlash(source)
    this.#options = options ?? {}
    this.#picoMatchOptions = {
      cwd: this.#source,
    }
    this.#matcher = picomatch(this.#options.glob ?? DEFAULT_GLOB, this.#picoMatchOptions)
  }

  /**
   * Scans the filesystem to collect the files. Newly files must
   * be added via the ".add" method.
   *
   * This method performs an initial scan of the source directory using
   * the configured glob patterns and populates the internal file list.
   */
  async scan() {
    debug('fetching entities from source "%s"', this.#source)
    const filesList = await new fdir()
      .globWithOptions(this.#options.glob ?? DEFAULT_GLOB, this.#picoMatchOptions)
      .withFullPaths()
      .crawl(this.#source)
      .withPromise()

    debug('scanned files %O', filesList)
    const sortedFiles = filesList.sort(naturalSort)
    this.#files.clear()

    for (const filePath of sortedFiles) {
      const relativePath = string.toUnixSlash(removeExtension(relative(this.#source, filePath)))
      this.#files.set(string.toUnixSlash(filePath), relativePath)
    }
  }

  /**
   * Check if a given file is part of the virtual file system. The method
   * checks for the scanned files as well as glob pattern matches.
   *
   * @param filePath - Absolute file path to check
   * @returns True if the file is tracked or matches the configured patterns
   */
  has(filePath: string): boolean {
    /**
     * File is already tracked as part of the initial scan
     */
    if (this.#files.has(filePath)) {
      return true
    }

    /**
     * Return false if file is not within the source dir
     */
    if (!filePath.startsWith(this.#source)) {
      return false
    }

    /**
     * If a match exists, then check if the file matches via the
     * matcher test
     */
    return this.#matcher(filePath)
  }

  /**
   * Returns the files as a flat list of key-value pairs
   *
   * Converts the tracked files into a flat object where keys are relative
   * paths (without extensions) and values are absolute file paths.
   *
   * @param options - Optional transformation functions for keys and values
   * @returns Object with file mappings
   */
  asList(options?: {
    transformKey?: (key: string) => string
    transformValue?: (filePath: string) => string
  }) {
    const list: { [key: string]: string } = {}
    const transformKey = options?.transformKey ?? BYPASS_FN
    const transformValue = options?.transformValue ?? BYPASS_FN

    for (const [filePath, relativePath] of this.#files) {
      list[transformKey(relativePath)] = transformValue(filePath)
    }

    return list
  }

  /**
   * Returns the files as a nested tree structure
   *
   * Converts the tracked files into a hierarchical object structure that
   * mirrors the directory structure of the source files.
   *
   * @param options - Optional transformation functions for keys and values
   * @returns Nested object representing the file tree
   */
  asTree(options?: {
    transformKey?: (key: string) => string
    transformValue?: (filePath: string) => string
  }) {
    const list: RecursiveFileTree = {}
    const transformKey = options?.transformKey ?? BYPASS_FN
    const transformValue = options?.transformValue ?? BYPASS_FN

    for (const [filePath, relativePath] of this.#files) {
      lodash.set(list, transformKey(relativePath).split('/'), transformValue(filePath))
    }

    return list
  }

  /**
   * Add a new file to the virtual file system. File is only added when it
   * matches the pre-defined filters.
   *
   * @param filePath - Absolute path of the file to add
   * @returns True if the file was added, false if it doesn't match filters
   */
  add(filePath: string): boolean {
    if (this.has(filePath)) {
      debug('adding new "%s" file to the virtual file system', filePath)
      const relativePath = removeExtension(relative(this.#source, filePath))
      this.#files.set(filePath, relativePath)
      return true
    }

    return false
  }

  /**
   * Remove a file from the virtual file system
   *
   * @param filePath - Absolute path of the file to remove
   * @returns True if the file was removed, false if it wasn't tracked
   */
  remove(filePath: string): boolean {
    debug('removing "%s" file from virtual file system', filePath)
    return this.#files.delete(filePath)
  }

  /**
   * Returns the file contents as AST-grep node and caches it
   * forever. Use the "invalidate" method to remove it from the cache.
   *
   * This method reads the file content, parses it into an AST using ast-grep,
   * and caches the result for future requests to improve performance.
   *
   * @param filePath - The absolute path to the file to parse
   * @returns Promise resolving to the AST-grep node
   */
  async get(filePath: string): Promise<SgNode> {
    const cached = this.#astCache.get(filePath)
    if (cached) {
      debug('returning AST nodes from cache "%s"', filePath)
      return cached
    }

    const fileContents = await readFile(filePath, 'utf-8')
    debug('parsing "%s" file to AST', filePath)

    this.#astCache.set(filePath, parse(Lang.TypeScript, fileContents).root())
    return this.#astCache.get(filePath)!
  }

  /**
   * Invalidates AST cache for a single file or all files
   *
   * Use this method when files have been modified to ensure fresh
   * AST parsing on subsequent get() calls.
   *
   * @param filePath - Optional file path to clear. If omitted, clears entire cache
   */
  invalidate(filePath?: string) {
    debug('invalidate AST cache "%s"', filePath)
    filePath ? this.#astCache.delete(filePath) : this.#astCache.clear()
  }

  /**
   * Clear all scanned files from memory
   *
   * Removes all tracked files from the internal file list, effectively
   * resetting the virtual file system.
   */
  clear() {
    this.#files.clear()
  }
}
