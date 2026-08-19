/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type ImportInfo } from '@poppinss/utils'

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
 * Configuration for creating a new validator file via CodeTransformer.
 * Represents the structure needed to generate validator files.
 *
 * @example
 * const validator: ValidatorNode = {
 *   validatorFileName: 'create_user',
 *   exportName: 'createUserValidator',
 *   contents: 'export const createUserValidator = vine.compile(...)'
 * }
 */
export type ValidatorNode = {
  /** The filename for the validator (without extension) */
  validatorFileName: string
  /** The name of the exported validator constant or function */
  exportName: string
  /** The complete file contents including the validator definition */
  contents: string
}

/**
 * Configuration for creating a new rate limiter file via CodeTransformer.
 * Represents the structure needed to generate limiter files.
 *
 * @example
 * const limiter: LimiterNode = {
 *   limiterFileName: 'api_throttle',
 *   exportName: 'apiThrottleLimiter',
 *   contents: 'export const apiThrottleLimiter = limiter.define(...)'
 * }
 */
export type LimiterNode = {
  /** The filename for the limiter (without extension) */
  limiterFileName: string
  /** The name of the exported limiter constant or function */
  exportName: string
  /** The complete file contents including the limiter definition */
  contents: string
}

/**
 * Definition for applying a mixin to a model class.
 * Mixins extend model functionality by adding methods, properties, or behaviors.
 *
 * @example
 * const mixin: MixinDefinition = {
 *   name: 'SoftDeletes',
 *   importPath: '@adonisjs/lucid/mixins/soft_deletes',
 *   importType: 'named'
 * }
 *
 * @example
 * const mixinWithArgs: MixinDefinition = {
 *   name: 'Sluggable',
 *   args: ['title', '{ strategy: "dbIncrement" }'],
 *   importPath: '#mixins/sluggable',
 *   importType: 'default'
 * }
 */
export type MixinDefinition = {
  /** The name of the mixin function or class */
  name: string
  /** Optional arguments to pass to the mixin function */
  args?: string[]
  /** The import path to the mixin module */
  importPath: string
  /** Whether the mixin is exported as named or default export */
  importType: 'named' | 'default'
}

/**
 * Configuration for adding a new method to an existing controller class.
 * Used by CodeTransformer to inject methods into controller files.
 *
 * @example
 * const method: ControllerMethodNode = {
 *   controllerFileName: 'users_controller',
 *   className: 'UsersController',
 *   name: 'destroy',
 *   contents: 'async destroy({ params, response }: HttpContext) { ... }',
 *   imports: [
 *     { isType: false, isNamed: true, name: 'HttpContext', path: '@adonisjs/core/http' }
 *   ]
 * }
 */
export type ControllerMethodNode = {
  /** The controller filename (without extension) */
  controllerFileName: string
  /** The name of the controller class */
  className: string
  /** The name of the method to add */
  name: string
  /** The complete method implementation including signature and body */
  contents: string
  /** Optional imports needed by the method */
  imports?: ImportInfo[]
}

/**
 * Configuration for adding hooks to adonisrc.ts file.
 * Hooks can be defined as thunks (lazy imports) or direct imports.
 *
 * @example
 * // Thunk style (lazy import)
 * const thunkHook: HookNode = {
 *   type: 'thunk',
 *   path: './commands/migrate.js'
 * }
 *
 * @example
 * // Import style with named export
 * const importHook: HookNode = {
 *   type: 'import',
 *   path: '#hooks/after_build',
 *   name: 'afterBuildHook'
 * }
 */
export type HookNode =
  | {
      /** Hook type: thunk creates a lazy import function */
      type: 'thunk'
      /** Path to the hook module */
      path: string
    }
  | {
      /** Hook type: import directly imports the hook */
      type: 'import'
      /** Path to the hook module */
      path: string
      /** Optional name of the exported hook (for named exports) */
      name?: string
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
export type SupportedPackageManager =
  'npm' | 'yarn' | 'yarn@berry' | 'pnpm' | 'bun' | 'nub' | 'aube'
