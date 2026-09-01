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
  inspectMethodArguments,
} from '../../src/helpers.ts'

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
      {
        input: `class UsersController {
        async store(ctx: HttpContext) {
          await ctx.request.tryValidateUsing(admin.createUserValidator)
          await this.ctx.request.validateUsing(createUserValidator)
        }
      }`,
        output: ['admin.createUserValidator', 'createUserValidator'],
      },
      {
        input: `class UsersController {
        async store() {
          await request /* request comment */ . validateUsing(
            factory(createUserValidator)
          )
          await vine.tryValidate(user.createUserValidator)
        }
      }`,
        output: ['factory', 'createUserValidator', 'user.createUserValidator'],
      },
      {
        input: `class UsersController {
        async store(ctx: HttpContext) {
          await request?.validateUsing(optionalValidator)
          await ctx?.request.validateUsing(optionalContextValidator)
          await validator.validate(request.all())
        }
      }`,
        output: [],
      },
    ])
    .run(({ assert }, { input, output }) => {
      const root = parse(Lang.TypeScript, input).root()
      const storeMethod = inspectClassMethods(inspectClass(root)!).find((e) => {
        return e.find({
          rule: { kind: 'property_identifier', regex: `\\bstore\\b` },
        })
      })!

      const validatorArguments = inspectMethodArguments(storeMethod, [
        'request.validateUsing',
        'request.tryValidateUsing',
        '$CTX.request.validateUsing',
        '$CTX.request.tryValidateUsing',
        'vine.validate',
        'vine.tryValidate',
      ]).map((node) => {
        return nodeToPlainText(
          node.find({ rule: { any: [{ kind: 'identifier' }, { kind: 'member_expression' }] } })!
        )
      })

      assert.deepEqual(validatorArguments, output)
    })
})
