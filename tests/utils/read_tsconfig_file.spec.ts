/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import string from '@poppinss/utils/string'
import { readTsConfig } from '../../src/utils.ts'

test.group('Helpers | Read TSConfig', () => {
  test('return null when file is missing', async ({ fs, assert }) => {
    assert.isNull(readTsConfig(string.toUnixSlash(fs.basePath)))
  })

  test('read tsconfig file', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
    })
    await fs.create('foo.ts', '')

    const result = readTsConfig(string.toUnixSlash(fs.basePath))!
    assert.deepEqual(result.config.include, ['**/*'])
  })

  test('parse tsconfig file using ${configDir} variable to point to the root dir', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('tsconfig.json', {
      include: ['${configDir}/**/*', '${configDir}/.adonisjs/server/**/*'],
    })
    await fs.create('foo.ts', '')

    const result = readTsConfig(string.toUnixSlash(fs.basePath))!
    assert.deepEqual(result.config.include, ['**/*', '.adonisjs/server/**/*'])
  })
})
