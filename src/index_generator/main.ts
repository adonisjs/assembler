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

export class IndexGenerator {
  #appRoot: string
  #sources: Record<string, IndexGeneratorSource> = {}

  constructor(appRoot: string) {
    this.#appRoot = appRoot
  }

  add(name: string, config: IndexGeneratorSourceConfig) {
    this.#sources[name] = new IndexGeneratorSource(this.#appRoot, config)
    return this
  }

  async regenerate() {}

  async generate() {
    const sources = Object.values(this.#sources)
    for (let source of sources) {
      await source.generate()
    }
  }
}
