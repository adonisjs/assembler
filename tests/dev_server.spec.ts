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
import { DevServer } from '../index.js'
import { setTimeout as sleep } from 'node:timers/promises'

test.group('DevServer', () => {
  test('start() execute onDevServerStarted hook', async ({ assert, fs, cleanup }) => {
    assert.plan(1)

    await fs.create('bin/server.js', `process.send({ isAdonisJS: true, environment: 'web' })`)
    await fs.create('.env', 'PORT=3334')

    const devServer = new DevServer(fs.baseUrl, {
      assets: {
        enabled: false,
      },
      nodeArgs: [],
      scriptArgs: [],
      hooks: {
        onDevServerStarted: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
      },
    })

    await devServer.start()
    cleanup(() => devServer.close())
    await sleep(600)
  })

  test('startAndWatch() execute onDevServerStarted hook', async ({ assert, fs, cleanup }) => {
    assert.plan(1)

    await fs.create('bin/server.js', `process.send({ isAdonisJS: true, environment: 'web' })`)
    await fs.create('.env', 'PORT=3334')

    const devServer = new DevServer(fs.baseUrl, {
      assets: {
        enabled: false,
      },
      nodeArgs: [],
      scriptArgs: [],
      hooks: {
        onDevServerStarted: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
      },
    })

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())
    await sleep(600)
  })

  test('execute onSourceFileChanged hook', async ({ assert, fs, cleanup }) => {
    assert.plan(1)

    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
      exclude: [],
    })
    await fs.create('index.ts', 'console.log("hey")')
    await fs.create('bin/server.js', `process.send({ isAdonisJS: true, environment: 'web' })`)
    await fs.create('.env', 'PORT=3334')

    const devServer = new DevServer(fs.baseUrl, {
      assets: { enabled: false },
      nodeArgs: [],
      scriptArgs: [],
      hooks: {
        onSourceFileChanged: [
          async () => ({
            default: () => {
              assert.isTrue(true)
            },
          }),
        ],
      },
    })

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())

    await sleep(100)
    await fs.create('index.ts', 'foo')
    await sleep(10)
  })
})
