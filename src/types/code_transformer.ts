/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Entry to add a middleware to a given middleware stack
 * via the CodeTransformer
 */
export type MiddlewareNode = {
  /**
   * If you are adding a named middleware, then you must
   * define the name.
   */
  name?: string

  /**
   * The path to the middleware file
   *
   * @example
   *  `@adonisjs/static/static_middleware`
   *  `#middlewares/silent_auth.js`
   */
  path: string

  /**
   * The position to add the middleware. If `before`
   * middleware will be added at the first position and
   * therefore will be run before all others
   *
   * @default 'after'
   */
  position?: 'before' | 'after'
}

/**
 * Policy node to be added to the list of policies.
 */
export type BouncerPolicyNode = {
  /**
   * Policy name
   */
  name: string

  /**
   * Policy import path
   */
  path: string
}

/**
 * Defines the structure of an environment variable validation
 * definition
 */
export type EnvValidationNode = {
  /**
   * Write a leading comment on top of your variables
   */
  leadingComment?: string

  /**
   * A key-value pair of env variables and their validation
   *
   * @example
   *  MY_VAR: 'Env.schema.string.optional()'
   */
  variables: Record<string, string>
}

/**
 * The supported package managers for installing packages
 */
export type SupportedPackageManager = 'npm' | 'yarn' | 'yarn@berry' | 'pnpm' | 'bun'
