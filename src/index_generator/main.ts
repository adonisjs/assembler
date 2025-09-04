/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { IndexGeneratorSource } from './source.ts'
import { type IndexGeneratorSourceConfig } from '../types/common.ts'

/**
 * IndexGenerator manages the generation of index files for AdonisJS applications.
 *
 * This class provides a way to configure multiple sources and generate index files
 * that export collections of modules, typically used for barrel exports or
 * auto-discovery patterns in AdonisJS applications.
 *
 * @example
 * const generator = new IndexGenerator(appRoot)
 * generator.add('controllers', {
 *   source: 'app/controllers',
 *   output: 'app/controllers/index.ts',
 *   as: 'barrelFile',
 *   exportName: 'controllers'
 * })
 * await generator.generate()
 */
export class IndexGenerator {
  /**
   * The application root directory path
   */
  #appRoot: string

  /**
   * Collection of registered index generator sources
   */
  #sources: Record<string, IndexGeneratorSource> = {}

  /**
   * Create a new IndexGenerator instance
   *
   * @param appRoot - The application root directory path
   */
  constructor(appRoot: string) {
    this.#appRoot = appRoot
  }

  /**
   * Add a new index generator source
   *
   * @param name - Unique name for the source
   * @param config - Configuration for the index generator source
   * @returns This IndexGenerator instance for method chaining
   */
  add(name: string, config: IndexGeneratorSourceConfig) {
    this.#sources[name] = new IndexGeneratorSource(this.#appRoot, config)
    return this
  }

  /**
   * Regenerate all registered index files
   *
   * This method is currently a placeholder for future implementation.
   */
  async regenerate() {}

  /**
   * Generate all registered index files
   *
   * Iterates through all registered sources and generates their
   * corresponding index files.
   */
  async generate() {
    const sources = Object.values(this.#sources)
    for (let source of sources) {
      await source.generate()
    }
  }
}
