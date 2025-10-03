/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ts from 'typescript'
import { join } from 'node:path'
import { test } from '@japa/runner'
import string from '@poppinss/utils/string'
import { parseConfig } from '../../src/utils.ts'

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
    assert.deepEqual(result?.fileNames, [string.toUnixSlash(join(fs.basePath, 'foo.ts'))])
  })

  test('parse tsconfig file using ${configDir} variable to point to the root dir', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('tsconfig.json', {
      include: ['${configDir}/**/*', '${configDir}/.adonisjs/server/**/*'],
    })
    await fs.create('foo.ts', '')

    const result = parseConfig(fs.baseUrl, ts)
    assert.deepEqual(result?.fileNames, [string.toUnixSlash(join(fs.basePath, 'foo.ts'))])
    assert.deepEqual(result?.raw.include, ['**/*', '.adonisjs/server/**/*'])
  })
})
