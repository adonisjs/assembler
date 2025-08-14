/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { findImport } from '../../src/helpers.ts'

test.group('Find import', () => {
  test('find "{input.namespace}" import reference from the file')
    .with([
      {
        input: {
          code: `
        import { createUserValidator } from '#validators/user'
        `,
          namespace: 'createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'named',
            value: 'createUserValidator',
          },
        },
      },
      {
        input: {
          code: `
          import { createUser as createUserValidator } from '#validators/user'
          `,
          namespace: 'createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'named',
            value: 'createUser',
            alias: 'createUserValidator',
          },
        },
      },
      {
        input: {
          code: `
          import createUserValidator from '#validators/user'
          `,
          namespace: 'createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'default',
            value: 'createUserValidator',
          },
        },
      },
      {
        input: {
          code: `
        import * as user from '#validators/user'
        `,
          namespace: 'user.createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'namespace',
            value: 'user',
          },
        },
      },
      {
        input: {
          code: `
            import user from '#validators/user'
          `,
          namespace: 'user.createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'default',
            value: 'user',
          },
        },
      },
      {
        input: {
          code: `
        import { user } from '#validators/user'
        `,
          namespace: 'user.createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'named',
            value: 'user',
          },
        },
      },
      {
        input: {
          code: `
        import { user } from '#validators/user'
        `,
          namespace: 'user.createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'named',
            value: 'user',
          },
        },
      },
      {
        input: {
          code: `
        import { user as userValidators } from '#validators/user'
        `,
          namespace: 'userValidators.createUserValidator',
        },
        output: {
          specifier: '#validators/user',
          isConstant: true,
          clause: {
            type: 'named',
            value: 'user',
            alias: 'userValidators',
          },
        },
      },
      {
        input: {
          code: `
        import { createUserValidator } from '../validators/user'
        `,
          namespace: 'createUserValidator',
        },
        output: {
          specifier: '../validators/user',
          isConstant: true,
          clause: {
            type: 'named',
            value: 'createUserValidator',
          },
        },
      },
      {
        input: {
          code: `
        import from '#validators/user'
        `,
          namespace: 'createUserValidator',
        },
        output: null,
      },
      {
        input: {
          code: `
        import { userValidator } from '#validators/user'
        `,
          namespace: 'createUserValidator',
        },
        output: null,
      },
    ])
    .run(async ({ assert }, { input, output }) => {
      assert.deepEqual(await findImport(input.code, input.namespace), output)
    })
})
