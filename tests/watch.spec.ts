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
import { watch } from '../src/helpers.js'

test.group('Watcher', () => {
  test('watch files included by the tsconfig.json', async ({ fs, assert, cleanup }, done) => {
    assert.plan(1)

    await fs.create(
      'tsconfig.json',
      JSON.stringify({
        include: ['./**/*'],
      })
    )
    await fs.create('foo.ts', '')

    const output = watch(fs.baseUrl, ts, {})
    cleanup(() => output!.chokidar.close())

    output!.watcher.on('source:add', (file) => {
      assert.equal(file.relativePath, 'bar.ts')
      done()
    })

    output!.watcher.on('watcher:ready', async () => {
      await fs.create('bar.ts', '')
    })
  })
    .waitForDone()
    .skip(!!process.env.CI, 'Skipping in CI. Cannot get chokidar to work')

  test('emit source:change when file is changed', async ({ fs, assert, cleanup }, done) => {
    assert.plan(1)

    await fs.create(
      'tsconfig.json',
      JSON.stringify({
        include: ['./**/*'],
      })
    )
    await fs.create('foo.ts', '')

    const output = watch(fs.baseUrl, ts, {})
    cleanup(() => output!.chokidar.close())

    output!.watcher.on('source:change', (file) => {
      assert.equal(file.relativePath, 'foo.ts')
      done()
    })

    output!.watcher.on('watcher:ready', async () => {
      await fs.create('foo.ts', 'hello world')
    })
  })
    .waitForDone()
    .skip(!!process.env.CI, 'Skipping in CI. Cannot get chokidar to work')

  test('emit source:unlink when file is deleted', async ({ fs, assert, cleanup }, done) => {
    assert.plan(1)

    await fs.create(
      'tsconfig.json',
      JSON.stringify({
        include: ['./**/*'],
      })
    )
    await fs.create('foo.ts', '')

    const output = watch(fs.baseUrl, ts, {})
    cleanup(() => output!.chokidar.close())

    output!.watcher.on('source:unlink', (file) => {
      assert.equal(file.relativePath, 'foo.ts')
      done()
    })

    output!.watcher.on('watcher:ready', async () => {
      await fs.remove('foo.ts')
    })
  })
    .waitForDone()
    .skip(!!process.env.CI, 'Skipping in CI. Cannot get chokidar to work')

  test('do not emit source:add when file is excluded by tsconfig.json', async ({
    fs,
    assert,
    cleanup,
  }) => {
    await fs.create(
      'tsconfig.json',
      JSON.stringify({
        include: ['./**/*'],
        exclude: ['./baz.ts'],
      })
    )
    await fs.create('foo.ts', '')

    const output = watch(fs.baseUrl, ts, {})
    cleanup(() => output!.chokidar.close())

    output!.watcher.on('source:add', () => {
      assert.fail('Never expected to reach here')
    })

    output!.watcher.on('watcher:ready', async () => {
      await fs.create('baz.ts', '')
    })
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }).skip(!!process.env.CI, 'Skipping in CI. Cannot get chokidar to work')

  test('emit add when files other than typescript source files are created', async ({
    fs,
    assert,
    cleanup,
  }, done) => {
    assert.plan(1)

    await fs.create(
      'tsconfig.json',
      JSON.stringify({
        include: ['./**/*'],
      })
    )
    await fs.create('foo.ts', '')

    const output = watch(fs.baseUrl, ts, {})
    cleanup(() => output!.chokidar.close())

    output!.watcher.on('add', (file) => {
      assert.equal(file.relativePath, 'foo.md')
      done()
    })

    output!.watcher.on('watcher:ready', async () => {
      await fs.create('foo.md', '')
    })
  })
    .waitForDone()
    .skip(!!process.env.CI, 'Skipping in CI. Cannot get chokidar to work')
})
