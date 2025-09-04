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
 * Buffer class to construct template output with proper indentation and formatting.
 *
 * The FileBuffer class provides a fluent API for building text output with automatic
 * indentation management. It's commonly used for generating code or template files
 * where proper formatting is important.
 *
 * @example
 * const buffer = new FileBuffer()
 * buffer
 *   .writeLine('function example() {')
 *   .indent()
 *   .writeLine('return "Hello World"')
 *   .dedent()
 *   .writeLine('}')
 * console.log(buffer.flush())
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
   *
   * @returns A new FileBuffer instance
   */
  create() {
    return new FileBuffer()
  }

  /**
   * Returns the size of buffer text
   *
   * @returns The number of lines in the buffer
   */
  get size() {
    return this.#buffer.length
  }

  /**
   * Write a new line to the output with current indentation
   *
   * @param text - The text to write as a new line
   * @returns This FileBuffer instance for method chaining
   */
  writeLine(text: string): this {
    this.#buffer.push(`${' '.repeat(this.#identationSize)}${text}\n`)
    return this
  }

  /**
   * Write text to the output without adding a new line
   *
   * @param text - The text to write without a newline
   * @returns This FileBuffer instance for method chaining
   */
  write(text: string): this {
    this.#buffer.push(`${' '.repeat(this.#identationSize)}${text}`)
    return this
  }

  /**
   * Increase indentation by 2 spaces
   *
   * @returns This FileBuffer instance for method chaining
   */
  indent(): this {
    this.#identationSize += 2
    return this
  }

  /**
   * Decrease indentation by 2 spaces (minimum of 0)
   *
   * @returns This FileBuffer instance for method chaining
   */
  dedent(): this {
    this.#identationSize -= 2
    if (this.#identationSize < 0) {
      this.#identationSize = 0
    }

    return this
  }

  /**
   * Return template as a string, joining all buffer lines
   *
   * Once called, the output is cached and subsequent calls return the same result.
   * The flush method becomes a no-op after the first call.
   *
   * @returns The complete buffer content as a string
   */
  flush(): string {
    if (this.#compiledOutput !== undefined) {
      return this.#compiledOutput
    }

    this.#compiledOutput = this.#buffer.join(EOL)
    return this.#compiledOutput
  }
}
