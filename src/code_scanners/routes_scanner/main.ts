/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { cliui } from '@poppinss/cliui'
import string from '@poppinss/utils/string'
import { parseImports } from 'parse-imports'
import { type AsyncOrSync } from '@poppinss/utils/types'
import StringBuilder from '@poppinss/utils/string_builder'

import debug from '../../debug.ts'
import { type AsRequired } from '../../types/common.ts'
import { PathsResolver } from '../../paths_resolver.ts'
import { extractValidators } from './validator_extractor.ts'
import { VirtualFileSystem } from '../../virtual_file_system.ts'
import {
  type ScannedRoute,
  type RoutesListItem,
  type ScannedController,
  type RoutesScannerRules,
} from '../../types/code_scanners.ts'

/**
 * RoutesScanner is responsible for scanning application routes,
 * extracting their controllers, validators, request and response types.
 *
 * The RoutesScanner analyzes route definitions to extract TypeScript type information
 * for request validation, response types, and controller methods. It supports custom
 * rules for overriding default behavior and provides hooks for extending functionality.
 *
 * @example
 * const scanner = new RoutesScanner(appRoot, [rules])
 * scanner.defineResponse((route, controller) => {
 *   return { type: 'CustomResponseType', imports: [] }
 * })
 * await scanner.scan(routes)
 * const scannedRoutes = scanner.getScannedRoutes()
 */
export class RoutesScanner {
  /**
   * The root of the application from where we will resolve
   * paths.
   */
  #appRoot: string

  /**
   * Collection of routes by their controller file path. This helps
   * us re-compute request types when the controller is changed.
   */
  #controllerRoutes: Record<string, ScannedRoute[]> = {}

  /**
   * Collection of scanned routes
   */
  #scannedRoutes: ScannedRoute[] = []

  /**
   * A custom method to self compute the response type for a route. Return
   * undefined to fallback to the default behavior
   */
  #computeResponseTypes?: (
    route: ScannedRoute,
    controller: ScannedController,
    scanner: RoutesScanner
  ) => AsyncOrSync<ScannedRoute['response']>

  /**
   * A custom method to self compute the request type for a route. Return
   * undefined to fallback to the default behavior
   */
  #computeRequestTypes?: (
    route: ScannedRoute,
    controller: ScannedController,
    scanner: RoutesScanner
  ) => AsyncOrSync<ScannedRoute['request']>

  /**
   * A custom method to self extract the validators from the route controller.
   * Return undefined to fallback to the default behavior.
   */
  #extractValidators?: (
    route: ScannedRoute,
    controller: ScannedController,
    scanner: RoutesScanner
  ) => AsyncOrSync<ScannedRoute['validators']>

  /**
   * CLI UI instance to log colorful messages and progress information
   */
  ui = cliui()

  /**
   * The paths resolver is used to convert subpath and package
   * imports to absolute paths
   */
  pathsResolver = new PathsResolver()

  /**
   * The rules to apply when scanning routes
   */
  rules: RoutesScannerRules = {
    skip: [],
    request: {},
    response: {},
  }

  /**
   * Create a new RoutesScanner instance
   *
   * @param appRoot - The root directory of the application
   * @param rulesCollection - Collection of rules to apply during scanning
   */
  constructor(appRoot: string, rulesCollection: RoutesScannerRules[]) {
    this.#appRoot = appRoot

    rulesCollection.forEach((rules) => {
      this.rules.skip = this.rules.skip.concat(rules.skip)
      Object.assign(this.rules.request, rules.request)
      Object.assign(this.rules.response, rules.response)
    })

    /**
     * Removing duplicates
     */
    this.rules.skip = Array.from(new Set([...this.rules.skip]))
  }

  /**
   * Assumes the validators are from VineJS and computes the request types from them
   *
   * This method generates TypeScript type definitions for request validation
   * by analyzing VineJS validators and creating Infer types.
   *
   * @param route - The scanned route with validators
   * @returns Request type definition or undefined
   */
  #prepareRequestTypes(route: ScannedRoute): ScannedRoute['request'] {
    if (!route.validators) {
      return
    }

    const schemas = route.validators.reduce((result, validator) => {
      const validatorExport =
        validator.import.type === 'default'
          ? '.default'
          : validator.import.type === 'named'
            ? `.${validator.import.value}`
            : ''

      const [, ...segments] = validator.name.split('.')
      const namespace = segments.map((segment) => `['${segment}']`).join('')

      result.push(
        `Infer<(typeof import('${validator.import.specifier}')${validatorExport})${namespace}>`
      )

      return result
    }, [] as string[])

    return {
      type: schemas.join('|'),
      imports: [`import { Infer } from '@vinejs/vine/types'`],
    }
  }

  /**
   * Inspects the controller reference and fetches its import specifier
   * and the controller name from it.
   */
  async #inspectControllerSpecifier(
    importExpression: string,
    method?: string
  ): Promise<ScannedRoute['controller'] | null> {
    const imports = [...(await parseImports(importExpression))]
    const importedModule = imports.find(
      ($import) => $import.isDynamicImport && $import.moduleSpecifier.value
    )

    /**
     * The provided expression was not a lazy load import.
     */
    if (
      !importedModule ||
      importedModule.moduleSpecifier.type !== 'package' ||
      !importedModule.moduleSpecifier.value
    ) {
      return null
    }

    const specifier = importedModule.moduleSpecifier.value
    const name = new StringBuilder(specifier.split('/').pop()!)
      .removeSuffix('Controller')
      .pascalCase()
      .suffix('Controller')
      .toString()

    return {
      name,
      method: method ?? 'handle',
      path: string.toUnixSlash(this.pathsResolver.resolve(specifier)),
      import: {
        specifier,
        type: 'default',
        value: name,
      },
    }
  }

  /**
   * Defines the response type for the route
   */
  async #setResponse(route: ScannedRoute, controller: ScannedController) {
    const responseType = await this.#computeResponseTypes?.(route, controller, this)
    route.response = responseType ?? {
      type: `ReturnType<import('${controller.import.specifier}').default['${controller.method}']>`,
      imports: [],
    }
  }

  /**
   * Defines the request type for the route
   */
  async #setRequest(route: ScannedRoute, controller: ScannedController, vfs: VirtualFileSystem) {
    route.validators =
      (await this.#extractValidators?.(route, controller, this)) ??
      (await extractValidators(this.#appRoot, vfs, controller))
    route.request =
      (await this.#computeRequestTypes?.(route, controller, this)) ??
      this.#prepareRequestTypes(route)
  }

  /**
   * Scans a route that is not using a controller
   */
  #processRouteWithoutController(route: RoutesListItem) {
    if (!route.name) {
      debug(`skipping route "%s" scanning. Missing a controller reference`, route.name)
      return
    }

    const scannedRoute: ScannedRoute = {
      name: route.name,
      domain: route.domain,
      methods: route.methods,
      pattern: route.pattern,
      tokens: route.tokens,
      request: this.rules.request[route.name],
      response: this.rules.response[route.name],
    }
    this.#scannedRoutes.push(scannedRoute)
  }

  /**
   * Scans a route that is using a controller reference
   */
  async #processRouteWithController(
    route: AsRequired<RoutesListItem, 'controllerReference'>,
    vfs: VirtualFileSystem
  ) {
    const controller = await this.#inspectControllerSpecifier(
      route.controllerReference.importExpression,
      route.controllerReference.method
    )

    /**
     * Process route without a controller when we are not able to extract the import
     * path of the controller, because the import path is needed to further extract
     * request and response types.
     */
    if (!controller) {
      return this.#processRouteWithoutController(route)
    }

    /**
     * Converting controller name and its method to snake_case to create a unique
     * name for the route. There could be chances where one controller+method
     * combination is bound to multiple routes.
     */
    const routeName =
      route.name ??
      new StringBuilder(controller.name)
        .removeSuffix('Controller')
        .snakeCase()
        .suffix(`.${string.snakeCase(controller.method)}`)
        .toString()

    /**
     * Skip route when its name is within the array of
     * skip routes
     */
    if (this.rules.skip.includes(routeName)) {
      return
    }

    /**
     * Creating a scanned route and tracking it. We will inspect the response
     * and request if these values are not provided via rules.
     */
    const scannedRoute: ScannedRoute = {
      name: routeName,
      domain: route.domain,
      methods: route.methods,
      pattern: route.pattern,
      tokens: route.tokens,
      request: this.rules.request[routeName],
      response: this.rules.response[routeName],
      controller,
    }

    this.#scannedRoutes.push(scannedRoute)

    /**
     * Track route next to the controller absolute path. This way we will be
     * able to invalidate request types everytime the controller is modified.
     */
    if (!scannedRoute.request || !scannedRoute.response) {
      this.#controllerRoutes[controller.path] ??= []
      this.#controllerRoutes[controller.path].push(scannedRoute)

      if (!scannedRoute.response) {
        await this.#setResponse(scannedRoute, controller)
      }

      if (!scannedRoute.request) {
        await this.#setRequest(scannedRoute, controller, vfs)
      }
    }
  }

  /**
   * Processing a given route list item and further scan it to
   * fetch the controller, request and response types.
   */
  async #processRoute(route: RoutesListItem, vfs: VirtualFileSystem) {
    /**
     * Skip route when it has a name and also part of
     * skip array
     */
    if (route.name && this.rules.skip.includes(route.name)) {
      return
    }

    /**
     * Routes without a controller reference cannot have types for the request
     * and response (unless provided via rules)
     */
    if (!route.controllerReference) {
      this.#processRouteWithoutController(route)
      return
    }

    await this.#processRouteWithController(
      route as AsRequired<RoutesListItem, 'controllerReference'>,
      vfs
    )
  }

  /**
   * Register a callback to self compute the response types for
   * a given route. The callback will be executed for all
   * the routes and you must return undefined to fallback
   * to the default behavior of detecting types
   *
   * @param callback - Function to compute response types for routes
   * @returns This RoutesScanner instance for method chaining
   */
  defineResponse(
    callback: (
      route: ScannedRoute,
      controller: ScannedController,
      scanner: RoutesScanner
    ) => AsyncOrSync<ScannedRoute['response']>
  ): this {
    this.#computeResponseTypes = callback
    return this
  }

  /**
   * Register a callback to self compute the request types for
   * a given route. The callback will be executed for all
   * the routes and you must return undefined to fallback
   * to the default behavior of detecting types
   *
   * @param callback - Function to compute request types for routes
   * @returns This RoutesScanner instance for method chaining
   */
  defineRequest(
    callback: (
      route: ScannedRoute,
      controller: ScannedController,
      scanner: RoutesScanner
    ) => AsyncOrSync<ScannedRoute['request']>
  ): this {
    this.#computeRequestTypes = callback
    return this
  }

  /**
   * Register a callback to extract validators from the route controller
   *
   * @param callback - Function to extract validators from controllers
   * @returns This RoutesScanner instance for method chaining
   */
  extractValidators(
    callback: (
      route: ScannedRoute,
      controller: ScannedController,
      scanner: RoutesScanner
    ) => AsyncOrSync<ScannedRoute['validators']>
  ): this {
    this.#extractValidators = callback
    return this
  }

  /**
   * Returns the scanned routes
   *
   * @returns Array of scanned routes with their metadata
   */
  getScannedRoutes() {
    return this.#scannedRoutes
  }

  /**
   * Returns an array of controllers bound to the provided
   * routes
   *
   * @returns Array of controller's absolute paths
   */
  getControllers() {
    return Object.keys(this.#controllerRoutes)
  }

  /**
   * Invalidating a controller will trigger computing the validators,
   * request types and the response types.
   *
   * @param controllerPath - Path to the controller file to invalidate
   */
  async invalidate(controllerPath: string) {
    controllerPath = string.toUnixSlash(controllerPath)
    const controllerRoutes = this.#controllerRoutes[controllerPath]
    if (!controllerRoutes) {
      return
    }

    for (let scannedRoute of controllerRoutes) {
      if (scannedRoute.controller) {
        const vfs = new VirtualFileSystem(this.#appRoot)
        await this.#setResponse(scannedRoute, scannedRoute.controller)
        await this.#setRequest(scannedRoute, scannedRoute.controller, vfs)
      }
    }
  }

  /**
   * Scans an array of Route list items and fetches their validators,
   * controllers, and request/response types.
   *
   * This is the main method that processes all routes and extracts
   * their type information for code generation purposes.
   *
   * @param routes - Array of route list items to scan
   */
  async scan(routes: RoutesListItem[]) {
    const vfs = new VirtualFileSystem(this.#appRoot)
    for (let route of routes) {
      await this.#processRoute(route, vfs)
    }
    vfs.invalidate()
  }
}
