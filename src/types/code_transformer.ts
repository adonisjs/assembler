/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Entry to add a middleware to a given middleware stack via the CodeTransformer.
 * Represents middleware configuration for server, router, or named middleware stacks.
 *
 * @example
 * const corsMiddleware: MiddlewareNode = {
 *   path: '@adonisjs/cors/cors_middleware',
 *   position: 'before'
 * }
 *
 * const namedMiddleware: MiddlewareNode = {
 *   name: 'auth',
 *   path: '#middleware/auth_middleware',
 *   position: 'after'
 * }
 */
export type MiddlewareNode = {
  /**
   * Required for named middleware. The key name under which the middleware
   * will be registered in the named middleware collection.
   */
  name?: string

  /**
   * The import path to the middleware file. Can be a package import,
   * subpath import, or relative path.
   *
   * @example
   * '@adonisjs/static/static_middleware'
   * '#middlewares/silent_auth'
   * './middleware/custom_middleware.js'
   */
  path: string

  /**
   * The position to add the middleware in the stack.
   * 'before' adds at the beginning (runs first), 'after' adds at the end (runs last).
   *
   * @default 'after'
   */
  position?: 'before' | 'after'
}

/**
 * Policy node to be added to the list of Bouncer authorization policies.
 * Used for registering policies in the application's policy registry.
 *
 * @example
 * const userPolicy: BouncerPolicyNode = {
 *   name: 'UserPolicy',
 *   path: '#policies/user_policy'
 * }
 */
export type BouncerPolicyNode = {
  /**
   * The name of the policy class (should match the exported class name)
   */
  name: string

  /**
   * The import path to the policy file
   */
  path: string
}

/**
 * Defines the structure of an environment variable validation definition.
 * Used to add new environment variable validations to the start/env.ts file.
 *
 * @example
 * const envValidation: EnvValidationNode = {
 *   leadingComment: 'Database configuration',
 *   variables: {
 *     DB_HOST: 'Env.schema.string()',
 *     DB_PORT: 'Env.schema.number.optional({ port: 5432 })',
 *     DB_PASSWORD: 'Env.schema.string.optional()'
 *   }
 * }
 */
export type EnvValidationNode = {
  /**
   * Optional leading comment to write above the variable definitions.
   * Helps group related environment variables together.
   */
  leadingComment?: string

  /**
   * A key-value pair of environment variables and their validation schemas.
   * The key is the environment variable name, the value is the validation code.
   *
   * @example
   * {
   *   MY_VAR: 'Env.schema.string.optional()',
   *   API_KEY: 'Env.schema.string()'
   * }
   */
  variables: Record<string, string>
}

/**
 * The supported package managers for installing packages and managing lockfiles.
 * Each package manager has specific lockfiles and install commands.
 *
 * @example
 * const packageManager: SupportedPackageManager = 'pnpm'
 *
 * // Used in bundler configuration
 * const bundler = new Bundler(cwd, ts, { packageManager: 'yarn@berry' })
 */
export type SupportedPackageManager = 'npm' | 'yarn' | 'yarn@berry' | 'pnpm' | 'bun'
