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
import { inspectMethodArguments, nodeToPlainText } from '../src/utils.ts'

test.group('Inspect method arguments', () => {
  test('Inspect all arguments from multiple methods')
    .with([
      {
        input: `class UsersController {
        async store() {
          await request.validateUsing(createUserValidator)
        }
      }`,
        output: ['createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          try {
            await vine.validate(createUserValidator)
          } catch (error) {
          }
        }
      }`,
        output: ['createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          await request.validateUsing(user.createUserValidator)
        }
      }`,
        output: ['user.createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          await request.validateUsing(/*
            Always use the create validator
          */ user.createUserValidator)
        }
      }`,
        output: ['user.createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          await request.validateUsing(/* Always use the create validator */ user.createUserValidator)
        }
      }`,
        output: ['user.createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          if (request.input('type') === 'car') {
            await request.validateUsing(/* Always use the car validator */ createCarValidator)
          } else {
            await request.validateUsing(createVehicleValidator)
          }
        }
      }`,
        output: ['createCarValidator', 'createVehicleValidator'],
      },
    ])
    .run(({ assert }, { input, output }) => {
      const root = parse(Lang.TypeScript, input).root()

      const validatorArguments = inspectMethodArguments(root, [
        'request.validateUsing',
        'vine.validate',
      ]).map((node) => {
        return nodeToPlainText(
          node.find({ rule: { any: [{ kind: 'identifier' }, { kind: 'member_expression' }] } })!
        )
      })

      assert.deepEqual(validatorArguments, output)
    })
})
