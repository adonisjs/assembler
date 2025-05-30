/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { getPort } from '../../src/utils.ts'

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
    await fs.create('.env.local', 'PORT=4333')
    assert.equal(await getPort(fs.baseUrl), 4333)
  })

  test('use port 3333 when no environment variable or files exists', async ({ fs, assert }) => {
    assert.equal(await getPort(fs.baseUrl), 3333)
  })
})
