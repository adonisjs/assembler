/*
 * edge-parser
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { EOL } from 'node:os'

/**
 * Buffer class to construct template
 */
export class FileBuffer {
  /**
   * Collected lines
   */
  #buffer: string[] = []

  /**
   * Current indentation size. Each call to indent will increment
   * it by 2
   */
  #identationSize = 0

  /**
   * Cached compiled output. Once this value is set, the `flush`
   * method will become a noop
   */
  #compiledOutput: string | undefined

  /**
   * Creates a new child buffer instance
   */
  create() {
    return new FileBuffer()
  }

  /**
   * Returns the size of buffer text
   */
  get size() {
    return this.#buffer.length
  }

  /**
   * Write a new line to the output
   */
  writeLine(text: string): this {
    this.#buffer.push(`${' '.repeat(this.#identationSize)}${text}\n`)
    return this
  }

  /**
   * Write text to the output without adding a new line
   */
  write(text: string): this {
    this.#buffer.push(`${' '.repeat(this.#identationSize)}${text}`)
    return this
  }

  /**
   * Increase indentation
   */
  indent(): this {
    this.#identationSize += 2
    return this
  }

  /**
   * Decrease indentation
   */
  dedent(): this {
    this.#identationSize -= 2
    if (this.#identationSize < 0) {
      this.#identationSize = 0
    }

    return this
  }

  /**
   * Return template as a string
   */
  flush(): string {
    if (this.#compiledOutput !== undefined) {
      return this.#compiledOutput
    }

    this.#compiledOutput = this.#buffer.join(EOL)
    return this.#compiledOutput
  }
}
