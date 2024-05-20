/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ts from 'typescript'
import { test } from '@japa/runner'
import { setTimeout as sleep } from 'node:timers/promises'

import { Bundler } from '../index.js'

test.group('Bundler', () => {
  test('should copy metafiles to the build directory', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('package.json', '{}'),
      fs.create('package-lock.json', '{}'),

      fs.create('resources/js/app.ts', ''),
      fs.create('resources/views/app.edge', ''),
      fs.create('resources/views/foo.edge', ''),
      fs.create('resources/views/nested/bar.edge', ''),
      fs.create('resources/views/nested/baz.edge', ''),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    await bundler.bundle(true, 'npm')

    await Promise.all([
      assert.fileExists('./build/resources/views/app.edge'),
      assert.fileExists('./build/resources/views/foo.edge'),
      assert.fileExists('./build/resources/views/nested/bar.edge'),
      assert.fileExists('./build/resources/views/nested/baz.edge'),
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/adonisrc.js'),
      assert.fileExists('./build/package-lock.json'),
    ])
  })

  test('should copy metafiles even if lock file is missing', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('package.json', '{}'),

      fs.create('resources/views/app.edge', ''),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    await bundler.bundle(true, 'npm')

    await Promise.all([
      assert.fileExists('./build/resources/views/app.edge'),
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/adonisrc.js'),
    ])
  })

  test('use npm by default if not specified', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('package.json', '{}'),
      fs.create('package-lock.json', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    await bundler.bundle(true)

    await Promise.all([
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/package-lock.json'),
    ])
  })

  test('detect package manager if not specified', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('package.json', '{}'),
      fs.create('pnpm-lock.yaml', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    await bundler.bundle(true)

    await Promise.all([
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/pnpm-lock.yaml'),
    ])
  })

  test('detect yarn@berry and move all its files if not specified', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('package.json', '{ "packageManager": "yarn@4.2.1" }'),
      fs.create('yarn.lock', '{}'),
      fs.create('.yarnrc.yml', '{}'),
      fs.create('.yarn/install-state.gz', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    await bundler.bundle(true)

    await Promise.all([
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/yarn.lock'),
      assert.fileExists('./build/.yarnrc.yml'),
      assert.fileExists('./build/.yarn/install-state.gz'),
    ])
  })

  test('remove ts-node reference in builded ace.js file', async ({ assert, fs }) => {
    await Promise.all([
      fs.create('ace.js', 'foo'),
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('package.json', '{}'),
      fs.create('package-lock.json', '{}'),
    ])

    await new Bundler(fs.baseUrl, ts, {}).bundle()

    const aceFile = await fs.contents('./build/ace.js')
    assert.notInclude(aceFile, 'ts-node')
  })

  test('execute hooks', async ({ assert, fs }) => {
    assert.plan(2)

    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({ compilerOptions: { outDir: 'build', skipLibCheck: true } })
      ),
      fs.create('adonisrc.ts', 'export default { hooks: { onBuildStarting: [() => {}] } }'),
      fs.create('package.json', '{}'),
      fs.create('package-lock.json', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      hooks: {
        onBuildStarting: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
        onBuildCompleted: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
      },
    })

    await bundler.bundle()
  })

  test('wait for hooks to be registered', async ({ assert, fs }) => {
    assert.plan(1)

    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
      exclude: [],
    })
    await fs.create('index.ts', 'console.log("hey")')
    await fs.create('bin/server.js', `process.send({ isAdonisJS: true, environment: 'web' })`)
    await fs.create('.env', 'PORT=3334')

    const bundler = new Bundler(fs.baseUrl, ts, {
      hooks: {
        onBuildStarting: [
          async () => {
            await sleep(1000)
            return {
              default: () => {
                assert.isTrue(true)
              },
            }
          },
        ],
      },
    })

    await bundler.bundle()
  }).timeout(10_000)
})
