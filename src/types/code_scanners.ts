/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Represents a controller that has been scanned and analyzed by the routes scanner.
 * Contains metadata about the controller class and the specific method being called.
 *
 * @example
 * const controller: ScannedController = {
 *   name: 'UsersController',
 *   path: '/project/app/controllers/users_controller.ts',
 *   method: 'index',
 *   import: {
 *     type: 'default',
 *     specifier: '#controllers/users_controller',
 *     value: 'UsersController'
 *   }
 * }
 */
export type ScannedController = {
  /** The name of the controller class */
  name: string
  /** Absolute file path to the controller */
  path: string
  /** The method name being called on the controller */
  method: string
  /** Import information for the controller */
  import: {
    /** Import type (always 'default' for controllers) */
    type: 'default'
    /** Import specifier used to import the controller */
    specifier: string
    /** The imported value name */
    value: string
  }
}

/**
 * Represents a validator that has been extracted from controller methods.
 * Contains information about how the validator is imported and used.
 *
 * @example
 * const validator: ScannedValidator = {
 *   name: 'createUserValidator',
 *   import: {
 *     type: 'named',
 *     specifier: '#validators/user_validators',
 *     value: 'createUserValidator'
 *   }
 * }
 */
export type ScannedValidator = {
  /** The name/identifier of the validator */
  name: string
  /** Import information for the validator */
  import: {
    /** The type of import (namespace, default, or named) */
    type: 'namespace' | 'default' | 'named'
    /** The module specifier being imported from */
    specifier: string
    /** The imported value name */
    value: string
  }
}

/**
 * Output of a scanned route containing all extracted metadata including
 * controller information, validators, request/response types, and route patterns.
 *
 * @example
 * const scannedRoute: ScannedRoute = {
 *   name: 'users.store',
 *   methods: ['POST'],
 *   domain: 'root',
 *   pattern: '/users',
 *   tokens: [{ val: '/users', old: '/users', type: 0, end: '' }],
 *   request: {
 *     type: 'Infer<typeof createUserValidator>',
 *     imports: ['import { Infer } from "@vinejs/vine/types"']
 *   },
 *   response: {
 *     type: 'ReturnType<UsersController["store"]>',
 *     imports: []
 *   },
 *   validators: [{
 *     name: 'createUserValidator',
 *     import: { type: 'named', specifier: '#validators/user', value: 'createUserValidator' }
 *   }],
 *   controller: {
 *     name: 'UsersController',
 *     method: 'store',
 *     path: '/app/controllers/users_controller.ts',
 *     import: { type: 'default', specifier: '#controllers/users_controller', value: 'UsersController' }
 *   }
 * }
 */
export type ScannedRoute = {
  /**
   * A unique name for the route provided by AdonisJS http-server.
   * May be duplicate across different domains.
   */
  name: string

  /**
   * HTTP methods for which the route is defined (GET, POST, PUT, etc.)
   */
  methods: string[]

  /**
   * The domain on which the route is registered (typically 'root')
   */
  domain: string

  /**
   * The route pattern with parameter placeholders (e.g., '/users/:id')
   */
  pattern: string

  /**
   * Route tokens that can be used for constructing URIs without parsing the pattern.
   * Contains information about static and dynamic segments.
   */
  tokens: { val: string; old: string; type: 0 | 1 | 2 | 3; end: string }[]

  /**
   * Inferred request data type accepted by the route.
   * Generated when the route uses a controller with validators.
   */
  request?: {
    /** TypeScript type definition for the request data */
    type: string
    /** Import statements needed for the type definition */
    imports: string[]
  }

  /**
   * Inferred response type returned by the route.
   * Generated when the route uses a controller method.
   */
  response?: {
    /** TypeScript type definition for the response data */
    type: string
    /** Import statements needed for the type definition */
    imports: string[]
  }

  /**
   * Extracted validator information from the controller method.
   * Only present when using controller-based routes with validation.
   */
  validators?: ScannedValidator[]

  /**
   * Extracted controller information including class and method details.
   * Only present when using controller-based routes.
   */
  controller?: ScannedController
}

/**
 * The route data structure accepted by the routes scanner when initiating
 * the scanning process. This represents the raw route definition before analysis.
 *
 * @example
 * const routeItem: RoutesListItem = {
 *   name: 'users.store',
 *   pattern: '/users',
 *   domain: 'root',
 *   methods: ['POST'],
 *   controllerReference: {
 *     importExpression: "() => import('#controllers/users_controller')",
 *     method: 'store'
 *   },
 *   tokens: [{ val: '/users', old: '/users', type: 0, end: '' }]
 * }
 */
export type RoutesListItem = {
  /** Optional unique name for the route */
  name?: string
  /** Route pattern with parameter placeholders */
  pattern: string
  /** Domain on which the route is registered */
  domain: string
  /** HTTP methods accepted by this route */
  methods: string[]
  handler?: {
    method: string
    importExpression: string | null
  }
  /** Parsed route tokens for URI construction */
  tokens: { val: string; old: string; type: 0 | 1 | 2 | 3; end: string }[]
}

/**
 * The filter fn to exclude routes from being processed. Return true
 * to filter out (aka exclude) the route
 */
export type RoutesScannerFilterFn = (route: RoutesListItem) => boolean

/**
 * Configuration rules accepted by the routes scanner to customize
 * the scanning behavior and override type inference.
 *
 * @example
 * const rules: RoutesScannerRules = {
 *   skip: ['admin.dashboard', 'health.check'],
 *   response: {
 *     'users.index': {
 *       type: 'PaginatedResponse<User[]>',
 *       imports: ['import { User } from "#models/user"']
 *     }
 *   },
 *   request: {
 *     'users.store': {
 *       type: 'CreateUserRequest',
 *       imports: ['import { CreateUserRequest } from "#types/requests"']
 *     }
 *   }
 * }
 */
export type RoutesScannerRules = {
  /**
   * Define custom response types for specific routes by their name
   * or controller+method path. Overrides automatic type inference.
   */
  response: Record<string, ScannedRoute['response']>

  /**
   * Define custom request data types for specific routes by their name
   * or controller+method path. Overrides automatic type inference.
   */
  request: Record<string, ScannedRoute['response']>
}
