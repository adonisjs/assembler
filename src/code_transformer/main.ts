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
import { installPackage, detectPackageManager } from '@antfu/install-pkg'
import {
  Node,
  Project,
  QuoteKind,
  SourceFile,
  SyntaxKind,
  CodeBlockWriter,
  FormatCodeSettings,
} from 'ts-morph'

import { RcFileTransformer } from './rc_file_transformer.js'
import type { MiddlewareNode, EnvValidationNode, BouncerPolicyNode } from '../types.js'

/**
 * This class is responsible for updating
 */
export class CodeTransformer {
  /**
   * Exporting utilities to install package and detect
   * the package manager
   */
  installPackage = installPackage
  detectPackageManager = detectPackageManager

  /**
   * Directory of the adonisjs project
   */
  #cwd: URL

  /**
   * The TsMorph project
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

  constructor(cwd: URL) {
    this.#cwd = cwd
    this.project = new Project({
      tsConfigFilePath: join(fileURLToPath(this.#cwd), 'tsconfig.json'),
      manipulationSettings: { quoteKind: QuoteKind.Single },
    })
  }

  /**
   * Add a new middleware to the middleware array of the
   * given file
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
   * Add a policy to the list of pre-registered policy
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
    const existingImports = file.getImportDeclarations()

    importDeclarations.forEach((importDeclaration) => {
      const existingImport = existingImports.find(
        (mod) => mod.getModuleSpecifierValue() === importDeclaration.module
      )

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
   * Add new env variable validation in the
   * `env.ts` file
   */
  async defineEnvValidations(definition: EnvValidationNode) {
    /**
     * Get the `start/env.ts` source file
     */
    const kernelUrl = fileURLToPath(new URL('./start/env.ts', this.#cwd))
    const file = this.project.getSourceFileOrThrow(kernelUrl)

    /**
     * Get the `Env.create` call expression
     */
    const callExpressions = file
      .getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter((statement) => statement.getExpression().getText() === 'Env.create')

    if (!callExpressions.length) {
      throw new Error(`Cannot find Env.create statement in the file.`)
    }

    const objectLiteralExpression = callExpressions[0].getArguments()[1]
    if (!Node.isObjectLiteralExpression(objectLiteralExpression)) {
      throw new Error(`The second argument of Env.create is not an object literal.`)
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
   * Define new middlewares inside the `start/kernel.ts`
   * file
   *
   * This function is highly based on some assumptions
   * and will not work if you significantly tweaked
   * your `start/kernel.ts` file.
   */
  async addMiddlewareToStack(stack: 'server' | 'router' | 'named', middleware: MiddlewareNode[]) {
    /**
     * Get the `start/kernel.ts` source file
     */
    const kernelUrl = fileURLToPath(new URL('./start/kernel.ts', this.#cwd))
    const file = this.project.getSourceFileOrThrow(kernelUrl)

    /**
     * Process each middleware entry
     */
    for (const middlewareEntry of middleware) {
      if (stack === 'named') {
        this.#addToNamedMiddleware(file, middlewareEntry)
      } else {
        this.#addToMiddlewareArray(file!, `${stack}.use`, middlewareEntry)
      }
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }

  /**
   * Update the `adonisrc.ts` file
   */
  async updateRcFile(callback: (transformer: RcFileTransformer) => void) {
    const rcFileTransformer = new RcFileTransformer(this.#cwd, this.project)
    callback(rcFileTransformer)
    await rcFileTransformer.save()
  }

  /**
   * Add a new Japa plugin in the `tests/bootstrap.ts` file
   */
  async addJapaPlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ) {
    /**
     * Get the `tests/bootstrap.ts` source file
     */
    const testBootstrapUrl = fileURLToPath(new URL('./tests/bootstrap.ts', this.#cwd))
    const file = this.project.getSourceFileOrThrow(testBootstrapUrl)

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
   * Add a new Vite plugin
   */
  async addVitePlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ) {
    /**
     * Get the `vite.config.ts` source file
     */
    const viteConfigTsUrl = fileURLToPath(new URL('./vite.config.ts', this.#cwd))

    const file = this.project.getSourceFile(viteConfigTsUrl)
    if (!file) {
      throw new Error(
        'Cannot find vite.config.ts file. Make sure to rename vite.config.js to vite.config.ts'
      )
    }

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

    file.formatText(this.#editorSettings)
    await file.save()
  }

  /**
   * Adds a policy to the list of `policies` object configured
   * inside the `app/policies/main.ts` file.
   */
  async addPolicies(policies: BouncerPolicyNode[]) {
    /**
     * Get the `app/policies/main.ts` source file
     */
    const kernelUrl = fileURLToPath(new URL('./app/policies/main.ts', this.#cwd))
    const file = this.project.getSourceFileOrThrow(kernelUrl)

    /**
     * Process each middleware entry
     */
    for (const policy of policies) {
      this.#addToPoliciesList(file, policy)
    }

    file.formatText(this.#editorSettings)
    await file.save()
  }
}
