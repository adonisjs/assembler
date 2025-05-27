/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import slash from 'slash'
import ts from 'typescript'
import { join } from 'node:path'
import { test } from '@japa/runner'
import { parseConfig } from '../../src/utils.js'

test.group('Helpers | Parse config', () => {
  test('report error when config file is missing', async ({ assert, fs }) => {
    const result = parseConfig(fs.baseUrl, ts)
    assert.isUndefined(result)
  })

  test('report config errors to console', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
    })

    const result = parseConfig(fs.baseUrl, ts)
    assert.isUndefined(result)
  })

  test('parse tsconfig file', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
    })
    await fs.create('foo.ts', '')

    const result = parseConfig(fs.baseUrl, ts)
    assert.deepEqual(result?.fileNames, [slash(join(fs.basePath, 'foo.ts'))])
  })
})
