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
import { PathsResolver } from '../src/paths_resolver.ts'

test.group('Paths resolver', () => {
  test('throw error when trying to resolve a relative path', () => {
    const resolver = new PathsResolver()
    resolver.resolve('./routes_scanner.spec.ts')
  }).throws('Cannot resolve relative paths using PathsResolver')

  test('resolve subpath import specifier', async ({ assert }) => {
    const resolver = new PathsResolver()
    assert.equal(
      resolver.resolve('#tests/dev_server.spec'),
      join(import.meta.dirname, 'dev_server.spec.ts')
    )
  })

  test('resolve package export specifier', ({ assert }) => {
    const resolver = new PathsResolver()
    assert.equal(
      resolver.resolve('@adonisjs/assembler/code_transformer'),
      join(import.meta.dirname, '..', 'build', 'src', 'code_transformer/main.ts')
    )
  })

  test('use custom resolver', ({ assert }) => {
    const resolver = new PathsResolver()
    resolver.use((specifier) => `file:///${specifier.replace('#', '')}`)
    assert.equal(resolver.resolve('#src/file_system'), '/src/file_system')
  })
})
