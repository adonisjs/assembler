/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join } from 'node:path/posix'
import { cliui } from '@poppinss/cliui'
import { setTimeout as sleep } from 'node:timers/promises'
import { RuntimeException } from '@poppinss/utils/exception'

import { DevServer } from '../index.ts'
import { normalizePathForWindows, setupFakeAdonisproject, waitForLogsCount } from './helpers.ts'

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

    await devServer.start()
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

    await devServer.startAndWatch()
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

    await devServer.startAndWatch()
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
    devServer.start()
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
      `process.send({ type: 'hot-hook:invalidated', paths: ['${normalizePathForWindows(join(fs.basePath, 'start/routes.ts'))}'] });`
    )
    await fs.create('start/routes.ts', ``)
    await fs.create('.env', 'PORT=3338')

    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
    })

    devServer.ui.switchMode('raw')
    devServer.start()
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
    devServer.start()
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

    await devServer.startAndWatch()
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
      `
        process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })
        const keepAlive = setInterval(() => {}, 5000)
      `
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

    await devServer.start()
    cleanup(() => devServer.close())

    const indexFilter = ({ message }: { message: string }) =>
      message.includes('.adonisjs/server/controllers.ts')
    const watcherReadyFilter = ({ message }: { message: string }) =>
      message.includes('watching file system for changes')

    assert.snapshot(await fs.contents('.adonisjs/server/controllers.ts')).matchInline(`
      "export const controllers = {}
      "
    `)

    await waitForLogsCount({ devServer, filter: watcherReadyFilter, count: 1 })

    await fs.create('app/controllers/users_controller.ts', 'foo')
    await waitForLogsCount({ devServer, filter: indexFilter, count: 2 })

    await fs.create('app/controllers/posts_controller.ts', 'bar')
    await waitForLogsCount({ devServer, filter: indexFilter, count: 3 })

    await fs.create('app/models/user.ts', 'bar')
    await fs.create('app/models/post.ts', 'bar')

    await sleep(500)

    const logs = devServer.ui.logger.getLogs()
    const indexGenerationLogs = logs.filter(indexFilter)
    assert.lengthOf(indexGenerationLogs, 3)
  }).timeout(15 * 1000)

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

    await devServer.startAndWatch()
    cleanup(() => devServer.close())

    const indexFilter = ({ message }: { message: string }) =>
      message.includes('.adonisjs/server/controllers.ts')
    const watcherReadyFilter = ({ message }: { message: string }) =>
      message.includes('watching file system for changes')

    assert.snapshot(await fs.contents('.adonisjs/server/controllers.ts')).matchInline(`
      "export const controllers = {}
      "
    `)

    await waitForLogsCount({ devServer, filter: watcherReadyFilter, count: 1 })

    await fs.create('app/controllers/users_controller.ts', 'foo')
    await waitForLogsCount({ devServer, filter: indexFilter, count: 2 })

    await fs.create('app/controllers/posts_controller.ts', 'bar')
    await waitForLogsCount({ devServer, filter: indexFilter, count: 3 })

    await fs.create('app/models/user.ts', 'bar')
    await fs.create('app/models/post.ts', 'bar')

    await sleep(500)

    const logs = devServer.ui.logger.getLogs()
    const indexGenerationLogs = logs.filter(indexFilter)
    assert.lengthOf(indexGenerationLogs, 3)
  }).timeout(15 * 1000)

  test('restart server on file change when child process has crashed in hmr mode', async ({
    fs,
    assert,
    cleanup,
  }) => {
    /**
     * Create a server that crashes immediately after sending ready message
     */
    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create(
      'bin/server.ts',
      `
        process.send({ isAdonisJS: true, environment: 'web', port: process.env.PORT, host: 'localhost' })
        setTimeout(() => { throw new Error('crash') }, 100)
      `
    )
    await fs.create('app/controllers/home_controller.ts', 'export default class {}')
    await fs.create('.env', 'PORT=3350')

    const devServer = new DevServer(fs.baseUrl, {
      hmr: true,
      nodeArgs: [],
      scriptArgs: [],
      clearScreen: false,
    })

    devServer.ui = cliui()
    devServer.ui.switchMode('raw')

    await devServer.start()
    cleanup(() => devServer.close())

    /**
     * Wait for the server to crash
     */
    await sleep(500)

    /**
     * Modify a file, should trigger a restart since the child is dead
     */
    await fs.create('app/controllers/home_controller.ts', 'export default class { foo() {} }')

    await sleep(1000)

    const logMessages = devServer.ui.logger.getLogs().map(({ message }) => message)
    console.log(logMessages)

    assert.snapshot(logMessages).matchInline(`
      [
        "[ blue(info) ] starting server in hmr mode...",
        "[ blue(info) ] loading hooks...",
        "[ blue(info) ] generating indexes...",
        "[ blue(info) ] starting HTTP server...",
        "Server address: cyan(http://localhost:3350)
      Mode: cyan(hmr)
      Press dim(h) to show help",
        "[ blue(info) ] watching file system for changes...",
        "[ blue(info) ] Underlying HTTP server died. Still watching for changes",
        "green(update) app/controllers/home_controller.ts",
        "Server address: cyan(http://localhost:3350)
      Mode: cyan(hmr)
      Press dim(h) to show help",
        "[ blue(info) ] Underlying HTTP server died. Still watching for changes",
      ]
    `)
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

    await devServer.start()
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
