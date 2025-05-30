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

import { Bundler } from '../index.ts'

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
      suites: [],
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    bundler.ui.switchMode('raw')
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
      suites: [],
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    bundler.ui.switchMode('raw')
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
      suites: [],
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    bundler.ui.switchMode('raw')
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
      suites: [],
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    bundler.ui.switchMode('raw')
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
      suites: [],
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    bundler.ui.switchMode('raw')
    await bundler.bundle(true)

    await Promise.all([
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/yarn.lock'),
      assert.fileExists('./build/.yarnrc.yml'),
      assert.fileExists('./build/.yarn/install-state.gz'),
    ])
  })

  test('remove @poppinss/ts-exec reference in compiled ace.js file', async ({ assert, fs }) => {
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

    const bundler = new Bundler(fs.baseUrl, ts, { suites: [] })
    bundler.ui.switchMode('raw')
    await bundler.bundle()

    const aceFile = await fs.contents('./build/ace.js')
    assert.notInclude(aceFile, '@poppinss/ts-exec')
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
        buildStarting: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
        buildFinished: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
      },
    })

    bundler.ui.switchMode('raw')
    await bundler.bundle()
  })

  test('build typescript project', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({
          compilerOptions: {
            outDir: 'build',
            skipLibCheck: true,
            target: 'ESNext',
            module: 'NodeNext',
            lib: ['ESNext'],
          },
        })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create('index.ts', 'export default function main() {}'),
      fs.createJson('package.json', {
        type: 'module',
      }),
      fs.create('package-lock.json', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {})
    bundler.ui.switchMode('raw')
    await bundler.bundle(true, 'npm')

    await Promise.all([
      assert.fileExists('./build/adonisrc.js'),
      assert.fileExists('./build/index.js'),
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/package-lock.json'),
    ])
    await assert.fileContains('./build/index.js', 'export default function main() { }')
  })

  test('do not build when there are type errors', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({
          compilerOptions: {
            outDir: 'build',
            skipLibCheck: true,
            target: 'ESNext',
            module: 'NodeNext',
            lib: ['ESNext'],
          },
        })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create(
        'index.ts',
        `export default function main(mod: number) {
        return mod.toUpperCase()
      }`
      ),
      fs.createJson('package.json', {
        type: 'module',
      }),
      fs.create('package-lock.json', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {})
    bundler.ui.switchMode('raw')
    await bundler.bundle(true, 'npm')

    await assert.dirNotExists('./build')
  })

  test('create build when instructed to ignore ts error', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(
        'tsconfig.json',
        JSON.stringify({
          compilerOptions: {
            outDir: 'build',
            skipLibCheck: true,
            target: 'ESNext',
            module: 'NodeNext',
            lib: ['ESNext'],
          },
        })
      ),
      fs.create('adonisrc.ts', 'export default {}'),
      fs.create(
        'index.ts',
        `export default function main(mod: number) {
        return mod.toUpperCase()
      }`
      ),
      fs.createJson('package.json', {
        type: 'module',
      }),
      fs.create('package-lock.json', '{}'),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {})
    bundler.ui.switchMode('raw')
    await bundler.bundle(false, 'npm')

    await assert.dirExists('./build')
  })
})
