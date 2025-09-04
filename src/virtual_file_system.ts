/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fdir } from 'fdir'
import { relative } from 'node:path'
import { readFile } from 'node:fs/promises'
import lodash from '@poppinss/utils/lodash'
import { naturalSort } from '@poppinss/utils'
import picomatch, { type Matcher } from 'picomatch'
import { Lang, parse, type SgNode } from '@ast-grep/napi'

import debug from './debug.ts'
import { removeExtension } from './utils.ts'
import { type RecursiveFileTree, type VirtualFileSystemOptions } from './types/common.ts'

const BYPASS_FN = <T>(input: T) => input
const DEFAULT_GLOB = ['**/!(*.d).ts', '**/*.tsx', '**/*.js']

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
   * Files collect from the initial scan
   */
  #files: Set<string> = new Set()

  /**
   * Cache map storing parsed AST nodes by file path
   */
  #astCache: Map<string, SgNode> = new Map()

  /**
   * Matcher is defined when glob is defined via the options
   */
  #matcher: Matcher

  constructor(source: string, options?: VirtualFileSystemOptions) {
    this.#source = source
    this.#options = options ?? {}
    this.#matcher = picomatch(this.#options.glob ?? DEFAULT_GLOB, {
      posixSlashes: true,
      cwd: this.#source,
    })
  }

  /**
   * Scans the filesystem to collect the files. Newly files must
   * be added via the ".add" method.
   */
  async scan() {
    debug('fetching entities from source "%s"', this.#source)
    const fsDir = new fdir()
      .globWithOptions(this.#options.glob ?? DEFAULT_GLOB, {
        posixSlashes: true,
        cwd: this.#source,
      })
      .withFullPaths()

    const filesList = await fsDir.crawl(this.#source).withPromise()
    this.#files = new Set(filesList.sort(naturalSort))
  }

  /**
   * Check if a given file is part of the virtual file system. The method
   * checks for the scanned files as well if the globs
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
   * Returns the files as a flat list of key-value pair.
   */
  asList(options?: {
    transformKey?: (key: string) => string
    transformValue?: (filePath: string) => string
  }) {
    const list: { [key: string]: string } = {}
    const transformKey = options?.transformKey ?? BYPASS_FN
    const transformValue = options?.transformValue ?? BYPASS_FN

    this.#files.forEach((filePath) => {
      const key = removeExtension(relative(this.#source, filePath))
      list[transformKey(key)] = transformValue(filePath)
    })

    return list
  }

  /**
   * Returns the files as a nested tree
   */
  asTree(options?: {
    transformKey?: (key: string) => string
    transformValue?: (filePath: string) => string
  }) {
    const list: RecursiveFileTree = {}
    const transformKey = options?.transformKey ?? BYPASS_FN
    const transformValue = options?.transformValue ?? BYPASS_FN

    this.#files.forEach((filePath) => {
      const key = removeExtension(relative(this.#source, filePath))
      lodash.set(list, transformKey(key).split('/'), transformValue(filePath))
    })

    return list
  }

  /**
   * Add a new file to the virtual file system. File is only added when it
   * matches the pre-defined filters
   */
  add(filePath: string) {
    if (this.has(filePath)) {
      this.#files.add(filePath)
    }
  }

  /**
   * Add a new file to the virtual file system
   */
  remove(filePath: string) {
    this.#files.delete(filePath)
  }

  /**
   * Returns the file contents as AST-grep node and caches it
   * forever. Use the "invalidate" method to remove it from the
   * cache
   *
   * @param filePath - The path to the file to parse
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
   * Invalidates AST cache for a single file or all the files
   *
   * @param filePath - Optional file path to clear. If omitted, clears entire cache
   */
  invalidate(filePath?: string) {
    debug('invalidate AST cache "%s"', filePath)
    filePath ? this.#astCache.delete(filePath) : this.#astCache.clear()
  }

  /**
   * Clear all scanned files from the memory
   */
  clear() {
    this.#files.clear()
  }
}
