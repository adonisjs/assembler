/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ImportInfo, ImportsBag } from '@poppinss/utils'
import { installPackage, detectPackageManager } from '@antfu/install-pkg'
import {
  Node,
  Project,
  QuoteKind,
  type SourceFile,
  SyntaxKind,
  type CodeBlockWriter,
  type FormatCodeSettings,
} from 'ts-morph'

import { RcFileTransformer } from './rc_file_transformer.ts'
import { CodemodException } from '../exceptions/codemod_exception.ts'
import type {
  MiddlewareNode,
  EnvValidationNode,
  BouncerPolicyNode,
  ValidatorNode,
  MixinDefinition,
  ControllerMethodNode,
} from '../types/code_transformer.ts'

/**
 * This class is responsible for transforming AdonisJS project code,
 * including updating middleware, environment validations, and other
 * code generation tasks.
 *
 * The CodeTransformer provides methods for modifying various AdonisJS
 * configuration files and code structures using AST manipulation through
 * ts-morph. It can update middleware stacks, add environment validations,
 * register plugins, and modify RC file configurations.
 *
 * @example
 * const transformer = new CodeTransformer(cwd)
 * await transformer.addMiddlewareToStack('server', [{
 *   path: '#middleware/cors_middleware',
 *   position: 'before'
 * }])
 */
export class CodeTransformer {
  /**
   * Utility function for installing packages
   */
  installPackage = installPackage

  /**
   * Utility function for detecting the package manager
   */
  detectPackageManager = detectPackageManager

  /**
   * Directory of the adonisjs project
   */
  #cwd: URL

  /**
   * String path version of the current working directory
   */
  #cwdPath: string

  /**
   * The TsMorph project instance for AST manipulation
   */
  project: Project

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
   * Create a new CodeTransformer instance
   *
   * @param cwd - The current working directory URL
   */
  constructor(cwd: URL) {
    this.#cwd = cwd
    this.#cwdPath = fileURLToPath(this.#cwd)
    this.project = new Project({
      tsConfigFilePath: join(fileURLToPath(this.#cwd), 'tsconfig.json'),
      manipulationSettings: { quoteKind: QuoteKind.Single },
    })
  }

  /**
   * Get directories configured in adonisrc.ts, with defaults fallback.
   *
   * This method reads the adonisrc.ts file and extracts the directories
   * configuration. If a directory is not configured, the default value is used.
   *
   * @returns Object containing directory paths
   */
  getDirectories(): Record<string, string> {
    const rcFileTransformer = new RcFileTransformer(this.#cwd, this.project)

    return {
      start: rcFileTransformer.getDirectory('start', 'start'),
      tests: rcFileTransformer.getDirectory('tests', 'tests'),
      policies: rcFileTransformer.getDirectory('policies', 'app/policies'),
      validators: rcFileTransformer.getDirectory('validators', 'app/validators'),
      models: rcFileTransformer.getDirectory('models', 'app/models'),
      controllers: rcFileTransformer.getDirectory('controllers', 'app/controllers'),
    }
  }

  /**
   * Add a new middleware to the middleware array of the given file
   *
   * This method locates middleware stack calls (like server.use or router.use)
   * and adds the middleware entry to the appropriate position in the array.
   *
   * @param file - The source file to modify
   * @param target - The target method call (e.g., 'server.use', 'router.use')
   * @param middlewareEntry - The middleware entry to add
   */
  #addToMiddlewareArray(file: SourceFile, target: string, middlewareEntry: MiddlewareNode) {
    const callExpressions = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((statement) => statement.getExpression().getText() === target)

    if (!callExpressions.length) {
      throw new Error(`Cannot find ${target} statement in the file.`)
    }

    const arrayLiteralExpression = callExpressions[0].getArguments()[0]
    if (!arrayLiteralExpression || !Node.isArrayLiteralExpression(arrayLiteralExpression)) {
      throw new Error(`Cannot find middleware array in ${target} statement.`)
    }

    const middleware = `() => import('${middlewareEntry.path}')`

    /**
     * Delete the existing middleware if it exists
     */
    const existingMiddlewareIndex = arrayLiteralExpression
      .getElements()
      .findIndex((element) => element.getText() === middleware)

    if (existingMiddlewareIndex === -1) {
      /**
       * Add the middleware to the top or bottom of the array
       */
      if (middlewareEntry.position === 'before') {
        arrayLiteralExpression.insertElement(0, middleware)
      } else {
        arrayLiteralExpression.addElement(middleware)
      }
    }
  }

  /**
   * Add a new middleware to the named middleware of the given file
   *
   * This method adds middleware entries to the named middleware object,
   * typically used for route-specific middleware registration.
   *
   * @param file - The source file to modify
   * @param middlewareEntry - The middleware entry to add (must have a name)
   */
  #addToNamedMiddleware(file: SourceFile, middlewareEntry: MiddlewareNode) {
    if (!middlewareEntry.name) {
      throw new Error('Named middleware requires a name.')
    }

    const callArguments = file
      .getVariableDeclarationOrThrow('middleware')
      .getInitializerIfKindOrThrow(SyntaxKind.CallExpression)
      .getArguments()

    if (callArguments.length === 0) {
      throw new Error('Named middleware call has no arguments.')
    }

    const namedMiddlewareObject = callArguments[0]
    if (!Node.isObjectLiteralExpression(namedMiddlewareObject)) {
      throw new Error('The argument of the named middleware call is not an object literal.')
    }

    /**
     * Check if property is already defined. If so, remove it
     */
    const existingProperty = namedMiddlewareObject.getProperty(middlewareEntry.name)
    if (!existingProperty) {
      /**
       * Add the named middleware
       */
      const middleware = `${middlewareEntry.name}: () => import('${middlewareEntry.path}')`
      namedMiddlewareObject!.insertProperty(0, middleware)
    }
  }

  /**
   * Add a policy to the list of pre-registered policies
   *
   * This method adds bouncer policy entries to the policies object,
   * allowing them to be used in route authorization.
   *
   * @param file - The source file to modify
   * @param policyEntry - The policy entry to add
   */
  #addToPoliciesList(file: SourceFile, policyEntry: BouncerPolicyNode) {
    const policiesObject = file
      .getVariableDeclarationOrThrow('policies')
      .getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)

    /**
     * Only define policy when one with the existing name does not
     * exist.
     */
    const existingProperty = policiesObject.getProperty(policyEntry.name)
    if (!existingProperty) {
      const policy = `${policyEntry.name}: () => import('${policyEntry.path}')`
      policiesObject!.insertProperty(0, policy)
    }
  }

  /**
   * Add the given import declarations to the source file
   * and merge named imports with the existing import
   */
  #addImportDeclarations(
    file: SourceFile,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ) {
    importDeclarations.forEach((importDeclaration) => {
      const existingImport = file
        .getImportDeclarations()
        .find((mod) => mod.getModuleSpecifierValue() === importDeclaration.module)

      /**
       * Add a new named import to existing import for the
       * same module
       */
      if (existingImport && importDeclaration.isNamed) {
        if (
          !existingImport
            .getNamedImports()
            .find((namedImport) => namedImport.getName() === importDeclaration.identifier)
        ) {
          existingImport.addNamedImport(importDeclaration.identifier)
        }
        return
      }

      /**
       * Ignore default import when the same module is already imported.
       * The chances are the existing default import and the importDeclaration
       * identifiers are not the same. But we should not modify existing source
       */
      if (existingImport) {
        return
      }

      file.addImportDeclaration({
        ...(importDeclaration.isNamed
          ? { namedImports: [importDeclaration.identifier] }
          : { defaultImport: importDeclaration.identifier }),
        moduleSpecifier: importDeclaration.module,
      })
    })
  }

  /**
   * Convert ImportInfo array to import declarations and add them to the file
   */
  #addImportsFromImportInfo(file: SourceFile, imports: ImportInfo[]) {
    const importsBag = new ImportsBag()
    for (const importInfo of imports) {
      importsBag.add(importInfo)
    }

    const importDeclarations = importsBag.toArray().flatMap((moduleImport) => {
      return (moduleImport.namedImports ?? [])
        .map((symbol) => {
          return {
            isNamed: true,
            module: moduleImport.source,
            identifier: symbol,
          }
        })
        .concat(
          moduleImport.defaultImport
            ? [
                {
                  isNamed: false,
                  module: moduleImport.source,
                  identifier: moduleImport.defaultImport,
                },
              ]
            : []
        )
    })
    this.#addImportDeclarations(file, importDeclarations)
  }

  /**
   * Write a leading comment
   */
  #addLeadingComment(writer: CodeBlockWriter, comment?: string) {
    if (!comment) {
      return writer.blankLine()
    }

    return writer
      .blankLine()
      .writeLine('/*')
      .writeLine(`|----------------------------------------------------------`)
      .writeLine(`| ${comment}`)
      .writeLine(`|----------------------------------------------------------`)
      .writeLine(`*/`)
  }

  /**
   * Add new env variable validation in the `env.ts` file
   *
   * @param definition - Environment validation definition containing variables and comment
   */
  async defineEnvValidations(definition: EnvValidationNode) {
    const directories = this.getDirectories()
    const filePath = `${directories.start}/env.ts`

    /**
     * Get the env.ts source file
     */
    const envUrl = join(this.#cwdPath, `./${filePath}`)
    const file = this.project.getSourceFile(envUrl)

    if (!file) {
      throw CodemodException.missingEnvFile(filePath, definition)
    }

    /**
     * Get the `Env.create` call expression
     */
    const callExpressions = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((statement) => statement.getExpression().getText() === 'Env.create')

    if (!callExpressions.length) {
      throw CodemodException.missingEnvCreate(filePath, definition)
    }

    const objectLiteralExpression = callExpressions[0].getArguments()[1]
    if (!Node.isObjectLiteralExpression(objectLiteralExpression)) {
      throw CodemodException.invalidEnvCreate(filePath, definition)
    }

    let shouldAddComment = true

    /**
     * Add each variable validation
     */
    for (const [variable, validation] of Object.entries(definition.variables)) {
      /**
       * Check if the variable is already defined. If so, remove it
       */
      const existingProperty = objectLiteralExpression.getProperty(variable)

      /**
       * Do not add leading comment if one or more properties
       * already exists
       */
      if (existingProperty) {
        shouldAddComment = false
      }

      /**
       * Add property only when the property does not exist
       */
      if (!existingProperty) {
        objectLiteralExpression.addPropertyAssignment({
          name: variable,
          initializer: validation,
          leadingTrivia: (writer) => {
            if (!shouldAddComment) {
              return
            }

            shouldAddComment = false
            return this.#addLeadingComment(writer, definition.leadingComment)
          },
        })
      }
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  /**
   * Define new middlewares inside the `start/kernel.ts` file
   *
   * This function is highly based on some assumptions
   * and will not work if you significantly tweaked
   * your `start/kernel.ts` file.
   *
   * @param stack - The middleware stack to add to ('server', 'router', or 'named')
   * @param middleware - Array of middleware entries to add
   */
  async addMiddlewareToStack(stack: 'server' | 'router' | 'named', middleware: MiddlewareNode[]) {
    const directories = this.getDirectories()
    const filePath = `${directories.start}/kernel.ts`

    /**
     * Get the kernel.ts source file
     */
    const kernelUrl = join(this.#cwdPath, `./${filePath}`)
    const file = this.project.getSourceFile(kernelUrl)

    if (!file) {
      throw CodemodException.missingKernelFile(filePath, stack, middleware)
    }

    /**
     * Process each middleware entry
     */
    try {
      for (const middlewareEntry of middleware) {
        if (stack === 'named') {
          this.#addToNamedMiddleware(file, middlewareEntry)
        } else {
          this.#addToMiddlewareArray(file, `${stack}.use`, middlewareEntry)
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        throw CodemodException.invalidMiddlewareStack(filePath, stack, middleware, error.message)
      }
      throw error
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  /**
   * Update the `adonisrc.ts` file using the provided callback
   *
   * @param callback - Function that receives the RcFileTransformer for modifications
   */
  async updateRcFile(callback: (transformer: RcFileTransformer) => void) {
    const rcFileTransformer = new RcFileTransformer(this.#cwd, this.project)
    callback(rcFileTransformer)
    await rcFileTransformer.save()
  }

  /**
   * Add a new Japa plugin in the `tests/bootstrap.ts` file
   *
   * @param pluginCall - The plugin function call to add
   * @param importDeclarations - Import declarations needed for the plugin
   */
  async addJapaPlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ) {
    const directories = this.getDirectories()
    const filePath = `${directories.tests}/bootstrap.ts`

    /**
     * Get the bootstrap.ts source file
     */
    const testBootstrapUrl = join(this.#cwdPath, `./${filePath}`)
    const file = this.project.getSourceFile(testBootstrapUrl)

    if (!file) {
      throw CodemodException.missingJapaBootstrap(filePath, pluginCall, importDeclarations)
    }

    /**
     * Add the import declarations
     */
    this.#addImportDeclarations(file, importDeclarations)

    /**
     * Insert the plugin call in the `plugins` array
     */
    const pluginsArray = file
      .getVariableDeclaration('plugins')
      ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)

    /**
     * Add plugin call to the plugins array
     */
    if (pluginsArray) {
      if (!pluginsArray.getElements().find((element) => element.getText() === pluginCall)) {
        pluginsArray.addElement(pluginCall)
      }
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  /**
   * Add a new Vite plugin to the `vite.config.ts` file
   *
   * @param pluginCall - The plugin function call to add
   * @param importDeclarations - Import declarations needed for the plugin
   */
  async addVitePlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ) {
    const filePath = 'vite.config.ts'

    /**
     * Get the `vite.config.ts` source file
     */
    const viteConfigTsUrl = join(this.#cwdPath, `./${filePath}`)

    const file = this.project.getSourceFile(viteConfigTsUrl)
    if (!file) {
      throw CodemodException.missingViteConfig(filePath, pluginCall, importDeclarations)
    }

    try {
      /**
       * Add the import declarations
       */
      this.#addImportDeclarations(file, importDeclarations)

      /**
       * Get the default export options
       */
      const defaultExport = file.getDefaultExportSymbol()
      if (!defaultExport) {
        throw new Error('Cannot find the default export in vite.config.ts')
      }

      /**
       * Get the options object
       * - Either the first argument of `defineConfig` call : `export default defineConfig({})`
       * - Or child literal expression of the default export : `export default {}`
       */
      const declaration = defaultExport.getDeclarations()[0]
      const options =
        declaration.getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)[0] ||
        declaration.getChildrenOfKind(SyntaxKind.CallExpression)[0].getArguments()[0]

      const pluginsArray = options
        .getPropertyOrThrow('plugins')
        .getFirstChildByKindOrThrow(SyntaxKind.ArrayLiteralExpression)

      /**
       * Add plugin call to the plugins array
       */
      if (!pluginsArray.getElements().find((element) => element.getText() === pluginCall)) {
        pluginsArray.addElement(pluginCall)
      }
    } catch (error) {
      if (error instanceof CodemodException) {
        throw error
      }
      if (error instanceof Error) {
        throw CodemodException.invalidViteConfig(
          filePath,
          pluginCall,
          importDeclarations,
          error.message
        )
      }
      throw error
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  /**
   * Adds a policy to the list of `policies` object configured
   * inside the `app/policies/main.ts` file.
   *
   * @param policies - Array of bouncer policy entries to add
   */
  async addPolicies(policies: BouncerPolicyNode[]) {
    const directories = this.getDirectories()
    const filePath = `${directories.policies}/main.ts`

    /**
     * Get the policies/main.ts source file
     */
    const policiesUrl = join(this.#cwdPath, `./${filePath}`)
    const file = this.project.getSourceFile(policiesUrl)

    if (!file) {
      throw CodemodException.missingPoliciesFile(filePath, policies)
    }

    /**
     * Process each policy entry
     */
    try {
      for (const policy of policies) {
        this.#addToPoliciesList(file, policy)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw CodemodException.invalidPoliciesFile(filePath, policies, error.message)
      }
      throw error
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  async addValidator(definition: ValidatorNode) {
    const directories = this.getDirectories()
    const filePath = `${directories.validators}/${definition.validatorFileName}`

    /**
     * Get the validator file URL
     */
    const validatorFileUrl = join(this.#cwdPath, `./${filePath}`)
    let file = this.project.getSourceFile(validatorFileUrl)

    /**
     * Try to load the file from disk if not already in the project
     */
    if (!file) {
      try {
        file = this.project.addSourceFileAtPath(validatorFileUrl)
      } catch {
        // File does not exist on disk, we will create it
      }
    }

    /**
     * If the file does not exist, create it
     */
    if (!file) {
      file = this.project.createSourceFile(validatorFileUrl, definition.contents)
      file.formatText(this.#editorSettings)
      await file.save()
      return
    }

    /**
     * Check if the export already exists
     */
    const existingExport = file.getVariableDeclaration(definition.exportName)
    if (existingExport) {
      return
    }

    /**
     * Add the validator to the existing file
     */
    file.addStatements(`\n${definition.contents}`)
    file.formatText(this.#editorSettings)
    await file.save()
  }

  async addModelMixins(modelFileName: string, mixins: MixinDefinition[]) {
    const directories = this.getDirectories()
    const filePath = `${directories.models}/${modelFileName}`

    /**
     * Get the model file URL
     */
    const modelFileUrl = join(this.#cwdPath, `./${filePath}`)
    let file = this.project.getSourceFile(modelFileUrl)

    /**
     * Try to load the file from disk if not already in the project
     */
    if (!file) {
      try {
        file = this.project.addSourceFileAtPath(modelFileUrl)
      } catch {
        throw new Error(`Could not find source file at path: "${filePath}"`)
      }
    }

    /**
     * Get the default export class declaration
     */
    const defaultExportSymbol = file.getDefaultExportSymbol()
    if (!defaultExportSymbol) {
      throw new Error(
        `Could not find default export in "${filePath}". The model must have a default export class.`
      )
    }

    const declarations = defaultExportSymbol.getDeclarations()
    if (declarations.length === 0) {
      throw new Error(`Could not find default export declaration in "${filePath}".`)
    }

    const declaration = declarations[0]
    if (!Node.isClassDeclaration(declaration)) {
      throw new Error(
        `Default export in "${filePath}" is not a class. The model must be exported as a class.`
      )
    }

    /**
     * Add import declarations for the mixins
     */
    const mixinImports = mixins.map((mixin) => {
      if (mixin.importType === 'named') {
        return { source: mixin.importPath, namedImports: [mixin.name] }
      } else {
        return { source: mixin.importPath, defaultImport: mixin.name }
      }
    })
    this.#addImportsFromImportInfo(file, mixinImports)

    /**
     * Get the heritage clause (extends clause)
     */
    const heritageClause = declaration.getHeritageClauseByKind(SyntaxKind.ExtendsKeyword)
    if (!heritageClause) {
      throw new Error(`Could not find extends clause in "${filePath}".`)
    }

    const extendsExpression = heritageClause.getTypeNodes()[0]
    if (!extendsExpression) {
      throw new Error(`Could not find extends expression in "${filePath}".`)
    }

    /**
     * Get the expression that the class extends
     */
    const extendsExpressionNode = extendsExpression.getExpression()

    /**
     * Check if the class already uses compose
     */
    let composeCall: Node | undefined
    if (Node.isCallExpression(extendsExpressionNode)) {
      const callExpression = extendsExpressionNode.getExpression()
      if (callExpression.getText() === 'compose') {
        composeCall = extendsExpressionNode
      }
    }

    /**
     * Build the mixin calls
     */
    const mixinCalls = mixins.map((mixin) => {
      const args = mixin.args && mixin.args.length > 0 ? mixin.args.join(', ') : ''
      return `${mixin.name}(${args})`
    })

    /**
     * If the class is already using compose, add the mixins to the compose call
     */
    if (composeCall && Node.isCallExpression(composeCall)) {
      const existingArgs = composeCall.getArguments()
      const existingArgsText = existingArgs.map((arg) => arg.getText())

      /**
       * Filter out mixins that are already applied by checking if a call
       * to the mixin function already exists in the compose arguments
       */
      const newMixinCalls = mixinCalls.filter((mixinCall) => {
        // Extract the function name from the mixin call (e.g., "withManagedEmail" from "withManagedEmail()")
        const mixinFunctionName = mixinCall.split('(')[0]
        // Check if any existing arg contains a call to this function
        return !existingArgsText.some((existingArg) => {
          return existingArg.includes(`${mixinFunctionName}(`)
        })
      })

      const newArgs = [...existingArgsText, ...newMixinCalls]
      composeCall.replaceWithText(`compose(${newArgs.join(', ')})`)
    } else {
      /**
       * If the class is not using compose, wrap the extends expression in compose
       * and add import for compose
       */
      this.#addImportDeclarations(file, [
        {
          isNamed: true,
          module: '@adonisjs/core/helpers',
          identifier: 'compose',
        },
      ])

      const currentExtends = extendsExpressionNode.getText()
      const newExtends = `compose(${currentExtends}, ${mixinCalls.join(', ')})`
      extendsExpression.replaceWithText(newExtends)
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  async addControllerMethod(definition: ControllerMethodNode) {
    const directories = this.getDirectories()
    const filePath = `${directories.controllers}/${definition.controllerFileName}`

    /**
     * Get the controller file URL
     */
    const controllerFileUrl = join(this.#cwdPath, `./${filePath}`)
    let file = this.project.getSourceFile(controllerFileUrl)

    /**
     * Try to load the file from disk if not already in the project
     */
    if (!file) {
      try {
        file = this.project.addSourceFileAtPath(controllerFileUrl)
      } catch {
        // File does not exist on disk, we will create it
      }
    }

    /**
     * If the file does not exist, create it with the controller class and method
     */
    if (!file) {
      const contents = `export default class ${definition.className} {
  ${definition.contents}
}`

      file = this.project.createSourceFile(controllerFileUrl, contents)

      /**
       * Add imports if specified
       */
      if (definition.imports) {
        this.#addImportsFromImportInfo(file, definition.imports)
      }

      file.formatText(this.#editorSettings)
      await file.save()
      return
    }

    /**
     * Get the default export class declaration
     */
    const defaultExportSymbol = file.getDefaultExportSymbol()
    if (!defaultExportSymbol) {
      throw new Error(
        `Could not find default export in "${filePath}". The controller must have a default export class.`
      )
    }

    const declarations = defaultExportSymbol.getDeclarations()
    if (declarations.length === 0) {
      throw new Error(`Could not find default export declaration in "${filePath}".`)
    }

    const declaration = declarations[0]
    if (!Node.isClassDeclaration(declaration)) {
      throw new Error(
        `Default export in "${filePath}" is not a class. The controller must be exported as a class.`
      )
    }

    /**
     * Check if the method already exists
     */
    const existingMethod = declaration.getMethod(definition.name)
    if (existingMethod) {
      return
    }

    /**
     * Add imports if specified
     */
    if (definition.imports) {
      this.#addImportsFromImportInfo(file, definition.imports)
    }

    /**
     * Add the method to the class by inserting the raw method text
     */
    declaration.addMember(definition.contents)

    file.formatText(this.#editorSettings)
    await file.save()
  }
}
