/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { PathsResolver } from '../src/paths_resolver.ts'
import { join } from 'node:path'

test.group('Paths resolver', () => {
  test('throw error when trying to resolve a relative path', () => {
    const resolver = new PathsResolver()
    resolver.resolve('./routes_scanner.spec.ts')
  }).throws('Cannot resolve relative paths')

  test('resolve subpath import specifier', ({ assert }) => {
    const resolver = new PathsResolver()
    assert.equal(
      resolver.resolve('#src/file_system'),
      join(import.meta.dirname, '..', 'src', 'file_system.ts')
    )
  })

  test('resolve package export specifier', ({ assert }) => {
    const resolver = new PathsResolver()
    assert.equal(
      resolver.resolve('@adonisjs/assembler/code_transformer'),
      join(import.meta.dirname, '..', 'build', 'src', 'code_transformer/main.js')
    )
  })

  test('use custom resolver', ({ assert }) => {
    const resolver = new PathsResolver()
    resolver.use((specifier) => `file:///${specifier.replace('#', '')}`)
    assert.equal(resolver.resolve('#src/file_system'), '/src/file_system')
  })
})
