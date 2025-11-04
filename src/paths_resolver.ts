/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import { resolve } from 'import-meta-resolve'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isRelative } from './utils.ts'

/**
 * Encapsulates the API to resolve import specifiers with the ability
 * to define custom resolver functions.
 *
 * The PathsResolver provides a caching mechanism to avoid resolving the same
 * specifier multiple times and supports custom resolvers for handling
 * special import patterns like path aliases.
 *
 * @example
 * const resolver = new PathsResolver()
 * resolver.use((specifier) => '/custom/path/' + specifier)
 * const resolved = resolver.resolve('#app/models/user')
 */
export class PathsResolver {
  /**
   * The root of the application from where we will resolve
   * paths.
   */
  #appRoot: string

  /**
   * Cache of resolved paths to avoid resolving the same specifier multiple times
   */
  #resolvedPaths: Record<string, string> = {}

  /**
   * The resolver function used to resolve import specifiers
   */
  #resolver: (specifier: string, parentPath: string) => string = (specifier, parentPath) =>
    resolve(specifier, parentPath)

  constructor(appRoot: string) {
    this.#appRoot = pathToFileURL(join(appRoot, 'index.js')).href
  }

  /**
   * Define a custom resolver that resolves a path
   *
   * The custom resolver function will be used instead of the default
   * import.meta.resolve() for resolving import specifiers.
   *
   * @param resolver - Function that takes a specifier and returns resolved path
   */
  use(resolver: (specifier: string) => string) {
    this.#resolver = resolver
  }

  /**
   * Resolve import specifier to an absolute file path
   *
   * This method caches resolved paths to improve performance on repeated
   * resolutions. Relative paths are not supported and will throw an error.
   *
   * @param specifier - The import specifier to resolve (must not be relative)
   * @returns The resolved absolute file path
   * @throws Error when attempting to resolve relative paths
   *
   * @example
   * const path = resolver.resolve('#app/models/user')
   * const path2 = resolver.resolve('@/utils/helper')
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

    this.#resolvedPaths[cacheKey] = fileURLToPath(this.#resolver(specifier, this.#appRoot))
    return this.#resolvedPaths[cacheKey]
  }
}
