/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'
import { isRelative } from './utils.ts'

/**
 * Encapsulates the API to resolve import specifiers with the ability
 * to define customer resolver.
 *
 * @example
 * const resolver = new PathsResolver()
 * resolver.use((specifier) => '/custom/path/' + specifier)
 * const resolved = resolver.resolve('#app/models/user')
 */
export class PathsResolver {
  /**
   * Cache of resolved paths to avoid resolving the same specifier multiple times
   */
  #resolvedPaths: Record<string, string> = {}

  /**
   * The resolver function used to resolve import specifiers
   */
  #resolver: (specifier: string) => string = (specifier) => import.meta.resolve(specifier)

  /**
   * Define a custom resolver that resolves a path
   *
   * @param resolver - Function that takes a specifier and returns resolved path
   */
  use(resolver: (specifier: string) => string) {
    this.#resolver = resolver
  }

  /**
   * Resolve import specifier
   *
   * @param specifier - The import specifier to resolve
   * @returns The resolved absolute file path
   *
   * @example
   * const path = resolver.resolve('#app/models/user')
   */
  resolve(specifier: string) {
    if (isRelative(specifier)) {
      throw new Error('Cannot resolve relative paths using PathsResolver')
    }

    const cacheKey = specifier
    const cached = this.#resolvedPaths[cacheKey]
    if (cached) {
      return cached
    }

    this.#resolvedPaths[cacheKey] = fileURLToPath(this.#resolver(specifier))
    return this.#resolvedPaths[cacheKey]
  }
}
