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
import { join } from 'node:path/posix'
import { cliui } from '@poppinss/cliui'
import { setTimeout as sleep } from 'node:timers/promises'
import { RuntimeException } from '@poppinss/utils/exception'

import { DevServer } from '../index.ts'
import { normalizePathForWindows, setupFakeAdonisproject } from './helpers.ts'

test.group('DevServer', () => {
  test('start in static mode and execute hooks', async ({ fs, assert, cleanup }) => {
    let hooksStack: string[] = []

    await fs.createJson('tsconfig.json', {
      extends: '@adonisjs/tsconfig/tsconfig.package.json',
      compilerOptions: {
        rootDir: './',
        outDir: './build',
      },
    })
    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3334')

    const devServer = new DevServer(fs.baseUrl, {
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        init: [
          async () => {
            return {
              default: () => {
                hooksStack.push('init')
              },
            }
          },
        ],
        devServerStarted: [
          async () => ({
            default: () => {
              hooksStack.push('devServerStarted')
            },
          }),
        ],
        devServerStarting: [
          async () => ({
            default: () => {
              hooksStack.push('devServerStarting')
            },
          }),
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.start(ts)
    cleanup(async () => devServer.close())

    assert.deepEqual(devServer.ui.logger.getLogs(), [
      {
        message: '[ blue(info) ] starting server in static mode...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] loading hooks...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] generating indexes...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] starting HTTP server...',
        stream: 'stdout',
      },
      {
        message:
          'Server address: cyan(http://localhost:3334)\nMode: cyan(static)\nPress dim(h) to show help',
        stream: 'stdout',
      },
    ])
    assert.deepEqual(hooksStack, ['init', 'devServerStarting', 'devServerStarted'])
  })

  test('start in watch mode and execute hook', async ({ fs, assert, cleanup }) => {
    let hooksStack: string[] = []

    await fs.createJson('tsconfig.json', {
      extends: '@adonisjs/tsconfig/tsconfig.package.json',
      compilerOptions: {
        rootDir: './',
        outDir: './build',
      },
    })
    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3335')

    const devServer = new DevServer(fs.baseUrl, {
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        init: [
          async () => ({
            default: () => {
              hooksStack.push('init')
            },
          }),
        ],
        devServerStarted: [
          async () => ({
            default: () => {
              hooksStack.push('devServerStarted')
            },
          }),
        ],
        devServerStarting: [
          async () => ({
            default: () => {
              hooksStack.push('devServerStarting')
            },
          }),
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())

    assert.deepEqual(devServer.ui.logger.getLogs(), [
      {
        message: '[ blue(info) ] starting server in watch mode...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] loading hooks...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] generating indexes...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] starting HTTP server...',
        stream: 'stdout',
      },
      {
        message:
          'Server address: cyan(http://localhost:3335)\nMode: cyan(watch)\nPress dim(h) to show help',
        stream: 'stdout',
      },
    ])
    assert.deepEqual(hooksStack, ['init', 'devServerStarting', 'devServerStarted'])
  })

  test('execute file watcher hooks', async ({ fs, assert, cleanup }) => {
    let hooksStack: string[] = []

    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
      exclude: [],
    })
    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3336')

    const devServer = new DevServer(fs.baseUrl, {
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        fileAdded: [
          async () => ({
            default: (filePath) => {
              hooksStack.push(`${filePath} added`)
            },
          }),
        ],
        fileChanged: [
          async () => ({
            default: (filePath) => {
              hooksStack.push(`${filePath} changed`)
            },
          }),
        ],
        fileRemoved: [
          async () => ({
            default: (filePath) => {
              hooksStack.push(`${filePath} removed`)
            },
          }),
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())

    await sleep(1000)
    await fs.create('src/index.ts', 'foo')

    await sleep(1000)
    await fs.create('src/index.ts', 'bar')

    await sleep(1000)
    await fs.remove('src/index.ts')

    await sleep(1000)
    const logs = devServer.ui.logger.getLogs()

    assert.includeDeepMembers(logs, [
      {
        message: 'green(add) src/index.ts',
        stream: 'stdout',
      },
      {
        message: 'green(update) src/index.ts',
        stream: 'stdout',
      },
      {
        message: 'green(delete) src/index.ts',
        stream: 'stdout',
      },
    ])
    assert.deepEqual(hooksStack, [
      'src/index.ts added',
      'src/index.ts changed',
      'src/index.ts removed',
    ])
  }).timeout(8 * 1000)

  test('restart server if hot-hook:full-reload message is received', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create(
      'bin/server.ts',
      `process.send({ type: 'hot-hook:full-reload', path: '${normalizePathForWindows(join(fs.basePath, 'start/routes.ts'))}' });`
    )
    await fs.dump('bin/server.ts')
    await fs.create('start/routes.ts', ``)
    await fs.create('.env', 'PORT=3337')

    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
    })

    devServer.ui.switchMode('raw')
    devServer.start(ts)
    await sleep(1000)

    await devServer.close()

    const logMessages = devServer.ui.logger.getLogs().map(({ message }) => message)
    assert.isAtLeast(
      logMessages.filter((message) => message.includes('green(update) start/routes.ts')).length,
      1
    )
  }).disableTimeout()

  test('do not restart server when hot-hook:invalidated message is received', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create(
      'bin/server.ts',
      `process.send({ type: 'hot-hook:invalidated', path: '${normalizePathForWindows(join(fs.basePath, 'start/routes.ts'))}' });`
    )
    await fs.create('start/routes.ts', ``)
    await fs.create('.env', 'PORT=3338')

    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
    })

    devServer.ui.switchMode('raw')
    devServer.start(ts)
    await sleep(1000)

    await devServer.close()

    const logMessages = devServer.ui.logger.getLogs().map(({ message }) => message)
    assert.isAtLeast(
      logMessages.filter((message) => message.includes('green(invalidated) start/routes.ts'))
        .length,
      1
    )
  }).disableTimeout()

  test('handle hot-hook:file-changed event', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create(
      'bin/server.ts',
      `process.send({ type: 'hot-hook:file-changed', action: 'change', path: '${normalizePathForWindows(join(fs.basePath, 'start/routes.ts'))}' });`
    )
    await fs.create('start/routes.ts', ``)
    await fs.create('.env', 'PORT=3339')

    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
    })

    devServer.ui.switchMode('raw')
    devServer.start(ts)
    await sleep(1000)

    await devServer.close()

    /**
     * Do not restart server or notify about file changes in HMR mode
     * when it is not an invalidated or full-reload instruction
     */
    const logMessages = devServer.ui.logger.getLogs().map(({ message }) => message)
    assert.equal(
      logMessages.filter((message) => message.includes('green(update) start/routes.ts')).length,
      0
    )
  }).disableTimeout()

  test('return error when tsconfig file is missing', async ({ fs, assert, cleanup }) => {
    let hooksStack: string[] = []
    let error: any

    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3335')

    const devServer = new DevServer(fs.baseUrl, {
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        devServerStarted: [
          async () => ({
            default: () => {
              hooksStack.push('devServerStarted')
            },
          }),
        ],
        devServerStarting: [
          async () => ({
            default: () => {
              hooksStack.push('devServerStarting')
            },
          }),
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    devServer.onError((startError) => {
      error = startError
    })

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())

    assert.instanceOf(error, RuntimeException)
    assert.deepEqual(devServer.ui.logger.getLogs(), [])
    assert.deepEqual(hooksStack, [])
  })

  test('regenerate index file on related file changes in hmr mode', async ({
    fs,
    assert,
    cleanup,
  }) => {
    await setupFakeAdonisproject(fs)

    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3340')

    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        init: [
          async () => ({
            default: (_, indexGenerator) => {
              indexGenerator.add('controllers', {
                as: 'barrelFile',
                output: '.adonisjs/server/controllers.ts',
                exportName: 'controllers',
                source: 'app/controllers',
                importAlias: '#controllers',
              })
            },
          }),
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.start(ts)
    cleanup(() => devServer.close())

    assert.snapshot(await fs.contents('.adonisjs/server/controllers.ts')).matchInline(`
      "export const controllers = {
      }"
    `)

    await sleep(1000)
    await fs.create('app/controllers/users_controller.ts', 'foo')

    await sleep(1000)
    await fs.create('app/controllers/posts_controller.ts', 'bar')

    await sleep(1000)
    await fs.create('app/models/user.ts', 'bar')

    await sleep(1000)
    await fs.create('app/models/post.ts', 'bar')

    await sleep(1000)
    const logs = devServer.ui.logger.getLogs()

    const indexGenerationLogs = logs.filter(({ message }) =>
      message.includes('.adonisjs/server/controllers.ts')
    )
    assert.lengthOf(indexGenerationLogs, 3)
  }).timeout(10 * 1000)

  test('regenerate index file on related file changes in watch mode', async ({
    fs,
    assert,
    cleanup,
  }) => {
    await setupFakeAdonisproject(fs)

    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3341')

    const devServer = new DevServer(fs.baseUrl, {
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        init: [
          async () => ({
            default: (_, indexGenerator) => {
              indexGenerator.add('controllers', {
                as: 'barrelFile',
                output: '.adonisjs/server/controllers.ts',
                exportName: 'controllers',
                source: 'app/controllers',
                importAlias: '#controllers',
              })
            },
          }),
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.startAndWatch(ts)
    cleanup(() => devServer.close())

    assert.snapshot(await fs.contents('.adonisjs/server/controllers.ts')).matchInline(`
      "export const controllers = {
      }"
    `)

    await sleep(1000)
    await fs.create('app/controllers/users_controller.ts', 'foo')

    await sleep(1000)
    await fs.create('app/controllers/posts_controller.ts', 'bar')

    await sleep(1000)
    await fs.create('app/models/user.ts', 'bar')

    await sleep(1000)
    await fs.create('app/models/post.ts', 'bar')

    await sleep(1000)
    const logs = devServer.ui.logger.getLogs()

    console.log(logs)
    const indexGenerationLogs = logs.filter(({ message }) =>
      message.includes('.adonisjs/server/controllers.ts')
    )
    assert.lengthOf(indexGenerationLogs, 3)
  }).timeout(10 * 1000)

  test('define hooks as inline functions', async ({ fs, assert, cleanup }) => {
    let hooksStack: string[] = []

    await fs.createJson('tsconfig.json', {
      extends: '@adonisjs/tsconfig/tsconfig.package.json',
      compilerOptions: {
        rootDir: './',
        outDir: './build',
      },
    })
    await fs.create(
      'bin/server.ts',
      `process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })`
    )
    await fs.create('.env', 'PORT=3342')

    const devServer = new DevServer(fs.baseUrl, {
      nodeArgs: [],
      scriptArgs: [],
      metaFiles: [],
      suites: [],
      hooks: {
        init: [
          {
            run() {
              hooksStack.push('init')
            },
          },
        ],
        devServerStarted: [
          {
            run() {
              hooksStack.push('devServerStarted')
            },
          },
        ],
        devServerStarting: [
          {
            run() {
              hooksStack.push('devServerStarting')
            },
          },
        ],
      },
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.start(ts)
    cleanup(async () => devServer.close())

    assert.deepEqual(devServer.ui.logger.getLogs(), [
      {
        message: '[ blue(info) ] starting server in static mode...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] loading hooks...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] generating indexes...',
        stream: 'stdout',
      },
      {
        message: '[ blue(info) ] starting HTTP server...',
        stream: 'stdout',
      },
      {
        message:
          'Server address: cyan(http://localhost:3342)\nMode: cyan(static)\nPress dim(h) to show help',
        stream: 'stdout',
      },
    ])
    assert.deepEqual(hooksStack, ['init', 'devServerStarting', 'devServerStarted'])
  })
})
