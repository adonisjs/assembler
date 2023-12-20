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
})
