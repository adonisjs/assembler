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
import string from '@poppinss/utils/string'
import { RoutesScanner } from '../../src/code_scanners/routes_scanner/main.ts'

test.group('Routes scanner', () => {
  test('scan routes and infer their request and response types', async ({ assert, fs }) => {
    await fs.createJson('package.json', {
      imports: {
        '#controllers/*': './app/controllers/*.ts',
      },
    })

    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import User from '#models/user'
      import { createUserValidator, updateUserValidator } from '#validators/user'

      export default class UsersController {
        async index({ inertia }: HttpContext) {
          return interia.render('users/list', {
            users: await User.all()
          })
        }

        async create({ inertia }: HttpContext) {
          return interia.render('auth/register')
        }

        async store({ request, response, response }: HttpContext) {
          const payload = await request.validateUsing(
            createUserValidator,
          )

          await User.create(payload)
          response.redirect().back()
        }

        async edit({ auth, inertia }: HttpContext) {
          return interia.render('users/edit', {
            user: auth.getUserOrFail(),
          })
        }

        async update({ request, auth, response, response }: HttpContext) {
          const user = auth.getUserOrFail()
          const payload = await request.validateUsing(
            updateUserValidator,
            {
              meta: { id: user.id }
            }
          )

          user.merge(payload)
          response.redirect().back()
        }
      }
    `
    )

    const scanner = new RoutesScanner(fs.basePath, [])
    scanner.pathsResolver.use((specifier) => {
      const [namespace, ...rest] = specifier.split('/')
      const fileName = rest.pop()
      const resolvedPath = namespace === '#controllers' ? './app/controllers' : ''
      return new URL([resolvedPath, ...rest, `${fileName}.ts`].join('/'), fs.baseUrl).href
    })

    await scanner.scan([
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'index',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users/create',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'create',
        },
      },
      {
        domain: 'root',
        methods: ['POST'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'store',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users/:id/edit',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'edit',
        },
      },
      {
        domain: 'root',
        methods: ['PUT'],
        pattern: '/users/:id',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'update',
        },
      },
    ])

    assert.deepEqual(scanner.getControllers(), [
      join(fs.basePath, 'app/controllers/users_controller.ts'),
    ])
    assert.snapshot(scanner.getScannedRoutes()).matchInline(`
      [
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "index",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.index",
          "pattern": "/users",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "create",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.create",
          "pattern": "/users/create",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['create']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "store",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "users.store",
          "pattern": "/users",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user').createUserValidator)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "createUserValidator",
              },
              "name": "createUserValidator",
            },
          ],
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "edit",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.edit",
          "pattern": "/users/:id/edit",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['edit']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "update",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "PUT",
          ],
          "name": "users.update",
          "pattern": "/users/:id",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user').updateUserValidator)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['update']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "updateUserValidator",
              },
              "name": "updateUserValidator",
            },
          ],
        },
      ]
    `)
  })

  test('self compute response and request types for a given route', async ({ assert, fs }) => {
    await fs.createJson('package.json', {
      imports: {
        '#controllers/*': './app/controllers/*.ts',
      },
    })

    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import User from '#models/user'
      import { createUserValidator, updateUserValidator } from '#validators/user'

      export default class UsersController {
        async index({ inertia }: HttpContext) {
          return interia.render('users/list', {
            users: await User.all()
          })
        }

        async create({ inertia }: HttpContext) {
          return interia.render('auth/register')
        }

        async store({ request, response, response }: HttpContext) {
          const payload = await request.validateUsing(
            createUserValidator,
          )

          await User.create(payload)
          response.redirect().back()
        }

        async edit({ auth, inertia }: HttpContext) {
          return interia.render('users/edit', {
            user: auth.getUserOrFail(),
          })
        }

        async update({ request, auth, response, response }: HttpContext) {
          const user = auth.getUserOrFail()
          const payload = await request.validateUsing(
            updateUserValidator,
            {
              meta: { id: user.id }
            }
          )

          user.merge(payload)
          response.redirect().back()
        }
      }
    `
    )

    const scanner = new RoutesScanner(fs.basePath, [])
    scanner.defineRequest((route) => {
      if (route.name === 'users.store') {
        return {
          imports: [`import * as z from 'zod'`],
          type: `z.output<someSchema>`,
        }
      }
    })

    scanner.defineResponse((route) => {
      if (route.name === 'users.store') {
        return {
          imports: [`import { CreateUserDto } from '#dtos/user'`],
          type: `CreateUserDto`,
        }
      }
    })

    scanner.pathsResolver.use((specifier) => {
      const [namespace, ...rest] = specifier.split('/')
      const fileName = rest.pop()
      const resolvedPath = namespace === '#controllers' ? './app/controllers' : ''
      return new URL([resolvedPath, ...rest, `${fileName}.ts`].join('/'), fs.baseUrl).href
    })

    await scanner.scan([
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'index',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users/create',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'create',
        },
      },
      {
        domain: 'root',
        methods: ['POST'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'store',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users/:id/edit',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'edit',
        },
      },
      {
        domain: 'root',
        methods: ['PUT'],
        pattern: '/users/:id',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'update',
        },
      },
    ])

    assert.deepEqual(scanner.getControllers(), [
      join(fs.basePath, 'app/controllers/users_controller.ts'),
    ])
    assert.snapshot(scanner.getScannedRoutes()).matchInline(`
      [
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "index",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.index",
          "pattern": "/users",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "create",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.create",
          "pattern": "/users/create",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['create']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "store",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "users.store",
          "pattern": "/users",
          "request": {
            "imports": [
              "import * as z from 'zod'",
            ],
            "type": "z.output<someSchema>",
          },
          "response": {
            "imports": [
              "import { CreateUserDto } from '#dtos/user'",
            ],
            "type": "CreateUserDto",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "createUserValidator",
              },
              "name": "createUserValidator",
            },
          ],
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "edit",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.edit",
          "pattern": "/users/:id/edit",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['edit']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "update",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "PUT",
          ],
          "name": "users.update",
          "pattern": "/users/:id",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user').updateUserValidator)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['update']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "updateUserValidator",
              },
              "name": "updateUserValidator",
            },
          ],
        },
      ]
    `)
  })

  test('extract types from namespaced validators import', async ({ assert, fs }) => {
    await fs.createJson('package.json', {
      imports: {
        '#controllers/*': './app/controllers/*.ts',
      },
    })

    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import User from '#models/user'
      import * as userValidators from '#validators/user'

      export default class UsersController {
        async index({ inertia }: HttpContext) {
          return interia.render('users/list', {
            users: await User.all()
          })
        }

        async create({ inertia }: HttpContext) {
          return interia.render('auth/register')
        }

        async store({ request, response, response }: HttpContext) {
          const payload = await request.validateUsing(
            userValidators.create,
          )

          await User.create(payload)
          response.redirect().back()
        }

        async edit({ auth, inertia }: HttpContext) {
          return interia.render('users/edit', {
            user: auth.getUserOrFail(),
          })
        }

        async update({ request, auth, response, response }: HttpContext) {
          const user = auth.getUserOrFail()
          const payload = await request.validateUsing(
            userValidators.update,
            {
              meta: { id: user.id }
            }
          )

          user.merge(payload)
          response.redirect().back()
        }
      }
    `
    )

    const scanner = new RoutesScanner(fs.basePath, [])
    scanner.pathsResolver.use((specifier) => {
      const [namespace, ...rest] = specifier.split('/')
      const fileName = rest.pop()
      const resolvedPath = namespace === '#controllers' ? './app/controllers' : ''
      return new URL([resolvedPath, ...rest, `${fileName}.ts`].join('/'), fs.baseUrl).href
    })

    await scanner.scan([
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'index',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users/create',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'create',
        },
      },
      {
        domain: 'root',
        methods: ['POST'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'store',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users/:id/edit',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'edit',
        },
      },
      {
        domain: 'root',
        methods: ['PUT'],
        pattern: '/users/:id',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'update',
        },
      },
    ])

    assert.snapshot(scanner.getScannedRoutes()).matchInline(`
      [
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "index",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.index",
          "pattern": "/users",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "create",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.create",
          "pattern": "/users/create",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['create']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "store",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "users.store",
          "pattern": "/users",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user'))['create']>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "namespace",
                "value": "userValidators",
              },
              "name": "userValidators.create",
            },
          ],
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "edit",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.edit",
          "pattern": "/users/:id/edit",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['edit']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "update",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "PUT",
          ],
          "name": "users.update",
          "pattern": "/users/:id",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user'))['update']>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['update']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "namespace",
                "value": "userValidators",
              },
              "name": "userValidators.update",
            },
          ],
        },
      ]
    `)
  })

  test('invalidate a controller and re-compute its routes request and response types', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('package.json', {
      imports: {
        '#controllers/*': './app/controllers/*.ts',
      },
    })

    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import User from '#models/user'
      import { createUserValidator } from '#validators/user'

      export default class UsersController {
        async index({ inertia }: HttpContext) {
          return interia.render('users/list', {
            users: await User.all()
          })
        }

        async store({ request, response, response }: HttpContext) {
          const payload = await request.validateUsing(
            createUserValidator,
          )

          await User.create(payload)
          response.redirect().back()
        }
      }
    `
    )

    await fs.create(
      'app/controllers/posts_controller.ts',
      `
      import Post from '#models/post'
      import { createPostValidator } from '#validators/post'

      export default class PostsController {
        async index({ inertia }: HttpContext) {
          return interia.render('posts/list', {
            posts: await Post.all()
          })
        }

        async store({ request, response, response }: HttpContext) {
          const payload = await request.validateUsing(
            createPostValidator,
          )
          await Post.create(payload)
          response.redirect().back()
        }
      }
    `
    )

    const scanner = new RoutesScanner(fs.basePath, [])
    scanner.pathsResolver.use((specifier) => {
      const [namespace, ...rest] = specifier.split('/')
      const fileName = rest.pop()
      const resolvedPath = namespace === '#controllers' ? './app/controllers' : ''
      return new URL([resolvedPath, ...rest, `${fileName}.ts`].join('/'), fs.baseUrl).href
    })

    await scanner.scan([
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'index',
        },
      },
      {
        domain: 'root',
        methods: ['POST'],
        pattern: '/users',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/users_controller')`,
          method: 'store',
        },
      },
      {
        domain: 'root',
        methods: ['GET', 'HEAD'],
        pattern: '/posts',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/posts_controller')`,
          method: 'index',
        },
      },
      {
        domain: 'root',
        methods: ['POST'],
        pattern: '/posts',
        tokens: [],
        controllerReference: {
          importExpression: `() => import('#controllers/posts_controller')`,
          method: 'store',
        },
      },
    ])

    assert.snapshot(scanner.getScannedRoutes()).matchInline(`
      [
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "index",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.index",
          "pattern": "/users",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "store",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "users.store",
          "pattern": "/users",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user').createUserValidator)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "createUserValidator",
              },
              "name": "createUserValidator",
            },
          ],
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/posts_controller",
              "type": "default",
              "value": "PostsController",
            },
            "method": "index",
            "name": "PostsController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/posts_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "posts.index",
          "pattern": "/posts",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/posts_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/posts_controller",
              "type": "default",
              "value": "PostsController",
            },
            "method": "store",
            "name": "PostsController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/posts_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "posts.store",
          "pattern": "/posts",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/post').createPostValidator)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/posts_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/post",
                "type": "named",
                "value": "createPostValidator",
              },
              "name": "createPostValidator",
            },
          ],
        },
      ]
    `)

    /**
     * Let's update both the controllers and invalidate them
     * one by one
     */
    await fs.create(
      'app/controllers/users_controller.ts',
      `
      import User from '#models/user'
      import { createUser } from '#validators/user'

      export default class UsersController {
        async index({ inertia }: HttpContext) {
          return interia.render('users/list', {
            users: await User.all()
          })
        }

        async store({ request, response, response }: HttpContext) {
          const payload = await request.validateUsing(
            createUser,
          )

          await User.create(payload)
          response.redirect().back()
        }
      }
    `
    )

    await fs.create(
      'app/controllers/posts_controller.ts',
      `
      import Post from '#models/post'

      export default class PostsController {
        async index({ inertia }: HttpContext) {
          return interia.render('posts/list', {
            posts: await Post.all()
          })
        }
      }
    `
    )

    await scanner.invalidate(join(fs.basePath, 'app/controllers/users_controller.ts'))
    assert.snapshot(scanner.getScannedRoutes()).matchInline(`
      [
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "index",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.index",
          "pattern": "/users",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "store",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "users.store",
          "pattern": "/users",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user').createUser)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "createUser",
              },
              "name": "createUser",
            },
          ],
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/posts_controller",
              "type": "default",
              "value": "PostsController",
            },
            "method": "index",
            "name": "PostsController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/posts_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "posts.index",
          "pattern": "/posts",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/posts_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/posts_controller",
              "type": "default",
              "value": "PostsController",
            },
            "method": "store",
            "name": "PostsController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/posts_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "posts.store",
          "pattern": "/posts",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/post').createPostValidator)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/posts_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/post",
                "type": "named",
                "value": "createPostValidator",
              },
              "name": "createPostValidator",
            },
          ],
        },
      ]
    `)

    await scanner.invalidate(join(fs.basePath, 'app/controllers/posts_controller.ts'))
    assert.snapshot(scanner.getScannedRoutes()).matchInline(`
      [
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "index",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "users.index",
          "pattern": "/users",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/users_controller",
              "type": "default",
              "value": "UsersController",
            },
            "method": "store",
            "name": "UsersController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/users_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "users.store",
          "pattern": "/users",
          "request": {
            "imports": [
              "import { Infer } from '@vinejs/vine/types'",
            ],
            "type": "Infer<(typeof import('#validators/user').createUser)>",
          },
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/users_controller').default['store']>",
          },
          "tokens": [],
          "validators": [
            {
              "import": {
                "specifier": "#validators/user",
                "type": "named",
                "value": "createUser",
              },
              "name": "createUser",
            },
          ],
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/posts_controller",
              "type": "default",
              "value": "PostsController",
            },
            "method": "index",
            "name": "PostsController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/posts_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "GET",
            "HEAD",
          ],
          "name": "posts.index",
          "pattern": "/posts",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/posts_controller').default['index']>",
          },
          "tokens": [],
          "validators": undefined,
        },
        {
          "controller": {
            "import": {
              "specifier": "#controllers/posts_controller",
              "type": "default",
              "value": "PostsController",
            },
            "method": "store",
            "name": "PostsController",
            "path": "${string.toUnixSlash(join(fs.basePath, '/app/controllers/posts_controller.ts'))}",
          },
          "domain": "root",
          "methods": [
            "POST",
          ],
          "name": "posts.store",
          "pattern": "/posts",
          "request": undefined,
          "response": {
            "imports": [],
            "type": "ReturnType<import('#controllers/posts_controller').default['store']>",
          },
          "tokens": [],
          "validators": undefined,
        },
      ]
    `)
  })
})
