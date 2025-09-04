/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import StringBuilder from '@poppinss/utils/string_builder'

import { FileBuffer } from '../file_buffer.ts'
import { VirtualFileSystem } from '../virtual_file_system.ts'
import { type RecursiveFileTree, type IndexGeneratorSourceConfig } from '../types/common.ts'
import { removeExtension } from '../utils.ts'

/**
 * IndexGeneratorSource handles the generation of a single index file.
 *
 * This class is responsible for scanning a source directory, processing files
 * according to configuration, and generating an index file that exports the
 * discovered modules. It supports both barrel file generation and custom
 * generation strategies.
 *
 * @example
 * const source = new IndexGeneratorSource(appRoot, {
 *   source: 'app/controllers',
 *   output: 'app/controllers/index.ts',
 *   as: 'barrelFile',
 *   exportName: 'controllers'
 * })
 * await source.generate()
 */
export class IndexGeneratorSource {
  /**
   * The application root directory path
   */
  #appRoot: string

  /**
   * The absolute path to the output file
   */
  #output: string

  /**
   * The absolute path to the source directory
   */
  #source: string

  /**
   * The directory containing the output file
   */
  #outputDirname: string

  /**
   * Virtual file system for scanning source files
   */
  #vfs: VirtualFileSystem

  /**
   * Configuration for this index generator source
   */
  #config: IndexGeneratorSourceConfig

  /**
   * Create a new IndexGeneratorSource instance
   *
   * @param appRoot - The application root directory path
   * @param config - Configuration for this index generator source
   */
  constructor(appRoot: string, config: IndexGeneratorSourceConfig) {
    this.#config = config
    this.#appRoot = appRoot
    this.#source = join(this.#appRoot, this.#config.source)
    this.#output = join(this.#appRoot, this.#config.output)
    this.#outputDirname = dirname(this.#output)
    this.#vfs = new VirtualFileSystem(this.#source, {
      glob: this.#config.glob,
    })
  }

  /**
   * Converts a recursive file tree to a string representation
   *
   * This method recursively processes a file tree structure and writes
   * it as JavaScript object notation to the provided buffer.
   *
   * @param input - The recursive file tree to convert
   * @param buffer - The file buffer to write the output to
   */
  #treeToString(input: RecursiveFileTree, buffer: FileBuffer) {
    Object.keys(input).forEach((key) => {
      const value = input[key]
      if (typeof value === 'string') {
        buffer.write(`'${key}': ${value},`)
      } else {
        buffer.write(`'${key}': {`).indent()
        this.#treeToString(value, buffer)
        buffer.dedent().write(`},`)
      }
    })
  }

  /**
   * Generate a barrel file export structure
   *
   * This method creates a nested object structure that represents all
   * discovered files as lazy imports, organized by directory structure.
   *
   * @param vfs - Virtual file system containing the scanned files
   * @param buffer - File buffer to write the barrel exports to
   * @param exportName - Name for the main export object
   */
  #asBarrelFile(vfs: VirtualFileSystem, buffer: FileBuffer, exportName: string) {
    const tree = vfs.asTree({
      /**
       * Transforming the key to convert basename to PascalCase and
       * all other paths to camelCase
       */
      transformKey: (key) => {
        const paths = key.split('/')
        const baseName = new StringBuilder(paths.pop()!)
          .removeSuffix(this.#config.removeSuffix ?? '')
          .pascalCase()
          .toString()
        return [...paths.map((p) => string.camelCase(p)), baseName].join('/')
      },

      /**
       * Converts the file path to a lazy import. Incase of an alias, the source
       * path is replaced with the alias, otherwise a relative import is created
       * from the output dirname
       */
      transformValue: (filePath) => {
        if (this.#config.importAlias) {
          return `() => import('${removeExtension(filePath.replace(this.#source, this.#config.importAlias))}')`
        }
        return `() => import('${relative(this.#outputDirname, filePath)}')`
      },
    })

    buffer.write(`export const ${exportName} = {`).indent()
    this.#treeToString(tree, buffer)
    buffer.dedent().write(`}`)
  }

  /**
   * Generate the index file
   *
   * This method scans the source directory, processes files according to
   * the configuration, and writes the generated index file to disk.
   */
  async generate() {
    await this.#vfs.scan()
    const buffer = new FileBuffer()

    if (this.#config.as === 'barrelFile') {
      this.#asBarrelFile(this.#vfs, buffer, this.#config.exportName)
    } else {
      this.#config.as(this.#vfs, buffer, this.#config)
    }

    await mkdir(dirname(this.#output), { recursive: true })
    await writeFile(this.#output, buffer.flush())
  }
}
