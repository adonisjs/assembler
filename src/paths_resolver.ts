/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'

/**
 * Encapsulates the API to resolve import specifiers with the ability
 * to define customer resolver.
 */
export class PathsResolver {
  #resolvedPaths: Record<string, string> = {}
  #resolver: (specifier: string) => string = (specifier) => import.meta.resolve(specifier)

  /**
   * Define a custom resolver that resolves a path
   */
  use(resolver: (specifier: string) => string) {
    this.#resolver = resolver
  }

  /**
   * Resolve import specifier
   */
  resolve(specifier: string) {
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      throw new Error('Cannot resolve relative paths')
    }

    const cached = this.#resolvedPaths[specifier]
    if (cached) {
      return cached
    }

    this.#resolvedPaths[specifier] = fileURLToPath(this.#resolver(specifier))
    return this.#resolvedPaths[specifier]
  }
}
