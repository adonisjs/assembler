/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { relative } from 'node:path'
import string from '@poppinss/utils/string'
import { fileURLToPath, pathToFileURL } from 'node:url'

import debug from '../../debug.ts'
import { isRelative } from '../../utils.ts'
import { type VirtualFileSystem } from '../../virtual_file_system.ts'
import { type ScannedController, type ScannedRoute } from '../../types/code_scanners.ts'
import {
  findImport,
  inspectClass,
  nodeToPlainText,
  inspectClassMethods,
  inspectMethodArguments,
  searchValidatorDirectUsage,
} from '../../helpers.ts'

/**
 * Extracts the VineJS validator usage from within a controller method.
 *
 * This function analyzes controller method code to detect validator usage patterns
 * and extracts the validator references along with their import information.
 * The following syntaxes are supported:
 *
 * - `request.validateUsing(validatorReference)`
 * - `vine.validate(validatorReference)`
 * - `validatorReference.validate(request.all())`
 *
 * - `request.validateUsing(ControllerReference.validator)`
 * - `vine.validate(ControllerReference.validator)`
 * - `ControllerReference.validator.validate(request.all())`
 *
 * The app root is needed to create relative validator imports in case
 * a relative import was used within the controller file.
 *
 * @param appRoot - The root directory of the application
 * @param vfs - Virtual file system instance for code analysis
 * @param controller - The controller to analyze for validator usage
 * @returns Promise resolving to array of validator information or undefined
 */
export async function extractValidators(
  appRoot: string,
  vfs: VirtualFileSystem,
  controller: ScannedController
): Promise<ScannedRoute['validators']> {
  const root = await vfs.get(controller.path)
  const fileContents = root.text()

  const controllerClass = inspectClass(root)
  if (!controllerClass) {
    debug(`No class defined within the "%s"`, controller.import.specifier)
    return
  }

  /**
   * Inspect class methods and find the scope down to the method
   * we are currently inspecting
   */
  const method = inspectClassMethods(controllerClass).find((e) => {
    return e.find({
      rule: { kind: 'property_identifier', regex: `\\b${controller.method}\\b` },
    })
  })
  if (!method) {
    debug(`Unable to find "%s" method in "%s"`, controller.method, controller.import.specifier)
    return
  }

  /**
   * Inspect validators via "request.validateUsing" and "vine.validate"
   * method calls.
   */
  const validationCalls = inspectMethodArguments(method, ['request.validateUsing', 'vine.validate'])
    .map((node) => {
      const firstArg = node.find({
        rule: { any: [{ kind: 'identifier' }, { kind: 'member_expression' }] },
      })
      if (!firstArg) {
        return
      }
      return nodeToPlainText(firstArg)
    })
    .filter((node) => node !== undefined)
    .concat(searchValidatorDirectUsage(method).map((node) => nodeToPlainText(node)))

  /**
   * Unable to find any validation calls, or the first argument of the
   * validation call was not a member_expression or an identifier.
   */
  if (!validationCalls.length) {
    debug(
      `Unable to detect any validation calls in "%s.%s" method`,
      controller.import.specifier,
      controller.method
    )
    return
  }

  const controllerName = controllerClass.find({ rule: { kind: 'type_identifier' } })!.text()
  const controllerURL = pathToFileURL(controller.path)

  /**
   * Finding all the imports for the validator usages. We expect all the
   * validators to be imported
   */
  const imports = await Promise.all(
    validationCalls.map(async (validationCall) => {
      const validatorNamespace = validationCall.split('.')[0]
      if (validatorNamespace === controllerName) {
        return {
          name: validationCall,
          import: {
            specifier: controller.import.specifier,
            type: 'default',
            value: controllerName,
          },
        } satisfies Exclude<ScannedRoute['validators'], undefined>[number]
      }

      const importCall = await findImport(fileContents, validationCall)
      if (!importCall) {
        debug(
          'Unable to find import for "%s" used by "%s.%s" method',
          validationCall,
          controller.import.specifier,
          controller.method
        )
        return null
      }

      return {
        name: validationCall,
        import: {
          specifier: isRelative(importCall.specifier)
            ? string.toUnixSlash(
                relative(appRoot, fileURLToPath(new URL(importCall.specifier, controllerURL)))
              )
            : importCall.specifier,
          type: importCall.clause.type,
          value: importCall.clause.value,
        },
      } satisfies Exclude<ScannedRoute['validators'], undefined>[number]
    })
  )

  return imports.filter((value) => !!value)
}
