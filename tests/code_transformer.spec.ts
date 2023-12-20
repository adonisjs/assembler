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
import { CodeTransformer } from '../src/code_transformer/main.js'

async function setupFakeAdonisproject(fs: FileSystem) {
  await Promise.all([
    fs.createJson('tsconfig.json', { compilerOptions: {} }),
    fs.create('start/kernel.ts', await readFile('./tests/fixtures/kernel.txt', 'utf-8')),
    fs.create('adonisrc.ts', await readFile('./tests/fixtures/adonisrc.txt', 'utf-8')),
    fs.create('start/env.ts', await readFile('./tests/fixtures/env.txt', 'utf-8')),
  ])
}

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
})
