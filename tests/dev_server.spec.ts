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
import { cliui } from '@poppinss/cliui'
import { relative, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import { DevServer } from '../index.js'

test.group('DevServer', () => {
  test('start() execute onDevServerStarted hook', async ({ fs, cleanup }, done) => {
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
              done()
            },
          }),
        ],
      },
    })

    await devServer.start()
    cleanup(() => devServer.close())
  }).waitForDone()

  test('startAndWatch() execute onDevServerStarted hook', async ({ fs, cleanup }, done) => {
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
              done()
            },
          }),
        ],
      },
    })

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())
  }).waitForDone()

  test('execute onSourceFileChanged hook', async ({ fs, cleanup }, done) => {
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
              done()
            },
          }),
        ],
      },
    })

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())

    await sleep(1000)
    await fs.create('index.ts', 'foo')
  }).waitForDone()

  test('wait for hooks to be registered', async ({ fs, cleanup }, done) => {
    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
      exclude: [],
    })
    await fs.create('bin/server.js', `process.send({ isAdonisJS: true, environment: 'web' })`)
    await fs.create('.env', 'PORT=3334')

    const devServer = new DevServer(fs.baseUrl, {
      assets: { enabled: false },
      nodeArgs: [],
      scriptArgs: [],
      hooks: {
        onDevServerStarted: [
          async () => {
            await sleep(400)
            return {
              default: () => {
                done()
              },
            }
          },
        ],
      },
    })

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())
  })

  test('should restart server if receive hot-hook message', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create(
      'bin/server.js',
      `process.send({ type: 'hot-hook:full-reload', path: '/foo' });`
    )
    await fs.create('.env', 'PORT=3334')

    const { logger } = cliui({ mode: 'raw' })
    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
    }).setLogger(logger)

    await devServer.start()
    await sleep(1000)
    await devServer.close()

    const logMessages = logger.getLogs().map(({ message }) => message)
    assert.isAtLeast(logMessages.filter((message) => message.includes('full-reload')).length, 1)
  })

  test('trigger onDevServerStarted and onSourceFileChanged when hot-hook message is received', async ({
    assert,
    fs,
  }) => {
    let onDevServerStartedCalled = false
    let onSourceFileChangedCalled = false

    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create(
      'bin/server.js',
      `process.send({ type: 'hot-hook:full-reload', path: '/foo' });`
    )
    await fs.create('.env', 'PORT=3334')

    const { logger } = cliui({ mode: 'raw' })
    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
      hooks: {
        onDevServerStarted: [
          async () => ({
            default: () => {
              onDevServerStartedCalled = true
            },
          }),
        ],
        onSourceFileChanged: [
          async () => ({
            default: () => {
              onSourceFileChangedCalled = true
            },
          }),
        ],
      },
    }).setLogger(logger)

    await devServer.start()
    await sleep(1000)
    await devServer.close()

    assert.isTrue(onDevServerStartedCalled)
    assert.isTrue(onSourceFileChangedCalled)
  })

  test('should correctly display a relative path when a hot-hook message is received', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.createJson('package.json', { type: 'module', hotHook: { boundaries: ['./app/**'] } })
    await fs.create('app/controllers/app_controller.ts', 'console.log("foo")')
    await fs.create(
      'bin/server.js',
      `
      import { resolve } from 'path';
      import '../app/controllers/app_controller.js';
      `
    )
    await fs.create('.env', 'PORT=3334')

    const { logger } = cliui({ mode: 'raw' })
    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
    }).setLogger(logger)

    await devServer.start()
    await sleep(2000)
    await fs.create('app/controllers/app_controller.ts', 'console.log("bar")')
    await sleep(2000)
    await devServer.close()

    const logMessages = logger.getLogs().map(({ message }) => message)

    const relativePath = relative(
      fs.basePath,
      resolve(fs.basePath, 'app/controllers/app_controller.ts')
    )

    const expectedMessage = `green(invalidated) ${relativePath}`
    assert.isAtLeast(logMessages.filter((message) => message.includes(expectedMessage)).length, 1)
  }).timeout(10_000)
})
