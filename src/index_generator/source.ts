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

export class IndexGeneratorSource {
  #appRoot: string
  #output: string
  #source: string
  #outputDirname: string
  #vfs: VirtualFileSystem
  #config: IndexGeneratorSourceConfig

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
