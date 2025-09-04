/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'
import {
  Node,
  type Project,
  type SourceFile,
  SyntaxKind,
  type CallExpression,
  type PropertyAssignment,
  type FormatCodeSettings,
  type ArrayLiteralExpression,
} from 'ts-morph'
import { type AssemblerRcFile } from '../types/common.ts'

const ALLOWED_ENVIRONMENTS = ['web', 'console', 'test', 'repl'] as const

/**
 * RcFileTransformer is used to transform the `adonisrc.ts` file
 * for adding new commands, providers, meta files etc.
 *
 * This class provides a fluent API for modifying the AdonisJS configuration
 * file (adonisrc.ts) by adding various types of entries like providers,
 * commands, preloaded files, meta files, and test suites.
 *
 * @example
 * const transformer = new RcFileTransformer(cwd, project)
 * transformer.addProvider('#providers/app_provider')
 * transformer.addCommand('#commands/make_controller')
 * await transformer.save()
 */
export class RcFileTransformer {
  /**
   * The current working directory URL
   */
  #cwd: URL

  /**
   * The TsMorph project instance
   */
  #project: Project

  /**
   * Settings to use when persisting files
   */
  #editorSettings: FormatCodeSettings = {
    indentSize: 2,
    convertTabsToSpaces: true,
    trimTrailingWhitespace: true,
    ensureNewLineAtEndOfFile: true,
    indentStyle: 2,
    // @ts-expect-error SemicolonPreference doesn't seem to be re-exported from ts-morph
    semicolons: 'remove',
  }

  /**
   * Create a new RcFileTransformer instance
   *
   * @param cwd - The current working directory URL
   * @param project - The TsMorph project instance
   */
  constructor(cwd: URL, project: Project) {
    this.#cwd = cwd
    this.#project = project
  }

  /**
   * Get the `adonisrc.ts` source file
   *
   * @returns The adonisrc.ts source file
   * @throws Error if the file cannot be found
   */
  #getRcFileOrThrow() {
    const kernelUrl = fileURLToPath(new URL('./adonisrc.ts', this.#cwd))
    return this.#project.getSourceFileOrThrow(kernelUrl)
  }

  /**
   * Check if environments array has a subset of available environments
   *
   * @param environments - Optional array of environment names
   * @returns True if the provided environments are a subset of available ones
   */
  #isInSpecificEnvironment(environments?: (typeof ALLOWED_ENVIRONMENTS)[number][]): boolean {
    if (!environments) {
      return false
    }

    return !!ALLOWED_ENVIRONMENTS.find((env) => !environments.includes(env))
  }

  /**
   * Locate the `defineConfig` call inside the `adonisrc.ts` file
   *
   * @param file - The source file to search in
   * @returns The defineConfig call expression
   * @throws Error if defineConfig call cannot be found
   */
  #locateDefineConfigCallOrThrow(file: SourceFile) {
    const call = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .find((statement) => statement.getExpression().getText() === 'defineConfig')

    if (!call) {
      throw new Error('Could not locate the defineConfig call.')
    }

    return call
  }

  /**
   * Return the ObjectLiteralExpression of the defineConfig call
   *
   * @param defineConfigCall - The defineConfig call expression
   * @returns The configuration object literal expression
   * @throws Error if the object literal cannot be found
   */
  #getDefineConfigObjectOrThrow(defineConfigCall: CallExpression) {
    const configObject = defineConfigCall
      .getArguments()[0]
      .asKindOrThrow(SyntaxKind.ObjectLiteralExpression)

    return configObject
  }

  /**
   * Check if the defineConfig() call has the property assignment
   * inside it or not. If not, it will create one and return it.
   *
   * @param propertyName - The name of the property to find or create
   * @param initializer - The initial value if the property needs to be created
   * @returns The property assignment node
   */
  #getPropertyAssignmentInDefineConfigCall(propertyName: string, initializer: string) {
    const file = this.#getRcFileOrThrow()
    const defineConfigCall = this.#locateDefineConfigCallOrThrow(file)
    const configObject = this.#getDefineConfigObjectOrThrow(defineConfigCall)

    let property = configObject.getProperty(propertyName)

    if (!property) {
      configObject.addPropertyAssignment({ name: propertyName, initializer })
      property = configObject.getProperty(propertyName)
    }

    return property as PropertyAssignment
  }

  /**
   * Extract list of imported modules from an ArrayLiteralExpression
   *
   * It assumes that the array can have two types of elements:
   *
   * - Simple lazy imported modules: [() => import('path/to/file')]
   * - Or an object entry: [{ file: () => import('path/to/file'), environment: ['web', 'console'] }]
   *   where the `file` property is a lazy imported module.
   */
  #extractModulesFromArray(array: ArrayLiteralExpression) {
    const modules = array.getElements().map((element) => {
      /**
       * Simple lazy imported module
       */
      if (Node.isArrowFunction(element)) {
        const importExp = element.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression)
        const literal = importExp.getFirstDescendantByKindOrThrow(SyntaxKind.StringLiteral)
        return literal.getLiteralValue()
      }

      /**
       * Object entry
       */
      if (Node.isObjectLiteralExpression(element)) {
        const fileProp = element.getPropertyOrThrow('file') as PropertyAssignment
        const arrowFn = fileProp.getFirstDescendantByKindOrThrow(SyntaxKind.ArrowFunction)
        const importExp = arrowFn.getFirstDescendantByKindOrThrow(SyntaxKind.CallExpression)
        const literal = importExp.getFirstDescendantByKindOrThrow(SyntaxKind.StringLiteral)
        return literal.getLiteralValue()
      }
    })

    return modules.filter(Boolean) as string[]
  }

  /**
   * Extract a specific property from an ArrayLiteralExpression
   * that contains object entries.
   *
   * This function is mainly used for extractring the `pattern` property
   * when adding a new meta files entry, or the `name` property when
   * adding a new test suite.
   */
  #extractPropertyFromArray(array: ArrayLiteralExpression, propertyName: string) {
    const property = array.getElements().map((el) => {
      if (!Node.isObjectLiteralExpression(el)) return

      const nameProp = el.getPropertyOrThrow(propertyName)
      if (!Node.isPropertyAssignment(nameProp)) return

      const name = nameProp.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral)
      return name.getLiteralValue()
    })

    return property.filter(Boolean) as string[]
  }

  /**
   * Build a new module entry for the preloads and providers array
   * based upon the environments specified
   */
  #buildNewModuleEntry(modulePath: string, environments?: (typeof ALLOWED_ENVIRONMENTS)[number][]) {
    if (!this.#isInSpecificEnvironment(environments)) {
      return `() => import('${modulePath}')`
    }

    return `{
      file: () => import('${modulePath}'),
      environment: [${environments?.map((env) => `'${env}'`).join(', ')}],
    }`
  }

  /**
   * Add a new command to the rcFile
   *
   * @param commandPath - The path to the command file
   * @returns This RcFileTransformer instance for method chaining
   */
  addCommand(commandPath: string) {
    const commandsProperty = this.#getPropertyAssignmentInDefineConfigCall('commands', '[]')
    const commandsArray = commandsProperty.getInitializerIfKindOrThrow(
      SyntaxKind.ArrayLiteralExpression
    )

    const commandString = `() => import('${commandPath}')`

    /**
     * If the command already exists, do nothing
     */
    if (commandsArray.getElements().some((el) => el.getText() === commandString)) {
      return this
    }

    /**
     * Add the command to the array
     */
    commandsArray.addElement(commandString)
    return this
  }

  /**
   * Add a new preloaded file to the rcFile
   *
   * @param modulePath - The path to the preload file
   * @param environments - Optional array of environments where this preload should run
   * @returns This RcFileTransformer instance for method chaining
   */
  addPreloadFile(modulePath: string, environments?: (typeof ALLOWED_ENVIRONMENTS)[number][]) {
    const preloadsProperty = this.#getPropertyAssignmentInDefineConfigCall('preloads', '[]')
    const preloadsArray = preloadsProperty.getInitializerIfKindOrThrow(
      SyntaxKind.ArrayLiteralExpression
    )

    /**
     * Check for duplicates
     */
    const existingPreloadedFiles = this.#extractModulesFromArray(preloadsArray)
    const isDuplicate = existingPreloadedFiles.includes(modulePath)
    if (isDuplicate) {
      return this
    }

    /**
     * Add the preloaded file to the array
     */
    preloadsArray.addElement(this.#buildNewModuleEntry(modulePath, environments))
    return this
  }

  /**
   * Add a new provider to the rcFile
   *
   * @param providerPath - The path to the provider file
   * @param environments - Optional array of environments where this provider should run
   * @returns This RcFileTransformer instance for method chaining
   */
  addProvider(providerPath: string, environments?: (typeof ALLOWED_ENVIRONMENTS)[number][]) {
    const property = this.#getPropertyAssignmentInDefineConfigCall('providers', '[]')
    const providersArray = property.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)

    /**
     * Check for duplicates
     */
    const existingProviderPaths = this.#extractModulesFromArray(providersArray)
    const isDuplicate = existingProviderPaths.includes(providerPath)
    if (isDuplicate) {
      return this
    }

    /**
     * Add the provider to the array
     */
    providersArray.addElement(this.#buildNewModuleEntry(providerPath, environments))

    return this
  }

  /**
   * Add a new meta file to the rcFile
   *
   * @param globPattern - The glob pattern for the meta file
   * @param reloadServer - Whether the server should reload when this file changes
   * @returns This RcFileTransformer instance for method chaining
   */
  addMetaFile(globPattern: string, reloadServer = false) {
    const property = this.#getPropertyAssignmentInDefineConfigCall('metaFiles', '[]')
    const metaFilesArray = property.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)

    /**
     * Check for duplicates
     */
    const alreadyDefinedPatterns = this.#extractPropertyFromArray(metaFilesArray, 'pattern')
    if (alreadyDefinedPatterns.includes(globPattern)) {
      return this
    }

    /**
     * Add the meta file to the array
     */
    metaFilesArray.addElement(
      `{
        pattern: '${globPattern}',
        reloadServer: ${reloadServer},
      }`
    )

    return this
  }

  /**
   * Set directory name and path in the directories configuration
   *
   * @param key - The directory key (e.g., 'controllers', 'models')
   * @param value - The directory path
   * @returns This RcFileTransformer instance for method chaining
   */
  setDirectory(key: string, value: string) {
    const property = this.#getPropertyAssignmentInDefineConfigCall('directories', '{}')
    const directories = property.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    directories.addPropertyAssignment({ name: key, initializer: `'${value}'` })

    return this
  }

  /**
   * Set command alias in the command aliases configuration
   *
   * @param alias - The alias name
   * @param command - The full command name
   * @returns This RcFileTransformer instance for method chaining
   */
  setCommandAlias(alias: string, command: string) {
    const aliasProperty = this.#getPropertyAssignmentInDefineConfigCall('commandsAliases', '{}')
    const aliases = aliasProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    aliases.addPropertyAssignment({ name: alias, initializer: `'${command}'` })

    return this
  }

  /**
   * Add a new test suite to the rcFile
   *
   * @param suiteName - The name of the test suite
   * @param files - File patterns for the test suite (string or array)
   * @param timeout - Optional timeout in milliseconds (defaults to 2000)
   * @returns This RcFileTransformer instance for method chaining
   */
  addSuite(suiteName: string, files: string | string[], timeout?: number) {
    const testProperty = this.#getPropertyAssignmentInDefineConfigCall(
      'tests',
      `{ suites: [], forceExit: true, timeout: 2000 }`
    )

    const property = testProperty
      .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
      .getPropertyOrThrow('suites') as PropertyAssignment

    const suitesArray = property.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)

    /**
     * Check for duplicates
     */
    const existingSuitesNames = this.#extractPropertyFromArray(suitesArray, 'name')
    if (existingSuitesNames.includes(suiteName)) {
      return this
    }

    /**
     * Add the suite to the array
     */
    const filesArray = Array.isArray(files) ? files : [files]
    suitesArray.addElement(
      `{
        name: '${suiteName}',
        files: [${filesArray.map((file) => `'${file}'`).join(', ')}],
        timeout: ${timeout ?? 2000},
      }`
    )

    return this
  }

  /**
   * Add a new assembler hook
   *
   * @param type - The type of hook to add
   * @param path - The path to the hook file
   * @returns This RcFileTransformer instance for method chaining
   */
  addAssemblerHook(type: keyof Exclude<AssemblerRcFile['hooks'], undefined>, path: string) {
    const hooksProperty = this.#getPropertyAssignmentInDefineConfigCall('hooks', '{}')

    const hooks = hooksProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    let hookArray = hooks.getProperty(type) as PropertyAssignment
    if (!hookArray) {
      hooks.addPropertyAssignment({ name: type, initializer: '[]' })
      hookArray = hooks.getProperty(type) as PropertyAssignment
    }

    const hooksArray = hookArray.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression)
    const existingHooks = this.#extractModulesFromArray(hooksArray)
    if (existingHooks.includes(path)) {
      return this
    }

    hooksArray.addElement(`() => import('${path}')`)

    return this
  }

  /**
   * Save the adonisrc.ts file with all applied transformations
   *
   * Formats the file according to editor settings and saves it to disk.
   *
   * @returns Promise that resolves when the file is saved
   */
  save() {
    const file = this.#getRcFileOrThrow()
    file.formatText(this.#editorSettings)
    return file.save()
  }
}
