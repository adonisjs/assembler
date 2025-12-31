/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { CodemodException } from '../src/exceptions/codemod_exception.ts'

test.group('CodemodException', () => {
  test('should create exception with message and instructions', ({ assert }) => {
    const exception = new CodemodException('File not found', {
      instructions: 'Add the following code manually',
    })

    assert.equal(exception.message, 'File not found')
    assert.equal(exception.instructions, 'Add the following code manually')
    assert.instanceOf(exception, Error)
  })

  test('should create exception without instructions', ({ assert }) => {
    const exception = new CodemodException('Something went wrong')

    assert.equal(exception.message, 'Something went wrong')
    assert.isUndefined(exception.instructions)
  })

  test('should create exception with file path', ({ assert }) => {
    const exception = new CodemodException('File not found', {
      filePath: 'start/env.ts',
    })

    assert.equal(exception.filePath, 'start/env.ts')
  })
})

test.group('CodemodException | Environment', () => {
  test('missingEnvFile should include variables in instructions', ({ assert }) => {
    const exception = CodemodException.missingEnvFile('start/env.ts', {
      variables: {
        REDIS_HOST: 'Env.schema.string.optional()',
        REDIS_PORT: 'Env.schema.number()',
      },
    })

    assert.include(exception.message, 'start/env.ts')
    assert.equal(exception.filePath, 'start/env.ts')
    assert.include(exception.instructions!, 'REDIS_HOST: Env.schema.string.optional()')
    assert.include(exception.instructions!, 'REDIS_PORT: Env.schema.number()')
  })

  test('missingEnvFile should include leading comment when provided', ({ assert }) => {
    const exception = CodemodException.missingEnvFile('start/env.ts', {
      leadingComment: 'Redis configuration',
      variables: {
        REDIS_HOST: 'Env.schema.string()',
      },
    })

    assert.include(exception.instructions!, 'Redis configuration')
  })

  test('missingEnvCreate should indicate Env.create is missing', ({ assert }) => {
    const exception = CodemodException.missingEnvCreate('start/env.ts', {
      variables: { MY_VAR: 'Env.schema.string()' },
    })

    assert.include(exception.message, 'Env.create')
    assert.include(exception.instructions!, 'MY_VAR: Env.schema.string()')
  })
})

test.group('CodemodException | Middleware', () => {
  test('missingKernelFile should format server middleware', ({ assert }) => {
    const exception = CodemodException.missingKernelFile('start/kernel.ts', 'server', [
      { path: '@adonisjs/static/static_middleware' },
    ])

    assert.include(exception.message, 'start/kernel.ts')
    assert.include(exception.instructions!, `() => import('@adonisjs/static/static_middleware')`)
    assert.include(exception.instructions!, 'server.use')
  })

  test('missingKernelFile should format named middleware', ({ assert }) => {
    const exception = CodemodException.missingKernelFile('start/kernel.ts', 'named', [
      { name: 'auth', path: '#middleware/auth_middleware' },
    ])

    assert.include(exception.instructions!, `auth: () => import('#middleware/auth_middleware')`)
    assert.include(exception.instructions!, 'router.named')
  })

  test('missingMiddlewareStack should indicate which stack is missing', ({ assert }) => {
    const exception = CodemodException.missingMiddlewareStack('start/kernel.ts', 'server', [
      { path: '@adonisjs/cors' },
    ])

    assert.include(exception.message, 'server.use')
  })
})

test.group('CodemodException | Policies', () => {
  test('missingPoliciesFile should format policies', ({ assert }) => {
    const exception = CodemodException.missingPoliciesFile('app/policies/main.ts', [
      { name: 'PostPolicy', path: '#policies/post_policy' },
      { name: 'UserPolicy', path: '#policies/user_policy' },
    ])

    assert.include(exception.instructions!, `PostPolicy: () => import('#policies/post_policy')`)
    assert.include(exception.instructions!, `UserPolicy: () => import('#policies/user_policy')`)
  })
})

test.group('CodemodException | Vite', () => {
  test('missingViteConfig should format plugin with imports', ({ assert }) => {
    const exception = CodemodException.missingViteConfig('vite.config.ts', 'vue({ foo: 32 })', [
      { identifier: 'vue', module: 'vue', isNamed: false },
      { identifier: 'foo', module: 'foo', isNamed: true },
    ])

    assert.include(exception.message, 'vite.config.ts')
    assert.include(exception.instructions!, `import vue from 'vue'`)
    assert.include(exception.instructions!, `import { foo } from 'foo'`)
    assert.include(exception.instructions!, 'vue({ foo: 32 })')
  })
})

test.group('CodemodException | Japa', () => {
  test('missingJapaBootstrap should format plugin with imports', ({ assert }) => {
    const exception = CodemodException.missingJapaBootstrap(
      'tests/bootstrap.ts',
      'fooPlugin(app)',
      [
        { identifier: 'fooPlugin', module: '@adonisjs/foo/plugin/japa', isNamed: true },
        { identifier: 'app', module: '@adonisjs/core/services/app', isNamed: false },
      ]
    )

    assert.include(exception.instructions!, `import { fooPlugin } from '@adonisjs/foo/plugin/japa'`)
    assert.include(exception.instructions!, `import app from '@adonisjs/core/services/app'`)
    assert.include(exception.instructions!, 'fooPlugin(app)')
  })
})

test.group('CodemodException | Generic', () => {
  test('E_CODEMOD_FILE_NOT_FOUND should create exception for missing file', ({ assert }) => {
    const exception = CodemodException.E_CODEMOD_FILE_NOT_FOUND(
      'start/env.ts',
      'MY_VAR: Env.schema.string()'
    )

    assert.include(exception.message, 'start/env.ts')
    assert.equal(exception.filePath, 'start/env.ts')
    assert.include(exception.instructions!, 'MY_VAR: Env.schema.string()')
  })

  test('E_CODEMOD_INVALID_STRUCTURE should create exception for invalid structure', ({
    assert,
  }) => {
    const exception = CodemodException.E_CODEMOD_INVALID_STRUCTURE(
      'Cannot find Env.create statement',
      'start/env.ts',
      'MY_VAR: Env.schema.string()'
    )

    assert.include(exception.message, 'Cannot find Env.create statement')
    assert.equal(exception.filePath, 'start/env.ts')
    assert.include(exception.instructions!, 'MY_VAR: Env.schema.string()')
  })
})
