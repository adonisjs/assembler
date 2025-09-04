/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Logger } from '@poppinss/cliui'

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
  #cliLogger: Logger

  /**
   * Create a new IndexGenerator instance
   *
   * @param appRoot - The application root directory path
   * @param cliLogger - Logger instance for CLI output
   */
  constructor(appRoot: string, cliLogger: Logger) {
    this.#appRoot = appRoot
    this.#cliLogger = cliLogger
  }

  /**
   * Add a new index generator source
   *
   * @param name - Unique name for the source
   * @param config - Configuration for the index generator source
   * @returns This IndexGenerator instance for method chaining
   */
  add(name: string, config: IndexGeneratorSourceConfig) {
    this.#sources[name] = new IndexGeneratorSource(name, this.#appRoot, this.#cliLogger, config)
    return this
  }

  /**
   * Add a file to all registered index generator sources
   *
   * This method propagates the file addition to all registered sources,
   * allowing them to regenerate their index files if the new file matches
   * their glob patterns.
   *
   * @param filePath - Absolute path of the file to add
   */
  async addFile(filePath: string) {
    const sources = Object.values(this.#sources)
    for (let source of sources) {
      await source.addFile(filePath)
    }
  }

  /**
   * Remove a file from all registered index generator sources
   *
   * This method propagates the file removal to all registered sources,
   * allowing them to regenerate their index files if the removed file
   * was previously tracked.
   *
   * @param filePath - Absolute path of the file to remove
   */
  async removeFile(filePath: string) {
    const sources = Object.values(this.#sources)
    for (let source of sources) {
      await source.removeFile(filePath)
    }
  }

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
