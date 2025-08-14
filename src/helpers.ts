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
 * Finds an import reference inside a code snippet
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
 */
export function inspectClassMethods(node: SgNode): SgNode[] {
  return node.findAll({
    rule: {
      kind: 'method_definition',
    },
  })
}

/**
 * Converts an array of SgNode to plain text by removing whitespaces,
 * identation and comments in between. Tested with the following
 * children nodes only.
 *
 * - MemberExpression
 * - Identifer
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
