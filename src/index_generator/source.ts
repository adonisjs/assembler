/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import string from '@poppinss/utils/string'
import { type Logger } from '@poppinss/cliui'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path/posix'
import StringBuilder from '@poppinss/utils/string_builder'

import debug from '../debug.ts'
import { FileBuffer } from '../file_buffer.ts'
import { removeExtension, throttle } from '../utils.ts'
import { VirtualFileSystem } from '../virtual_file_system.ts'
import { type RecursiveFileTree, type IndexGeneratorSourceConfig } from '../types/common.ts'

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
   * CLI logger instance for output messages
   */
  #cliLogger: Logger

  /**
   * Generate the output content and write it to the output file
   *
   * This method creates the file buffer, populates it with the generated
   * content based on configuration, and writes it to disk.
   */
  #generateOutput = throttle(async () => {
    const buffer = new FileBuffer()

    if (this.#config.as === 'barrelFile') {
      this.#asBarrelFile(this.#vfs, buffer, this.#config.exportName)
    } else {
      this.#config.as(this.#vfs, buffer, this.#config, {
        toImportPath: this.#createBarrelFileImportGenerator(
          this.#source,
          this.#outputDirname,
          this.#config
        ),
      })
    }

    await mkdir(dirname(this.#output), { recursive: true })
    await writeFile(this.#output, buffer.flush())
  })

  /**
   * Unique name for this index generator source
   */
  public name: string

  /**
   * Create a new IndexGeneratorSource instance
   *
   * @param name - Unique name for this index generator source
   * @param appRoot - The application root directory path
   * @param cliLogger - Logger instance for CLI output
   * @param config - Configuration for this index generator source
   */
  constructor(
    name: string,
    appRoot: string,
    cliLogger: Logger,
    config: IndexGeneratorSourceConfig
  ) {
    this.name = name
    this.#config = config
    this.#appRoot = appRoot
    this.#cliLogger = cliLogger
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
        buffer.write(`${key}: ${value},`)
      } else {
        buffer.write(`${key}: {`).indent()
        this.#treeToString(value, buffer)
        buffer.dedent().write(`},`)
      }
    })
  }

  /**
   * Transforms the barrel file index key. Converts basename to PascalCase
   * and all other paths to camelCase
   *
   * @param config - Configuration containing suffix removal options
   * @returns Function that transforms file paths to appropriate keys
   */
  #createBarrelFileKeyGenerator(config: IndexGeneratorSourceConfig) {
    return function (key: string) {
      const paths = key.split('/')
      const baseName = new StringBuilder(paths.pop()!)
        .removeSuffix(config.removeSuffix ?? '')
        .pascalCase()
        .toString()
      return [...paths.map((p) => string.camelCase(p)), baseName].join('/')
    }
  }

  /**
   * Converts the file path to a lazy import. In case of an alias, the source
   * path is replaced with the alias, otherwise a relative import is created
   * from the output dirname.
   *
   * @param source - The source directory path
   * @param outputDirname - The output directory path
   * @param config - Configuration containing import alias options
   * @returns Function that converts file paths to import statements
   */
  #createBarrelFileImportGenerator(
    source: string,
    outputDirname: string,
    config: IndexGeneratorSourceConfig
  ) {
    return function (filePath: string) {
      if (config.importAlias) {
        debug('converting "%s" to import alias, source "%s"', filePath, source)
        return removeExtension(filePath.replace(source, config.importAlias))
      }
      debug('converting "%s" to relative import, source "%s"', filePath, outputDirname)
      return relative(outputDirname, filePath)
    }
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
    const keyGenerator = this.#createBarrelFileKeyGenerator(this.#config)
    const importGenerator = this.#createBarrelFileImportGenerator(
      this.#source,
      this.#outputDirname,
      this.#config
    )

    const tree = vfs.asTree({
      transformKey: keyGenerator,
      transformValue: (filePath) => {
        return `() => import('${importGenerator(filePath)}')`
      },
    })

    buffer.write(`export const ${exportName} = {`).indent()
    this.#treeToString(tree, buffer)
    buffer.dedent().write(`}`)
  }

  /**
   * Create a log action for tracking file generation progress
   *
   * @example
   * const action = this.#createLogAction()
   * // ... perform operations
   * action.displayDuration().succeeded()
   */
  #createLogAction() {
    return this.#cliLogger.action(`create ${this.#config.output}`)
  }

  /**
   * Add a file to the virtual file system and regenerate index if needed
   *
   * If the file matches the configured glob patterns, it will be added
   * to the virtual file system and the index file will be regenerated.
   *
   * @param filePath - Absolute path of the file to add
   */
  async addFile(filePath: string) {
    const added = this.#vfs.add(filePath)
    if (added) {
      debug('file added, re-generating "%s" index', this.name)
      const action = this.#createLogAction()
      await this.#generateOutput()
      action.displayDuration().succeeded()
    }
  }

  /**
   * Remove a file from the virtual file system and regenerate index if needed
   *
   * If the file was previously tracked, it will be removed from the
   * virtual file system and the index file will be regenerated.
   *
   * @param filePath - Absolute path of the file to remove
   */
  async removeFile(filePath: string) {
    const removed = this.#vfs.remove(filePath)
    if (removed) {
      debug('file removed, re-generating "%s" index', this.name)
      const action = this.#createLogAction()
      await this.#generateOutput()
      action.displayDuration().succeeded()
    }
  }

  /**
   * Generate the index file
   *
   * This method scans the source directory, processes files according to
   * the configuration, and writes the generated index file to disk.
   */
  async generate() {
    const action = this.#createLogAction()
    await this.#vfs.scan()
    await this.#generateOutput()
    action.displayDuration().succeeded()
  }
}
