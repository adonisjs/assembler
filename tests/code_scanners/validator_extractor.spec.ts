/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'node:path'
import { test } from '@japa/runner'
import { VirtualFileSystem } from '../../src/virtual_file_system.ts'
import { extractValidators } from '../../src/code_scanners/routes_scanner/validator_extractor.ts'

test.group('Validator extractor', () => {
  test('extract validator for a given method inside a class', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import { createUserValidator, updateUserValidator, deleteUserValidator } from '#validators/user'

      export default class UsersController {
        async store({ request }: HttpContext) {
          await request.validateUsing(createUserValidator)
        }

        async update({ request }: HttpContext) {
          await request.validateUsing(updateUserValidator)
        }

        async destroy({ request }: HttpContext) {
          await request.validateUsing(deleteUserValidator)
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#validators/user',
            type: 'named',
            value: 'createUserValidator',
          },
          name: 'createUserValidator',
        },
      ]
    )
  })

  test('pick correct method when there are many similar methods', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import { createUserValidator } from '#validators/user'

      export default class UsersController {
        async storePhotos({ request }: HttpContext) {
          await request.validateUsing(createUserValidator)
        }

        async photosstore({ request }: HttpContext) {
          await request.validateUsing(nonExistingValidator)
        }

        async storev1({ request }: HttpContext) {
          await request.validateUsing(nonExistingValidator)
        }

        async stor({ request }: HttpContext) {
          await request.validateUsing(nonExistingValidator)
        }

        async store({ request }: HttpContext) {
          await request.validateUsing(createUserValidator)
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#validators/user',
            type: 'named',
            value: 'createUserValidator',
          },
          name: 'createUserValidator',
        },
      ]
    )
  })

  test('extract validator from a namespaced import', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import * as userValidators from '#validators/user'

      export default class UsersController {
        async store({ request }: HttpContext) {
          await request.validateUsing(userValidators.createUserValidator)
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#validators/user',
            type: 'namespace',
            value: 'userValidators',
          },
          name: 'userValidators.createUserValidator',
        },
      ]
    )
  })

  test('extract validator from a default import', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import createUserValidator from '#validators/create_user_validator'

      export default class UsersController {
        async store({ request }: HttpContext) {
          await request.validateUsing(createUserValidator)
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#validators/create_user_validator',
            type: 'default',
            value: 'createUserValidator',
          },
          name: 'createUserValidator',
        },
      ]
    )
  })

  test('return undefined when there is no validator usage', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      export default class UsersController {
        async store({ request }: HttpContext) {
        }
      }
    `
    )

    assert.isUndefined(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      })
    )
  })

  test('return undefined when the controller method is missing', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      export default class UsersController {
      }
    `
    )

    assert.isUndefined(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      })
    )
  })

  test('extract validator from direct usage', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import { createUserValidator } from '#validators/user'

      export default class UsersController {
        async store({ request }: HttpContext) {
          await createUserValidator.validate(request.all())
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#validators/user',
            type: 'named',
            value: 'createUserValidator',
          },
          name: 'createUserValidator',
        },
      ]
    )
  })

  test('extract multiple validators usage', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import { createAdminValidator, createUserValidator } from '#validators/user'

      export default class UsersController {
        async store({ request }: HttpContext) {
          if (request.url() === '/admin') {
            await request.validateUsing(createAdminValidator)
          }
          else {
            await createUserValidator.validate(request.all())
          }
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#validators/user',
            type: 'named',
            value: 'createAdminValidator',
          },
          name: 'createAdminValidator',
        },
        {
          import: {
            specifier: '#validators/user',
            type: 'named',
            value: 'createUserValidator',
          },
          name: 'createUserValidator',
        },
      ]
    )
  })

  test('extract static validator reference from the class', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      export default class UsersController {
        static validator = vine.compile(
          vine.object({
            fullName: vine.string(),
            email: vine.string(),
            password: vine.string(),
          })
        )

        async store({ request }: HttpContext) {
          await request.validateUsing(UsersController.validator)
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: '#controllers/users_controller',
            type: 'default',
            value: 'UsersController',
          },
          name: 'UsersController.validator',
        },
      ]
    )
  })

  test('resolve correct for validator imported using relative path', async ({ assert, fs }) => {
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import * as userValidators from '../validators/user.ts'

      export default class UsersController {
        async store({ request }: HttpContext) {
          await request.validateUsing(userValidators.createUserValidator)
        }
      }
    `
    )

    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/users_controller.ts'),
        method: 'store',
        name: 'UsersController',
        import: {
          type: 'default',
          value: 'UsersController',
          specifier: '#controllers/users_controller',
        },
      }),
      [
        {
          import: {
            specifier: 'app/validators/user.ts',
            type: 'namespace',
            value: 'userValidators',
          },
          name: 'userValidators.createUserValidator',
        },
      ]
    )
  })

  test('do not match method name when it appear in body of another method', async ({
    assert,
    fs,
  }) => {
    await fs.create(
      'app/controllers/auth_controller.ts',
      `
      import { loginValidator, signupValidator } from '#validators/user'

      export default class AuthController {
        async register({ request, auth }: HttpContext) {
          const payload = await request.validateUsing(signupValidator)
          const user = await User.create({ ...payload })

          // This method body contains the word "login" which should NOT
          // cause the extractor to match this method when looking for the "login" method
          await auth.use('web').login(user)

          return { success: true }
        }

        async login({ request, auth }: HttpContext) {
          const payload = await request.validateUsing(loginValidator)
          const user = await User.verifyCredentials(payload.email, payload.password)
          await auth.use('web').login(user)
        }
      }
    `
    )

    // Extract validators for the `login` method
    // Should return loginValidator, not signupValidator
    assert.deepEqual(
      await extractValidators(fs.basePath, new VirtualFileSystem(fs.basePath), {
        path: join(fs.basePath, 'app/controllers/auth_controller.ts'),
        method: 'login',
        name: 'AuthController',
        import: {
          type: 'default',
          value: 'AuthController',
          specifier: '#controllers/auth_controller',
        },
      }),
      [
        {
          import: { specifier: '#validators/user', type: 'named', value: 'loginValidator' },
          name: 'loginValidator',
        },
      ]
    )
  })
})
