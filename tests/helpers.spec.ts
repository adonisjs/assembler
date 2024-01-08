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
import { getPort, isDotEnvFile, parseConfig } from '../src/helpers.js'

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

test.group('Helpers | Is DotEnv file', () => {
  test('check if file is a dot-env file', ({ assert }) => {
    assert.isTrue(isDotEnvFile('.env'))
    assert.isTrue(isDotEnvFile('.env.prod'))
    assert.isTrue(isDotEnvFile('.env.local'))
    assert.isFalse(isDotEnvFile('.env-file'))
  })
})

test.group('Helpers | getPort', () => {
  test('use port set via process.env.PORT', async ({ fs, assert, cleanup }) => {
    process.env.PORT = '4000'
    cleanup(() => {
      delete process.env.PORT
    })
    assert.equal(await getPort(fs.baseUrl), 4000)
  })

  test('use port from the .env file', async ({ fs, assert }) => {
    await fs.create('.env', 'PORT=3000')
    assert.equal(await getPort(fs.baseUrl), 3000)
  })

  test('give preference to .env.local file', async ({ fs, assert }) => {
    await fs.create('.env', 'PORT=3000')
    await fs.create('.env.local', 'PORT=5000')
    assert.equal(await getPort(fs.baseUrl), 5000)
  })

  test('use port 3333 when no environment variable or files exists', async ({ fs, assert }) => {
    assert.equal(await getPort(fs.baseUrl), 3333)
  })
})
