/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import dedent from 'dedent'
import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import type { FileSystem } from '@japa/file-system'
import { CodeTransformer } from '../src/code_transformer/main.ts'
import { CodemodException } from '../src/exceptions/codemod_exception.ts'

async function setupFakeAdonisproject(fs: FileSystem) {
  await Promise.all([
    fs.createJson('tsconfig.json', { compilerOptions: {} }),
    fs.create('start/kernel.ts', await readFile('./tests/fixtures/kernel.txt', 'utf-8')),
    fs.create('adonisrc.ts', await readFile('./tests/fixtures/adonisrc.txt', 'utf-8')),
    fs.create('start/env.ts', await readFile('./tests/fixtures/env.txt', 'utf-8')),
  ])
}

test.group('Code transformer | getDirectories', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('return default directories when none configured', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)
    const directories = transformer.getDirectories()

    assert.equal(directories.start, 'start')
    assert.equal(directories.tests, 'tests')
    assert.equal(directories.policies, 'app/policies')
  })

  test('return custom directories when configured in adonisrc.ts', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        directories: {
          start: 'boot',
          tests: 'spec',
        }
      })`
    )

    const transformer = new CodeTransformer(fs.baseUrl)
    const directories = transformer.getDirectories()

    assert.equal(directories.start, 'boot')
    assert.equal(directories.tests, 'spec')
    assert.equal(directories.policies, 'app/policies')
  })

  test('return defaults when adonisrc.ts is missing', async ({ assert, fs }) => {
    await fs.remove('adonisrc.ts')
    const transformer = new CodeTransformer(fs.baseUrl)
    const directories = transformer.getDirectories()

    assert.equal(directories.start, 'start')
    assert.equal(directories.tests, 'tests')
  })
})

test.group('Code transformer | addMiddlewareToStack', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add a server middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('server', [
      { path: '@adonisjs/static/static_middleware' },
    ])

    assert.fileContains('start/kernel.ts', `() => import('@adonisjs/static/static_middleware')`)
  })

  test('add multiple server middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('server', [
      { path: '@adonisjs/static/static_middleware' },
      { path: '#foo/middleware.js' },
    ])

    assert.fileContains('start/kernel.ts', `() => import('@adonisjs/static/static_middleware')`)
    assert.fileContains('start/kernel.ts', `() => import('#foo/middleware.js')`)
  })

  test('set correct position when defined', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('server', [
      { path: '@adonisjs/static/static_middleware', position: 'before' },
      { path: '#foo/middleware.js', position: 'before' },
      { path: '#foo/middleware2.js' },
    ])

    const file = await fs.contents('start/kernel.ts')
    assert.snapshot(file).match()
  })

  test('add a route middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('router', [
      { path: '#foo/bar.js', position: 'before' },
      { path: '@adonisjs/random_middleware', position: 'after' },
    ])

    const file = await fs.contents('start/kernel.ts')
    assert.snapshot(file).match()
  })

  test('add route and server middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('router', [{ path: '#foo/bar.js', position: 'before' }])
    await transformer.addMiddlewareToStack('server', [
      { path: '@adonisjs/random_middleware', position: 'after' },
    ])

    const file = await fs.contents('start/kernel.ts')
    assert.snapshot(file).match()
  })

  test('add named middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('named', [
      { name: 'auth', path: '#foo/bar.js', position: 'before' },
      { name: 'rand', path: '@adonisjs/random_middleware', position: 'after' },
    ])

    assert.fileContains('start/kernel.ts', `auth: () => import('#foo/bar.js')`)
    assert.fileContains('start/kernel.ts', `rand: () => import('@adonisjs/random_middleware')`)
  })

  test('do not add duplicate router/server middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('router', [
      { path: '@adonisjs/core/bodyparser_middleware' },
    ])

    await transformer.addMiddlewareToStack('server', [
      { path: '#middleware/container_bindings_middleware' },
    ])

    const file = await fs.contents('start/kernel.ts')
    const occurrences = (
      file.match(/() => import\('@adonisjs\/core\/bodyparser_middleware'\)/g) || []
    ).length

    const occurrences2 = (
      file.match(/() => import\('#middleware\/container_bindings_middleware'\)/g) || []
    ).length

    assert.equal(occurrences, 1)
    assert.equal(occurrences2, 1)
  })

  test('do not add duplicate named middleware', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('named', [{ name: 'auth', path: '#foo/bar.js' }])

    await transformer.addMiddlewareToStack('named', [
      { name: 'auth', path: '#foo/bar2.js' },
      { name: 'auth', path: '#foo/bar3.js' },
    ])

    const file = await fs.contents('start/kernel.ts')
    assert.snapshot(file).match()
  })

  test('throw CodemodException with instructions when kernel.ts file is missing', async ({
    assert,
    fs,
  }) => {
    await fs.remove('start/kernel.ts')
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addMiddlewareToStack('server', [
        { path: '@adonisjs/static/static_middleware' },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'start/kernel.ts')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `() => import('@adonisjs/static/static_middleware')`)
    }
  })

  test('throw CodemodException with instructions for named middleware when kernel.ts is missing', async ({
    assert,
    fs,
  }) => {
    await fs.remove('start/kernel.ts')
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addMiddlewareToStack('named', [
        { name: 'auth', path: '#middleware/auth_middleware' },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `auth: () => import('#middleware/auth_middleware')`)
    }
  })

  test('throw CodemodException with instructions when server.use is missing', async ({
    assert,
    fs,
  }) => {
    await fs.create('start/kernel.ts', `export const foo = {}`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addMiddlewareToStack('server', [
        { path: '@adonisjs/static/static_middleware' },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'server.use')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `() => import('@adonisjs/static/static_middleware')`)
    }
  })

  test('use custom start directory from adonisrc.ts', async ({ assert, fs }) => {
    await fs.remove('start/kernel.ts')
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        directories: {
          start: 'boot',
        }
      })`
    )
    await fs.create('boot/kernel.ts', await readFile('./tests/fixtures/kernel.txt', 'utf-8'))

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addMiddlewareToStack('server', [
      { path: '@adonisjs/static/static_middleware' },
    ])

    assert.fileContains('boot/kernel.ts', `() => import('@adonisjs/static/static_middleware')`)
  })
})

test.group('Code transformer | defineEnvValidations', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))
  test('define new env validations', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.defineEnvValidations({
      variables: {
        MY_VAR: 'Env.schema.string.optional()',
        MY_VAR2: 'Env.schema.number()',
      },
    })

    assert.fileContains('start/env.ts', `MY_VAR: Env.schema.string.optional()`)
    assert.fileContains('start/env.ts', `MY_VAR2: Env.schema.number()`)
  })

  test('add leading comment', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.defineEnvValidations({
      leadingComment: 'Redis configuration',
      variables: {
        REDIS_HOST: 'Env.schema.string.optional()',
        REDIS_PORT: 'Env.schema.number()',
      },
    })

    const file = await fs.contents('start/env.ts')
    assert.snapshot(file).match()
  })

  test('do not add duplicates', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.defineEnvValidations({
      leadingComment: 'Redis configuration',
      variables: {
        REDIS_HOST: 'Env.schema.string.optional()',
        REDIS_PORT: 'Env.schema.number()',
      },
    })

    await transformer.defineEnvValidations({
      leadingComment: 'Redis configuration',
      variables: {
        REDIS_HOST: 'Env.schema.string.optional()',
        REDIS_PORT: 'Env.schema.number()',
      },
    })

    assert.snapshot(await fs.contents('start/env.ts')).matchInline(`
      "import { Env } from '@adonisjs/core/env'

      export default await Env.create(new URL('../', import.meta.url), {
        NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
        PORT: Env.schema.number(),

        /*
        |----------------------------------------------------------
        | Redis configuration
        |----------------------------------------------------------
        */
        REDIS_HOST: Env.schema.string.optional(),
        REDIS_PORT: Env.schema.number()
      })
      "
    `)
  })

  test('do not overwrite validation for existing variable', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.defineEnvValidations({
      variables: {
        REDIS_HOST: 'Env.schema.string.optional()',
        REDIS_PORT: 'Env.schema.number()',
      },
    })

    await transformer.defineEnvValidations({
      variables: {
        REDIS_HOST: 'Env.schema.string()',
        REDIS_PORT: 'Env.schema.number()',
      },
    })

    assert.snapshot(await fs.contents('start/env.ts')).matchInline(`
      "import { Env } from '@adonisjs/core/env'

      export default await Env.create(new URL('../', import.meta.url), {
        NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
        PORT: Env.schema.number(),

        REDIS_HOST: Env.schema.string.optional(),
        REDIS_PORT: Env.schema.number()
      })
      "
    `)
  })

  test('throw CodemodException with instructions when env.ts file is missing', async ({
    assert,
    fs,
  }) => {
    await fs.remove('start/env.ts')
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.defineEnvValidations({
        leadingComment: 'Redis configuration',
        variables: {
          REDIS_HOST: 'Env.schema.string.optional()',
          REDIS_PORT: 'Env.schema.number()',
        },
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'start/env.ts')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, 'REDIS_HOST: Env.schema.string.optional()')
      assert.include(error.instructions, 'REDIS_PORT: Env.schema.number()')
    }
  })

  test('throw CodemodException with instructions when Env.create is missing', async ({
    assert,
    fs,
  }) => {
    await fs.create('start/env.ts', `export const env = {}`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.defineEnvValidations({
        variables: {
          MY_VAR: 'Env.schema.string()',
        },
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'Env.create')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, 'MY_VAR: Env.schema.string()')
    }
  })

  test('use custom start directory from adonisrc.ts', async ({ assert, fs }) => {
    await fs.remove('start/env.ts')
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        directories: {
          start: 'boot',
        }
      })`
    )
    await fs.create('boot/env.ts', await readFile('./tests/fixtures/env.txt', 'utf-8'))

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.defineEnvValidations({
      variables: {
        MY_VAR: 'Env.schema.string()',
      },
    })

    assert.fileContains('boot/env.ts', 'MY_VAR: Env.schema.string()')
  })
})

test.group('Code transformer | updateRcFile errors', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('throw CodemodException with instructions when adonisrc.ts is missing', async ({
    assert,
    fs,
  }) => {
    await fs.remove('adonisrc.ts')
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.updateRcFile((rcFile) => {
        rcFile.addCommand('#foo/bar.js')
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'adonisrc.ts')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, 'defineConfig')
    }
  })

  test('throw CodemodException when defineConfig is missing', async ({ assert, fs }) => {
    await fs.create('adonisrc.ts', `export default {}`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.updateRcFile((rcFile) => {
        rcFile.addCommand('#foo/bar.js')
      })
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'defineConfig')
      assert.isDefined(error.instructions)
    }
  })
})

test.group('Code transformer | addCommand', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add command to rc file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addCommand('#foo/bar.js').addCommand('#foo/bar2.js')
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })

  test('add command should not add duplicate', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addCommand('#foo/bar.js').addCommand('#foo/bar.js')
    })

    const file = await fs.contents('adonisrc.ts')
    const occurrences = (file.match(/() => import\('#foo\/bar\.js'\)/g) || []).length

    assert.equal(occurrences, 1)
  })

  test('should add command even if commands property is missing', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        typescript: true,
      })`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addCommand('#foo/bar.js')
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })
})

test.group('Code transformer | addProvider', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add provider to rc file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/redis-provider')
    })

    assert.fileContains('adonisrc.ts', `() => import('@adonisjs/redis-provider')`)
  })

  test('add provider to rc file with specific environments', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/redis-provider', ['console', 'repl'])
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })

  test('should add provider even if providers property is missing', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        typescript: true,
      })`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/redis-provider')
    })

    assert.fileContains('adonisrc.ts', `() => import('@adonisjs/redis-provider')`)
  })

  test('should ignore provider duplicate', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/redis-provider').addProvider('@adonisjs/redis-provider')
    })

    const file = await fs.contents('adonisrc.ts')
    const occurrences = (file.match(/() => import\('@adonisjs\/redis-provider'\)/g) || []).length

    assert.equal(occurrences, 1)
  })

  test('should ignore provider duplicate when using different environments', async ({
    assert,
    fs,
  }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile
        .addProvider('@adonisjs/redis-provider', ['console'])
        .addProvider('@adonisjs/redis-provider')
    })

    const file = await fs.contents('adonisrc.ts')
    const occurrences = (file.match(/() => import\('@adonisjs\/redis-provider'\)/g) || []).length

    assert.equal(occurrences, 1)
  })

  test('do no add environments when they are all specified', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addProvider('@adonisjs/redis-provider', ['console', 'repl', 'web', 'test'])
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })
})

test.group('Code transformer | addMetaFile', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add meta files to rc file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addMetaFile('assets/**', false)
    })

    assert.fileContains('adonisrc.ts', `assets/**`)
  })

  test('add meta files to rc file with reload server', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addMetaFile('assets/**', true)
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })
})

test.group('Code transformer | setDirectory', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('set directory in rc file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.setDirectory('views', 'templates')
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })

  test('set directory should overwrite if already defined', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        directories: {
          views: 'resources/views',
        },
      })`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.setDirectory('views', 'templates')
    })

    assert.fileContains('adonisrc.ts', `templates`)
  })
})

test.group('Code transformer | setCommandAlias', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('set command alias in rc file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.setCommandAlias('migrate', 'migration:run')
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })

  test('set commandAlias should overwrite if already defined', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        commandsAliases: {
          migrate: 'migration:run',
        },
      })`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.setCommandAlias('migrate', 'migration:run --force')
    })

    assert.fileContains('adonisrc.ts', `migration:run --force`)
  })
})

test.group('Code transformer | addSuite', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add a new test suite to the rcFile', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/build/standalone'

      export default defineConfig({
        commands: [],
      })
      `
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addSuite('unit', 'test/unit')
    })

    assert.fileContains('adonisrc.ts', `name: 'unit'`)
  })

  test('should ignore suite duplicate', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/build/standalone'

      export default defineConfig({
        commands: [],
        tests: {
          suites: [
            {
              name: 'unit',
              files: ['test/unit'],
            },
          ],
        },
      })
      `
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addSuite('unit', 'nope')
    })

    const file = await fs.contents('adonisrc.ts')
    assert.include(file, `name: 'unit'`)
    assert.notInclude(file, `nope`)
  })
})

test.group('Code transformer | addPreloadFile', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add preload file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addPreloadFile('#start/foo.js')
    })

    assert.fileContains('adonisrc.ts', `'#start/foo.js'`)
  })

  test('add preload file with specific environments', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addPreloadFile('#start/foo.js', ['console', 'repl'])
    })

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })

  test('do not add preload file when already defined', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addPreloadFile('#start/foo.js').addPreloadFile('#start/foo.js')
    })

    const file = await fs.contents('adonisrc.ts')
    const occurrences = (file.match(/'#start\/foo\.js'/g) || []).length

    assert.equal(occurrences, 1)
  })
})

test.group('Code transformer | addJapaPlugin', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add named import', async ({ assert, fs }) => {
    await fs.create(
      'tests/bootstrap.ts',
      `
      import app from '@adonisjs/core/services/app'
      import { assert } from '@japa/assert'

      export const plugins: Config['plugins'] = [
        assert(),
      ]`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addJapaPlugin('fooPlugin(app)', [
      {
        module: '@adonisjs/foo/plugin/japa',
        identifier: 'fooPlugin',
        isNamed: true,
      },
      {
        module: '@adonisjs/core/services/app',
        identifier: 'app',
        isNamed: false,
      },
    ])

    const file = await fs.contents('tests/bootstrap.ts')
    assert.snapshot(file).matchInline(`
      "
      import app from '@adonisjs/core/services/app'
      import { assert } from '@japa/assert'
      import { fooPlugin } from '@adonisjs/foo/plugin/japa'

      export const plugins: Config['plugins'] = [
        assert(),
        fooPlugin(app)
      ]
      "
    `)
  })

  test('add default import', async ({ assert, fs }) => {
    await fs.create(
      'tests/bootstrap.ts',
      `
      import app from '@adonisjs/core/services/app'
      import { assert } from '@japa/assert'

      export const plugins: Config['plugins'] = [
        assert(),
      ]`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addJapaPlugin('fooPlugin()', [
      {
        module: '@adonisjs/foo/plugin/japa',
        identifier: 'fooPlugin',
        isNamed: false,
      },
    ])

    const file = await fs.contents('tests/bootstrap.ts')
    assert.snapshot(file).matchInline(`
      "
      import app from '@adonisjs/core/services/app'
      import { assert } from '@japa/assert'
      import fooPlugin from '@adonisjs/foo/plugin/japa'

      export const plugins: Config['plugins'] = [
        assert(),
        fooPlugin()
      ]
      "
    `)
  })

  test('ignore duplicate imports', async ({ assert, fs }) => {
    await fs.create(
      'tests/bootstrap.ts',
      `
      import app from '@adonisjs/core/services/app'
      import { assert } from '@japa/assert'

      export const plugins: Config['plugins'] = [
        assert(),
      ]`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addJapaPlugin('fooPlugin(app)', [
      {
        module: '@adonisjs/foo/plugin/japa',
        identifier: 'fooPlugin',
        isNamed: true,
      },
      {
        module: '@adonisjs/core/services/app',
        identifier: 'app',
        isNamed: false,
      },
    ])

    await transformer.addJapaPlugin('fooPlugin(app)', [
      {
        module: '@adonisjs/foo/plugin/japa',
        identifier: 'fooPlugin',
        isNamed: true,
      },
      {
        module: '@adonisjs/core/services/app',
        identifier: 'app',
        isNamed: false,
      },
    ])

    const file = await fs.contents('tests/bootstrap.ts')
    assert.snapshot(file).matchInline(`
      "
      import app from '@adonisjs/core/services/app'
      import { assert } from '@japa/assert'
      import { fooPlugin } from '@adonisjs/foo/plugin/japa'

      export const plugins: Config['plugins'] = [
        assert(),
        fooPlugin(app)
      ]
      "
    `)
  })

  test('throw CodemodException with instructions when bootstrap.ts is missing', async ({
    assert,
    fs,
  }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addJapaPlugin('fooPlugin()', [
        { identifier: 'fooPlugin', module: '@adonisjs/foo/plugin/japa', isNamed: true },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'tests/bootstrap.ts')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `import { fooPlugin } from '@adonisjs/foo/plugin/japa'`)
      assert.include(error.instructions, 'fooPlugin()')
    }
  })

  test('use custom tests directory from adonisrc.ts', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        directories: {
          tests: 'spec',
        }
      })`
    )
    await fs.create(
      'spec/bootstrap.ts',
      dedent`
      import { assert } from '@japa/assert'

      export const plugins: Config['plugins'] = [
        assert(),
      ]`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addJapaPlugin('fooPlugin()', [
      { identifier: 'fooPlugin', module: '@adonisjs/foo/plugin/japa', isNamed: true },
    ])

    assert.fileContains('spec/bootstrap.ts', 'fooPlugin()')
  })
})

test.group('Code transformer | addPolicies', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add policies to polices/main.ts file', async ({ assert, fs }) => {
    await fs.create('app/policies/main.ts', `export const policies = {}`)

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addPolicies([
      {
        name: 'PostPolicy',
        path: '#policies/post_policy',
      },
      {
        name: 'UserPolicy',
        path: '#policies/user_policy',
      },
    ])

    const file = await fs.contents('app/policies/main.ts')
    assert.snapshot(file).matchInline(`
      "export const policies = {
        UserPolicy: () => import('#policies/user_policy'),
        PostPolicy: () => import('#policies/post_policy')
      }
      "
    `)
  })

  test('throw CodemodException with instructions when policies/main.ts file is missing', async ({
    assert,
    fs,
  }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addPolicies([
        { name: 'PostPolicy', path: '#policies/post_policy' },
        { name: 'UserPolicy', path: '#policies/user_policy' },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'app/policies/main.ts')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `PostPolicy: () => import('#policies/post_policy')`)
      assert.include(error.instructions, `UserPolicy: () => import('#policies/user_policy')`)
    }
  })

  test('throw CodemodException with instructions when policies object is not defined', async ({
    assert,
    fs,
  }) => {
    await fs.create('app/policies/main.ts', `export const foo = {}`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addPolicies([{ name: 'PostPolicy', path: '#policies/post_policy' }])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `PostPolicy: () => import('#policies/post_policy')`)
    }
  })

  test('throw CodemodException with instructions when policies declaration is not an object', async ({
    assert,
    fs,
  }) => {
    await fs.create('app/policies/main.ts', `export const policies = []`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addPolicies([{ name: 'PostPolicy', path: '#policies/post_policy' }])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `PostPolicy: () => import('#policies/post_policy')`)
    }
  })

  test('use custom policies directory from adonisrc.ts', async ({ assert, fs }) => {
    await fs.create(
      'adonisrc.ts',
      dedent`
      import { defineConfig } from '@adonisjs/core/app'

      export default defineConfig({
        directories: {
          policies: 'domain/policies',
        }
      })`
    )
    await fs.create('domain/policies/main.ts', `export const policies = {}`)

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addPolicies([{ name: 'PostPolicy', path: '#policies/post_policy' }])

    assert.fileContains(
      'domain/policies/main.ts',
      `PostPolicy: () => import('#policies/post_policy')`
    )
  })
})

test.group('Code transformer | addVitePlugin', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add vite plugin to vite.config.ts file', async ({ assert, fs }) => {
    await fs.create(
      'vite.config.ts',
      `export default {
        plugins: [],
      }`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addVitePlugin('vue({ foo: 32 })', [
      { identifier: 'vue', module: 'vue', isNamed: false },
      { identifier: 'foo', module: 'foo', isNamed: true },
    ])

    const file = await fs.contents('vite.config.ts')
    assert.snapshot(file).matchInline(`
      "import vue from 'vue'
      import { foo } from 'foo'

      export default {
        plugins: [vue({ foo: 32 })],
      }
      "
    `)
  })

  test('ignore duplicates when adding vite plugin', async ({ assert, fs }) => {
    await fs.create(
      'vite.config.ts',
      `export default {
        plugins: [],
      }`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addVitePlugin('vue({ foo: 32 })', [
      { identifier: 'vue', module: 'vue', isNamed: false },
      { identifier: 'foo', module: 'foo', isNamed: true },
    ])

    await transformer.addVitePlugin('vue({ foo: 32 })', [
      { identifier: 'vue', module: 'vue', isNamed: false },
      { identifier: 'foo', module: 'foo', isNamed: true },
    ])

    const file = await fs.contents('vite.config.ts')
    assert.snapshot(file).matchInline(`
      "import vue from 'vue'
      import { foo } from 'foo'

      export default {
        plugins: [vue({ foo: 32 })],
      }
      "
    `)
  })

  test('insert in defineConfig call', async ({ assert, fs }) => {
    await fs.create(
      'vite.config.ts',
      `export default defineConfig({
          plugins: [],
        })`
    )

    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.addVitePlugin('vue({ foo: 32 })', [
      { identifier: 'vue', module: 'vue', isNamed: false },
      { identifier: 'foo', module: 'foo', isNamed: true },
    ])

    await transformer.addVitePlugin('vue({ foo: 32 })', [
      { identifier: 'vue', module: 'vue', isNamed: false },
      { identifier: 'foo', module: 'foo', isNamed: true },
    ])

    const file = await fs.contents('vite.config.ts')
    assert.snapshot(file).matchInline(`
      "import vue from 'vue'
      import { foo } from 'foo'

      export default defineConfig({
        plugins: [vue({ foo: 32 })],
      })
      "
    `)
  })

  test('throw CodemodException with instructions when vite.config.ts is missing', async ({
    assert,
    fs,
  }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addVitePlugin('vue()', [
        { identifier: 'vue', module: 'vue', isNamed: false },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.include(error.message, 'vite.config.ts')
      assert.isDefined(error.instructions)
      assert.include(error.instructions, `import vue from 'vue'`)
      assert.include(error.instructions, 'vue()')
    }
  })

  test('throw CodemodException with instructions when no default export found', async ({
    assert,
    fs,
  }) => {
    await fs.create('vite.config.ts', `export const plugins = []`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addVitePlugin('vue()', [
        { identifier: 'vue', module: 'vue', isNamed: false },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.isDefined(error.instructions)
      assert.include(error.instructions, 'vue()')
    }
  })

  test('throw CodemodException with instructions when plugins property is not found', async ({
    assert,
    fs,
  }) => {
    await fs.create('vite.config.ts', `export default {}`)
    const transformer = new CodeTransformer(fs.baseUrl)

    try {
      await transformer.addVitePlugin('vue()', [
        { identifier: 'vue', module: 'vue', isNamed: false },
      ])
      assert.fail('Should have thrown an error')
    } catch (error) {
      assert.instanceOf(error, CodemodException)
      assert.isDefined(error.instructions)
      assert.include(error.instructions, 'vue()')
    }
  })
})

test.group('Code Transformer | addAssemblerHook', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add assembler hook to the assembler file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) =>
      rcFile.addAssemblerHook('buildFinished', '@adonisjs/vite/hooks/onBuildCompleted')
    )

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })

  test('dont add duplicate assembler hooks', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) => {
      rcFile.addAssemblerHook('buildFinished', '@adonisjs/vite/hooks/onBuildCompleted')
      rcFile.addAssemblerHook('buildFinished', '@adonisjs/vite/hooks/onBuildCompleted')
    })

    const file = await fs.contents('adonisrc.ts')
    const occurrences = (file.match(/@adonisjs\/vite\/hooks\/onBuildCompleted/g) || []).length

    assert.equal(occurrences, 1)
  })

  test('add raw assembler hook to the assembler file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) =>
      rcFile.addAssemblerHook('init', 'indexPages()', true)
    )

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })
})

test.group('Code Transformer | addDefaultImport', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add default import to the assembler file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) =>
      rcFile.addDefaultImport('@adonisjs/inertia', 'indexPages')
    )

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })
})

test.group('Code Transformer | addNamedImport', (group) => {
  group.each.setup(async ({ context }) => setupFakeAdonisproject(context.fs))

  test('add named import to the assembler file', async ({ assert, fs }) => {
    const transformer = new CodeTransformer(fs.baseUrl)

    await transformer.updateRcFile((rcFile) =>
      rcFile.addNamedImport('@adonisjs/inertia', ['indexPages'])
    )

    const file = await fs.contents('adonisrc.ts')
    assert.snapshot(file).match()
  })
})
