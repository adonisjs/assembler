/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { parseImports } from 'parse-imports'
import { type SgNode } from '@ast-grep/napi'
import type { Import } from './types/common.ts'

/**
 * Finds an import reference inside a code snippet by analyzing the import statements
 * and matching against the provided import reference identifier.
 *
 * The function searches through all import statements in the code and matches
 * against default, namespace, or named imports based on the import reference.
 *
 * @param code - The code snippet to search for imports
 * @param importReference - The import reference identifier to find (can include dot notation)
 * @returns Promise that resolves to an Import object or null if not found
 *
 * @example
 * const importInfo = await findImport(code, 'validateUser')
 * if (importInfo) {
 *   console.log(importInfo.specifier) // '@/validators/user'
 * }
 */
export async function findImport(code: string, importReference: string): Promise<Import | null> {
  const importIdentifier = importReference.split('.')[0]

  for (const $import of await parseImports(code, {})) {
    /**
     * An import without any clause
     */
    if (!$import.importClause) {
      continue
    }

    /**
     * An import without any clause
     */
    if (!$import.moduleSpecifier.value) {
      continue
    }

    /**
     * Import identifier matches a default import
     */
    if ($import.importClause.default === importIdentifier) {
      return {
        specifier: $import.moduleSpecifier.value,
        isConstant: $import.moduleSpecifier.isConstant,
        clause: {
          type: 'default',
          value: importIdentifier,
        },
      } satisfies Import
    }

    /**
     * Import identifier matches a namespace import
     */
    if ($import.importClause.namespace === importIdentifier) {
      return {
        specifier: $import.moduleSpecifier.value,
        isConstant: $import.moduleSpecifier.isConstant,
        clause: {
          type: 'namespace',
          value: importIdentifier,
        },
      } satisfies Import
    }

    const namedImport = $import.importClause.named.find(({ binding }) => {
      return binding === importIdentifier
    })

    /**
     * Import identifier matches a named import
     */
    if (namedImport) {
      return {
        specifier: $import.moduleSpecifier.value,
        isConstant: $import.moduleSpecifier.isConstant,
        clause: {
          type: 'named',
          value: namedImport.specifier,
          ...(namedImport.binding !== namedImport.specifier
            ? {
                alias: namedImport.binding,
              }
            : {}),
        },
      } satisfies Import
    }
  }

  return null
}

/**
 * Returns a node that represents a TypeScript class or null
 * when unable to find the class.
 *
 * This function searches for class declarations within the provided AST node
 * using ast-grep's pattern matching capabilities.
 *
 * @param node - The AST node to search within for class declarations
 * @returns The SgNode representing the class or null if not found
 *
 * @example
 * const classNode = inspectClass(rootNode)
 * if (classNode) {
 *   console.log('Found class:', classNode.text())
 * }
 */
export function inspectClass(node: SgNode): SgNode | null {
  return node.find({
    rule: {
      kind: 'class_declaration',
    },
  })
}

/**
 * Returns an array of SgNodes for class methods. The input node
 * must represent a class.
 *
 * This function finds all method definitions within a class node,
 * including both regular methods and static methods.
 *
 * @param node - The AST node representing a class to search for methods
 * @returns Array of SgNodes representing method definitions within the class
 *
 * @example
 * const classNode = inspectClass(rootNode)
 * if (classNode) {
 *   const methods = inspectClassMethods(classNode)
 *   methods.forEach(method => console.log('Method:', method.text()))
 * }
 */
export function inspectClassMethods(node: SgNode): SgNode[] {
  return node.findAll({
    rule: {
      kind: 'method_definition',
    },
  })
}

/**
 * Converts an SgNode to plain text by removing whitespaces,
 * indentation and comments in between. Tested with the following
 * children nodes only.
 *
 * - MemberExpression
 * - Identifier
 *
 * This function recursively traverses the AST node and extracts only
 * the meaningful text content without any formatting or whitespace.
 *
 * @param node - The AST node to convert to plain text
 * @returns String representation of the node without formatting
 *
 * @example
 * const memberExpression = node.find({ rule: { kind: 'member_expression' } })
 * const plainText = nodeToPlainText(memberExpression)
 * console.log(plainText) // 'user.validate'
 */
export function nodeToPlainText(node: SgNode) {
  let out: string[] = []
  function toText(one: SgNode) {
    const children = one.children()
    if (!children.length) {
      out.push(one.text())
    } else {
      children.forEach((child) => toText(child))
    }
  }

  toText(node)
  return out.join('')
}

/**
 * Inspects arguments for one or more method calls. If you want to
 * scope the search within a specific context, then make sure to
 * first narrow down the AST and pass a specific SgNode.
 *
 * For example: In case of validators, we will first find the Controller
 * method for which we want the validation method calls.
 *
 * This function searches for call expressions that match the provided method
 * names and returns their argument nodes for further analysis.
 *
 * @param node - The AST node to search within for method calls
 * @param methodCalls - Array of method call names to search for (supports dot notation)
 * @returns Array of SgNodes representing the arguments of matching method calls
 *
 * @example
 * const controllerMethod = classNode.find({ rule: { kind: 'method_definition' } })
 * const validatorArgs = inspectMethodArguments(controllerMethod, ['validate', 'request.validate'])
 * validatorArgs.forEach(arg => console.log('Validator argument:', arg.text()))
 */
export function inspectMethodArguments(node: SgNode, methodCalls: string[]): SgNode[] {
  const matchingExpressions = node.findAll({
    rule: {
      any: methodCalls.map((methodCall) => {
        return {
          pattern: {
            context: `${methodCall}($$$ARGUMENTS)`,
            selector: 'call_expression',
          },
        }
      }),
    },
  })

  return matchingExpressions.flatMap((matchingExpression) => {
    return matchingExpression.findAll({ rule: { kind: 'arguments' } })
  })
}

/**
 * Inspect the validator direct usage code snippets. A member expression
 * calling the ".validate" method is considered as direct usage of
 * the validator.
 *
 * This function specifically looks for patterns where validators are called
 * directly with the `.validate()` method, which is common in AdonisJS applications.
 *
 * @param node - The AST node to search within for validator direct usage
 * @returns Array of SgNodes representing validator expressions that call validate method
 *
 * @example
 * const methodNode = classNode.find({ rule: { kind: 'method_definition' } })
 * const validators = searchValidatorDirectUsage(methodNode)
 * validators.forEach(validator => {
 *   console.log('Direct validator usage:', nodeToPlainText(validator))
 * })
 */
export function searchValidatorDirectUsage(node: SgNode): SgNode[] {
  const matchingExpressions = node.findAll({
    rule: {
      pattern: {
        context: '$$$VALIDATOR.validate($$$)',
        selector: 'call_expression',
      },
    },
  })

  return matchingExpressions.flatMap((expression) => {
    /**
     * Since we capture all "$$$.validate" calls, the first node
     * within the call expression will be a member expression
     * and its property identifier will be "validate".
     *
     * What we need is the text of this member expression without the
     * comments
     */
    return expression.getMultipleMatches('VALIDATOR')
  })
}
