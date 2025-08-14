/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export type ScannedController = {
  name: string
  path: string
  method: string
  import: {
    type: 'default'
    specifier: string
    value: string
  }
}

export type ScannedValidator = {
  name: string
  import: {
    type: 'namespace' | 'default' | 'named'
    specifier: string
    value: string
  }
}

/**
 * Output of scanned route
 */
export type ScannedRoute = {
  /**
   * A unique name for the route provided by AdonisJS http-server. It
   * could be duplicate across domains.
   */
  name: string

  /**
   * HTTP methods for which the route is defined
   */
  methods: string[]

  /**
   * HTTP method for which the route is defined
   */
  domain: string

  /**
   * The route pattern
   */
  pattern: string

  /**
   * Route tokens could be used for constructing a URI for
   * the route without parsing the pattern
   */
  tokens: { val: string; old: string; type: 0 | 1 | 2 | 3; end: string }[]

  /**
   * Inferred request data accepted by the route. By default, the request
   * data type is inferred when route is using a controller with a
   * validator
   */
  request?: {
    type: string
    imports: string[]
  }

  /**
   * Inferred response for the route. By default, the response is only
   * inferred when the route is using a controller.
   */
  response?: {
    type: string
    imports: string[]
  }

  /**
   * Extracted validators info, only when using the controller.
   */
  validators?: ScannedValidator[]

  /**
   * Extracted controller info, only when using the controller.
   */
  controller?: ScannedController
}

/**
 * The route accepted by the routes scanner when initiating
 * the scanning process.
 */
export type RoutesListItem = {
  name?: string
  pattern: string
  domain: string
  methods: string[]
  controllerReference?: {
    importExpression: string
    method?: string
  }
  tokens: { val: string; old: string; type: 0 | 1 | 2 | 3; end: string }[]
}

/**
 * Rules accepted by the route scanner.
 */
export type RoutesScannerRules = {
  /**
   * An array of route names or controller+method paths to skip from
   * the processing
   */
  skip: string[]

  /**
   * Define custom response type for a route by its name or the
   * controller+method path
   */
  response: Record<string, ScannedRoute['response']>

  /**
   * Define custom request data type for a route by its name
   * or the controller+method path
   */
  request: Record<string, ScannedRoute['response']>
}
