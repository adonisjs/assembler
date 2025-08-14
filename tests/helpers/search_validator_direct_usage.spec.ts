/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { parse, Lang } from '@ast-grep/napi'
import {
  inspectClass,
  nodeToPlainText,
  inspectClassMethods,
  searchValidatorDirectUsage,
} from '../../src/helpers.ts'

test.group('Search validator direct usage', () => {
  test('Search all validators via their direct usage')
    .with([
      {
        input: `class UsersController {
        async store() {
          await createUserValidator.validate({ data: request.all() })
        }
      }`,
        output: ['createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          try {
            await createUserValidator.validate(request.all())
          } catch (error) {
          }
        }
      }`,
        output: ['createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          await user.createUserValidator.validate(request.all())
        }
      }`,
        output: ['user.createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          await user
            .createUserValidator
            .validate(request.all())
        }
      }`,
        output: ['user.createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          if (request.input('type') === 'car') {
            await createCarValidator.validate(request.all())
          } else {
            await createVehicleValidator.validate(request.all())
          }
        }
      }`,
        output: ['createCarValidator', 'createVehicleValidator'],
      },
    ])
    .run(({ assert }, { input, output }) => {
      const root = parse(Lang.TypeScript, input).root()
      const storeMethod = inspectClassMethods(inspectClass(root)!).find((e) => {
        return e.find({
          rule: { kind: 'property_identifier', regex: `\\bstore\\b` },
        })
      })!

      const validatorArguments = searchValidatorDirectUsage(storeMethod).map((node) => {
        return nodeToPlainText(node)
      })

      assert.deepEqual(validatorArguments, output)
    })
})
