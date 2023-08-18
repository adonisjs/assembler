import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { CodeTransformer } from '../src/code_transformer.js'

test.group('Code transformer', (group) => {
  group.each.setup(async ({ context }) => {
    await Promise.all([
      context.fs.createJson('tsconfig.json', { compilerOptions: {} }),
      context.fs.create('start/kernel.ts', await readFile('./tests/fixtures/kernel.txt', 'utf-8')),
      context.fs.create('start/env.ts', await readFile('./tests/fixtures/env.txt', 'utf-8')),
    ])
  })

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
})
