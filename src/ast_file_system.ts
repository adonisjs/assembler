/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { readFile } from 'node:fs/promises'
import { Lang, parse, type SgNode } from '@ast-grep/napi'

import debug from './debug.ts'

/**
 * An abstraction around converting files to an AST and caching
 * them forever. The cache could be cleared manually.
 */
export class AstFileSystem {
  #cache: Map<string, SgNode> = new Map()

  /**
   * Returns the file contents as AST-grep node and caches it
   * forever.
   */
  async get(filePath: string): Promise<SgNode> {
    const cached = this.#cache.get(filePath)
    if (cached) {
      debug('returning AST nodes from cache "%s"', filePath)
      return cached
    }

    const fileContents = await readFile(filePath, 'utf-8')
    debug('parsing "%s" file to AST', filePath)
    this.#cache.set(filePath, parse(Lang.TypeScript, fileContents).root())
    return this.#cache.get(filePath)!
  }

  /**
   * Clear AST cache for a single file or all the files
   */
  clear(filePath?: string) {
    debug('clear AST cache "%s"', filePath)
    filePath ? this.#cache.delete(filePath) : this.#cache.clear()
  }
}
