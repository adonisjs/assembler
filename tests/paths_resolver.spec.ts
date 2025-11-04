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
import { pathToFileURL } from 'node:url'
import { setupFakeAdonisproject } from './helpers.ts'
import { PathsResolver } from '../src/paths_resolver.ts'

test.group('Paths resolver', () => {
  test('throw error when trying to resolve a relative path', ({ fs }) => {
    const resolver = new PathsResolver(fs.basePath)
    resolver.resolve('./routes_scanner.spec.ts')
  }).throws('Cannot resolve relative paths using PathsResolver')

  test('resolve subpath import specifier', async ({ assert, fs }) => {
    await setupFakeAdonisproject(fs)
    const resolver = new PathsResolver(fs.basePath)

    assert.equal(resolver.resolve('#start/kernel'), join(fs.basePath, 'start/kernel.js'))
  })

  test('resolve package export specifier', ({ assert }) => {
    const resolver = new PathsResolver(import.meta.dirname)
    assert.equal(
      resolver.resolve('@adonisjs/assembler/code_transformer'),
      join(import.meta.dirname, '..', 'build', 'src', 'code_transformer/main.js')
    )
  })

  test('use custom resolver', ({ assert, fs }) => {
    const resolver = new PathsResolver(fs.basePath)
    resolver.use((specifier) => pathToFileURL(specifier.replace('#', '')).toString())
    assert.equal(
      resolver.resolve('#src/file_system'),
      join(import.meta.dirname, '..', 'src/file_system')
    )
  })
})
