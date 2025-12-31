/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type {
  MiddlewareNode,
  EnvValidationNode,
  BouncerPolicyNode,
} from '../types/code_transformer.ts'

/**
 * Options for creating a CodemodException
 */
export interface CodemodExceptionOptions {
  /**
   * Instructions for the user to manually perform the codemod action
   */
  instructions?: string

  /**
   * The file path that was being modified
   */
  filePath?: string
}

/**
 * Custom exception for codemod errors that provides helpful instructions
 * to the user when automatic code transformation fails.
 *
 * @example
 * ```ts
 * throw CodemodException.missingEnvFile('start/env.ts', {
 *   variables: { MY_VAR: 'Env.schema.string()' }
 * })
 * ```
 */
export class CodemodException extends Error {
  /**
   * Instructions for the user to manually perform the codemod action
   */
  instructions?: string

  /**
   * The file path that was being modified
   */
  filePath?: string

  constructor(message: string, options?: CodemodExceptionOptions) {
    super(message)
    this.name = 'CodemodException'
    this.instructions = options?.instructions
    this.filePath = options?.filePath
  }

  /**
   * Format env validations as code string
   */
  static #formatEnvValidations(definition: EnvValidationNode): string {
    const lines: string[] = []

    if (definition.leadingComment) {
      lines.push(`/*`)
      lines.push(`|----------------------------------------------------------`)
      lines.push(`| ${definition.leadingComment}`)
      lines.push(`|----------------------------------------------------------`)
      lines.push(`*/`)
    }

    for (const [variable, validation] of Object.entries(definition.variables)) {
      lines.push(`${variable}: ${validation},`)
    }

    return lines.join('\n')
  }

  /**
   * Format middleware as code string
   */
  static #formatMiddleware(
    stack: 'server' | 'router' | 'named',
    middleware: MiddlewareNode[]
  ): string {
    if (stack === 'named') {
      const entries = middleware
        .filter((m) => m.name)
        .map((m) => `${m.name}: () => import('${m.path}')`)
      return `export const middleware = router.named({\n  ${entries.join(',\n  ')}\n})`
    }

    const entries = middleware.map((m) => `() => import('${m.path}')`)
    return `${stack}.use([\n  ${entries.join(',\n  ')}\n])`
  }

  /**
   * Format policies as code string
   */
  static #formatPolicies(policies: BouncerPolicyNode[]): string {
    const entries = policies.map((p) => `${p.name}: () => import('${p.path}')`)
    return `export const policies = {\n  ${entries.join(',\n  ')}\n}`
  }

  /**
   * Format Vite plugin as code string
   */
  static #formatVitePlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ): string {
    const imports = importDeclarations
      .map((decl) =>
        decl.isNamed
          ? `import { ${decl.identifier} } from '${decl.module}'`
          : `import ${decl.identifier} from '${decl.module}'`
      )
      .join('\n')

    return `${imports}\n\nexport default defineConfig({\n  plugins: [${pluginCall}]\n})`
  }

  /**
   * Format Japa plugin as code string
   */
  static #formatJapaPlugin(
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ): string {
    const imports = importDeclarations
      .map((decl) =>
        decl.isNamed
          ? `import { ${decl.identifier} } from '${decl.module}'`
          : `import ${decl.identifier} from '${decl.module}'`
      )
      .join('\n')

    return `${imports}\n\nexport const plugins: Config['plugins'] = [\n  ${pluginCall}\n]`
  }

  /**
   * Creates an exception when start/env.ts file is missing
   *
   * @param filePath - The path to the missing file
   * @param definition - The environment validation definition that was being added
   */
  static missingEnvFile(filePath: string, definition: EnvValidationNode): CodemodException {
    const code = this.#formatEnvValidations(definition)
    return new CodemodException(`Could not find source file at path: "${filePath}"`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when Env.create is not found in the file
   *
   * @param filePath - The path to the file being modified
   * @param definition - The environment validation definition that was being added
   */
  static missingEnvCreate(filePath: string, definition: EnvValidationNode): CodemodException {
    const code = this.#formatEnvValidations(definition)
    return new CodemodException(`Cannot find Env.create statement in the file.`, {
      filePath,
      instructions: `Add the following code inside Env.create() in "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when Env.create has invalid structure
   *
   * @param filePath - The path to the file being modified
   * @param definition - The environment validation definition that was being added
   */
  static invalidEnvCreate(filePath: string, definition: EnvValidationNode): CodemodException {
    const code = this.#formatEnvValidations(definition)
    return new CodemodException(`The second argument of Env.create is not an object literal.`, {
      filePath,
      instructions: `Add the following code inside Env.create() in "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when start/kernel.ts file is missing
   *
   * @param filePath - The path to the missing file
   * @param stack - The middleware stack that was being modified
   * @param middleware - The middleware entries that were being added
   */
  static missingKernelFile(
    filePath: string,
    stack: 'server' | 'router' | 'named',
    middleware: MiddlewareNode[]
  ): CodemodException {
    const code = this.#formatMiddleware(stack, middleware)
    return new CodemodException(`Could not find source file at path: "${filePath}"`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when server.use/router.use is not found
   *
   * @param filePath - The path to the file being modified
   * @param stack - The middleware stack that was being modified
   * @param middleware - The middleware entries that were being added
   */
  static missingMiddlewareStack(
    filePath: string,
    stack: 'server' | 'router' | 'named',
    middleware: MiddlewareNode[]
  ): CodemodException {
    const code = this.#formatMiddleware(stack, middleware)
    const target = stack === 'named' ? 'middleware variable' : `${stack}.use`
    return new CodemodException(`Cannot find ${target} statement in the file.`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when middleware array structure is invalid
   *
   * @param filePath - The path to the file being modified
   * @param stack - The middleware stack that was being modified
   * @param middleware - The middleware entries that were being added
   * @param reason - The reason why the structure is invalid
   */
  static invalidMiddlewareStack(
    filePath: string,
    stack: 'server' | 'router' | 'named',
    middleware: MiddlewareNode[],
    reason: string
  ): CodemodException {
    const code = this.#formatMiddleware(stack, middleware)
    return new CodemodException(reason, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when app/policies/main.ts file is missing
   *
   * @param filePath - The path to the missing file
   * @param policies - The policies that were being added
   */
  static missingPoliciesFile(filePath: string, policies: BouncerPolicyNode[]): CodemodException {
    const code = this.#formatPolicies(policies)
    return new CodemodException(`Could not find source file at path: "${filePath}"`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when policies structure is invalid
   *
   * @param filePath - The path to the file being modified
   * @param policies - The policies that were being added
   * @param reason - The reason why the structure is invalid
   */
  static invalidPoliciesFile(
    filePath: string,
    policies: BouncerPolicyNode[],
    reason: string
  ): CodemodException {
    const code = this.#formatPolicies(policies)
    return new CodemodException(reason, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when vite.config.ts file is missing
   *
   * @param filePath - The path to the missing file
   * @param pluginCall - The plugin call that was being added
   * @param importDeclarations - The import declarations needed for the plugin
   */
  static missingViteConfig(
    filePath: string,
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ): CodemodException {
    const code = this.#formatVitePlugin(pluginCall, importDeclarations)
    return new CodemodException(
      `Cannot find vite.config.ts file. Make sure to rename vite.config.js to vite.config.ts`,
      {
        filePath,
        instructions: `Add the following code to "${filePath}":\n\n${code}`,
      }
    )
  }

  /**
   * Creates an exception when vite.config.ts structure is invalid
   *
   * @param filePath - The path to the file being modified
   * @param pluginCall - The plugin call that was being added
   * @param importDeclarations - The import declarations needed for the plugin
   * @param reason - The reason why the structure is invalid
   */
  static invalidViteConfig(
    filePath: string,
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[],
    reason: string
  ): CodemodException {
    const code = this.#formatVitePlugin(pluginCall, importDeclarations)
    return new CodemodException(reason, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when tests/bootstrap.ts file is missing
   *
   * @param filePath - The path to the missing file
   * @param pluginCall - The plugin call that was being added
   * @param importDeclarations - The import declarations needed for the plugin
   */
  static missingJapaBootstrap(
    filePath: string,
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[]
  ): CodemodException {
    const code = this.#formatJapaPlugin(pluginCall, importDeclarations)
    return new CodemodException(`Could not find source file at path: "${filePath}"`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when tests/bootstrap.ts structure is invalid
   *
   * @param filePath - The path to the file being modified
   * @param pluginCall - The plugin call that was being added
   * @param importDeclarations - The import declarations needed for the plugin
   * @param reason - The reason why the structure is invalid
   */
  static invalidJapaBootstrap(
    filePath: string,
    pluginCall: string,
    importDeclarations: { isNamed: boolean; module: string; identifier: string }[],
    reason: string
  ): CodemodException {
    const code = this.#formatJapaPlugin(pluginCall, importDeclarations)
    return new CodemodException(reason, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${code}`,
    })
  }

  /**
   * Creates an exception when adonisrc.ts file is missing
   *
   * @param filePath - The path to the missing file
   * @param codeToAdd - The code that should be added manually
   */
  static missingRcFile(filePath: string, codeToAdd: string): CodemodException {
    return new CodemodException(`Could not find source file at path: "${filePath}"`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${codeToAdd}`,
    })
  }

  /**
   * Creates an exception when adonisrc.ts structure is invalid
   *
   * @param filePath - The path to the file being modified
   * @param codeToAdd - The code that should be added manually
   * @param reason - The reason why the structure is invalid
   */
  static invalidRcFile(filePath: string, codeToAdd: string, reason: string): CodemodException {
    return new CodemodException(reason, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${codeToAdd}`,
    })
  }

  /**
   * Creates an exception when a file required for transformation is not found.
   *
   * @param filePath - The path to the missing file
   * @param codeToAdd - The code that should be added manually
   */
  static E_CODEMOD_FILE_NOT_FOUND(filePath: string, codeToAdd: string): CodemodException {
    return new CodemodException(`Could not find source file at path: "${filePath}"`, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${codeToAdd}`,
    })
  }

  /**
   * Creates an exception when the file structure doesn't match expected patterns.
   *
   * @param message - Description of what structure was expected
   * @param filePath - The path to the file being modified
   * @param codeToAdd - The code that should be added manually
   */
  static E_CODEMOD_INVALID_STRUCTURE(
    message: string,
    filePath: string,
    codeToAdd: string
  ): CodemodException {
    return new CodemodException(message, {
      filePath,
      instructions: `Add the following code to "${filePath}":\n\n${codeToAdd}`,
    })
  }
}
