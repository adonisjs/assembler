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
import type { CodeBlockWriter, Project, SourceFile } from 'ts-morph'

import { AddMiddlewareEntry, EnvValidationDefinition } from './types.js'

/**
 * This class is responsible for updating
 */
export class CodeTransformer {
  #cwd: URL

  /**
   * Reference to TS Morph
   * We lazy load it to avoid loading it when not
   * used
   */
  #tsMorph!: typeof import('ts-morph')

  /**
   * The TsMorph project
   */
  #project!: Project

  constructor(cwd: URL) {
    this.#cwd = cwd
  }

  /**
   * Lazy load ts-morph and create the project
   */
  async #loadProject() {
    if (this.#project) return

    this.#tsMorph = await import('ts-morph')
    this.#project = new this.#tsMorph.Project({
      tsConfigFilePath: join(fileURLToPath(this.#cwd), 'tsconfig.json'),
    })
  }

  /**
   * Add a new middleware to the middleware array of the
   * given file
   */
  #addToMiddlewareArray(file: SourceFile, target: string, middlewareEntry: AddMiddlewareEntry) {
    const callExpressions = file
      .getDescendantsOfKind(this.#tsMorph.SyntaxKind.CallExpression)
      .filter((statement) => statement.getExpression().getText() === target)

    if (!callExpressions.length) {
      throw new Error(`Cannot find ${target} statement in the file.`)
    }

    const arrayLiteralExpression = callExpressions[0].getArguments()[0]
    if (
      !arrayLiteralExpression ||
      !this.#tsMorph.Node.isArrayLiteralExpression(arrayLiteralExpression)
    ) {
      throw new Error(`Cannot find middleware array in ${target} statement.`)
    }

    const middleware = `() => import('${middlewareEntry.path}')`

    if (middlewareEntry.position === 'before') {
      arrayLiteralExpression.insertElement(0, middleware)
    } else {
      arrayLiteralExpression.addElement(middleware)
    }
  }

  /**
   * Add a new middleware to the named middleware of the given file
   */
  #addToNamedMiddleware(file: SourceFile, middlewareEntry: AddMiddlewareEntry) {
    if (!middlewareEntry.name) throw new Error('Named middleware requires a name.')

    const callArguments = file
      .getVariableDeclarationOrThrow('middleware')
      .getInitializerIfKindOrThrow(this.#tsMorph.SyntaxKind.CallExpression)
      .getArguments()

    if (callArguments.length === 0) {
      throw new Error('Named middleware call has no arguments.')
    }

    const namedMiddlewareObject = callArguments[0]
    if (!this.#tsMorph.Node.isObjectLiteralExpression(namedMiddlewareObject)) {
      throw new Error('The argument of the named middleware call is not an object literal.')
    }

    const middleware = `${middlewareEntry.name}: () => import('${middlewareEntry.path}')`
    namedMiddlewareObject!.insertProperty(0, middleware)
  }

  /**
   * Write a leading comment
   */
  #addLeadingComment(writer: CodeBlockWriter, comment?: string) {
    if (!comment) return writer.blankLine()

    return writer
      .blankLine()
      .writeLine('/*')
      .writeLine(`|----------------------------------------------------------`)
      .writeLine(`| ${comment}`)
      .writeLine(`|----------------------------------------------------------`)
      .writeLine(`*/`)
  }

  /**
   * Define new middlewares inside the `start/kernel.ts`
   * file
   *
   * This function is highly based on some assumptions
   * and will not work if you significantly tweaked
   * your `start/kernel.ts` file.
   */
  async addMiddlewareToStack(
    stack: 'server' | 'router' | 'named',
    middleware: AddMiddlewareEntry[]
  ) {
    await this.#loadProject()

    /**
     * Get the `start/kernel.ts` source file
     */
    const kernelUrl = fileURLToPath(new URL('./start/kernel.ts', this.#cwd))
    const file = this.#project.getSourceFileOrThrow(kernelUrl)

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

    file.formatText()
    await file.save()
  }

  /**
   * Add new env variable validation in the
   * `env.ts` file
   */
  async defineEnvValidations(definition: EnvValidationDefinition) {
    await this.#loadProject()

    /**
     * Get the `start/env.ts` source file
     */
    const kernelUrl = fileURLToPath(new URL('./start/env.ts', this.#cwd))
    const file = this.#project.getSourceFileOrThrow(kernelUrl)

    /**
     * Get the `Env.create` call expression
     */
    const callExpressions = file
      .getDescendantsOfKind(this.#tsMorph.SyntaxKind.CallExpression)
      .filter((statement) => statement.getExpression().getText() === 'Env.create')

    if (!callExpressions.length) {
      throw new Error(`Cannot find Env.create statement in the file.`)
    }

    const objectLiteralExpression = callExpressions[0].getArguments()[1]
    if (!this.#tsMorph.Node.isObjectLiteralExpression(objectLiteralExpression)) {
      throw new Error(`The second argument of Env.create is not an object literal.`)
    }

    let firstAdded = false

    /**
     * Add each variable validation
     */
    for (const [variable, validation] of Object.entries(definition.variables)) {
      objectLiteralExpression.addPropertyAssignment({
        name: variable,
        initializer: validation,
        leadingTrivia: (writer) => {
          if (firstAdded) return
          firstAdded = true
          return this.#addLeadingComment(writer, definition.leadingComment)
        },
      })
    }

    file.formatText()
    await file.save()
  }
}
