/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'
import string from '@poppinss/utils/string'
import { isScriptFile } from '@poppinss/utils'
import { fsReadAll } from '@poppinss/utils/fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { type OneOrMore } from '@poppinss/utils/types'
import StringBuilder from '@poppinss/utils/string_builder'
import { basename, dirname, extname, join, relative } from 'node:path'
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

import debug from '../debug.ts'
import { RcFileTransformer } from './rc_file_transformer.ts'
import type {
  MiddlewareNode,
  EnvValidationNode,
  BouncerPolicyNode,
} from '../types/code_transformer.ts'

/**
 * This class is responsible for transforming AdonisJS project code,
 * including updating middleware, environment validations, and other
 * code generation tasks.
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
   * Add new env variable validation in the `env.ts` file
   *
   * @param definition - Environment validation definition containing variables and comment
   */
  async defineEnvValidations(definition: EnvValidationNode) {
    /**
     * Get the `start/env.ts` source file
     */
    const kernelUrl = join(this.#cwdPath, './start/env.ts')
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
    /**
     * Get the `start/kernel.ts` source file
     */
    const kernelUrl = join(this.#cwdPath, './start/kernel.ts')
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
    /**
     * Get the `tests/bootstrap.ts` source file
     */
    const testBootstrapUrl = join(this.#cwdPath, './tests/bootstrap.ts')
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
   * Add a new Vite plugin to the `vite.config.ts` file
   *
   * @param pluginCall - The plugin function call to add
   * @param importDeclarations - Import declarations needed for the plugin
   */
  async addVitePlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ) {
    /**
     * Get the `vite.config.ts` source file
     */
    const viteConfigTsUrl = join(this.#cwdPath, './vite.config.ts')

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
   *
   * @param policies - Array of bouncer policy entries to add
   */
  async addPolicies(policies: BouncerPolicyNode[]) {
    /**
     * Get the `app/policies/main.ts` source file
     */
    const kernelUrl = join(this.#cwdPath, './app/policies/main.ts')
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

  /**
   * Creates an index file that exports an object in which the key is the PascalCase
   * name of the entity and the value is a dynamic import.
   *
   * For example, in case of controllers, the index file will be the list of controller
   * names pointing a dynamically imported controller file.
   *
   * ```ts
   * export const controllers = {
   *   LoginController: () => import('#controllers/login_controller'),
   *   LogoutController: () => import('#controllers/logout_controller'),
   * }
   * ```
   *
   * @param input - Source configuration for entity scanning
   * @param output - Output configuration for the generated index file
   *
   * @example
   * await transformer.makeEntityIndex(
   *   { source: 'app/controllers', importAlias: '#controllers' },
   *   { destination: 'start/controllers.ts', exportName: 'controllers' }
   * )
   */
  async makeEntityIndex(
    input: OneOrMore<{ source: string; importAlias?: string; allowedExtensions?: string[] }>,
    output: {
      destination: string
      exportName?: string
      removeNameSuffix?: string
      computeBaseName?: (filePath: string, sourcePath: string) => string
      computeOutput?: (entries: { name: string; importPath: string }[]) => string
    }
  ) {
    const inputs = Array.isArray(input) ? input : [input]
    const outputPath = join(this.#cwdPath, output.destination)
    const outputDir = dirname(outputPath)
    const exportName =
      output.exportName ??
      new StringBuilder(basename(output.destination)).removeExtension().camelCase()

    debug(
      'creating index for "%s" at destination "%s" using sources %O',
      exportName,
      outputPath,
      inputs
    )

    const entries = await Promise.all(
      inputs.map(async ({ source, importAlias, allowedExtensions }) => {
        const sourcePath = join(this.#cwdPath, source)
        const filesList = await fsReadAll(sourcePath, {
          filter: (filePath: string) => {
            if (allowedExtensions) {
              const ext = extname(filePath)
              return allowedExtensions.includes(ext)
            }
            return isScriptFile(filePath)
          },
          pathType: 'absolute',
        })

        const knownBaseNames = new Set()

        return filesList.map((filePath) => {
          /**
           * We assume all filenames are unique across sub-directories, hence we will
           * use the baseName of the file. However, if a file with the same name already
           * exists, when we will prefix the parent subdirectories to the name.
           */
          let baseName = basename(filePath)
          if (output.computeBaseName) {
            baseName = output.computeBaseName?.(filePath, sourcePath)
          } else {
            if (knownBaseNames.has(baseName)) {
              baseName = string.toUnixSlash(relative(sourcePath, filePath))
            }
            knownBaseNames.add(baseName)
          }

          const name = new StringBuilder(baseName)
            .removeExtension()
            .removeSuffix(output.removeNameSuffix ?? '')
            .pascalCase()
            .toString()

          /**
           * When using an import alias, the baseImportPath will be a relative path
           * from the source directory, otherwise it will be a relative between
           * the outputDir and the filePath.
           */
          const baseImportPath = importAlias
            ? string.toUnixSlash(relative(sourcePath, filePath))
            : string.toUnixSlash(relative(outputDir, filePath))

          const importPath = importAlias
            ? `${importAlias}/${new StringBuilder(baseImportPath).removeExtension().toString()}`
            : baseImportPath

          return {
            name,
            importPath,
          }
        })
      })
    )

    const computeOutput =
      output.computeOutput ??
      ((list) => {
        return list
          .reduce<string[]>(
            (result, entry) => {
              debug('adding "%O" to the index', entry)
              result.push(`  ${entry.name}: () => import('${entry.importPath}'),`)
              return result
            },
            [`export const ${exportName} = {`]
          )
          .concat('}')
          .join('\n')
      })

    await mkdir(outputDir, { recursive: true })
    await writeFile(outputPath, computeOutput(entries.flat(2)))
  }
}
