import { fileURLToPath } from 'node:url'
import type { AppEnvironments } from '@adonisjs/application/types'
import {
  Node,
  Project,
  SourceFile,
  SyntaxKind,
  CallExpression,
  PropertyAssignment,
  ArrayLiteralExpression,
} from 'ts-morph'

/**
 * RcFileTransformer is used to transform the `adonisrc.ts` file
 * for adding new commands, providers, meta files etc
 */
export class RcFileTransformer {
  #cwd: URL
  #project: Project

  /**
   * Settings to use when persisting files
   */
  #editorSettings = {
    indentSize: 2,
    convertTabsToSpaces: true,
    trimTrailingWhitespace: true,
  }

  constructor(cwd: URL, project: Project) {
    this.#cwd = cwd
    this.#project = project
  }

  /**
   * Get the `adonisrc.ts` source file
   */
  #getRcFileOrThrow() {
    const kernelUrl = fileURLToPath(new URL('./adonisrc.ts', this.#cwd))
    return this.#project.getSourceFileOrThrow(kernelUrl)
  }

  /**
   * Check if environments array has a subset of available environments
   */
  #isInSpecificEnvironment(environments?: AppEnvironments[]): boolean {
    if (!environments) return false

    return !!(['web', 'console', 'test', 'repl'] as const).find(
      (env) => !environments.includes(env)
    )
  }

  /**
   * Locate the `defineConfig` call inside the `adonisrc.ts` file
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
  #buildNewModuleEntry(modulePath: string, environments?: AppEnvironments[]) {
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
   */
  addPreloadFile(modulePath: string, environments?: AppEnvironments[]) {
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
   */
  addProvider(providerPath: string, environments?: AppEnvironments[]) {
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
   * Set directory name and path
   */
  setDirectory(key: string, value: string) {
    const property = this.#getPropertyAssignmentInDefineConfigCall('directories', '{}')
    const directories = property.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    directories.addPropertyAssignment({ name: key, initializer: `'${value}'` })

    return this
  }

  /**
   * Set command alias
   */
  setCommandAlias(alias: string, command: string) {
    const aliasProperty = this.#getPropertyAssignmentInDefineConfigCall('commandsAliases', '{}')
    const aliases = aliasProperty.getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    aliases.addPropertyAssignment({ name: alias, initializer: `'${command}'` })

    return this
  }

  /**
   * Add a new test suite to the rcFile
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
   * Save the adonisrc.ts file
   */
  save() {
    const file = this.#getRcFileOrThrow()
    file.formatText(this.#editorSettings)
    return file.save()
  }
}
