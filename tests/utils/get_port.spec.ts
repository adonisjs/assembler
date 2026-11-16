/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import net from 'node:net'
import { test } from '@japa/runner'
import { clearLockedPorts } from 'get-port'
import { getPort } from '../../src/utils.ts'

/**
 * Replaces "net.createServer" with a fake server that accepts each
 * port, and records the host of each "listen" call made by "get-port".
 * Returns a function to restore "net.createServer".
 */
function mockCreateServer(capturedHosts: Array<string | undefined>) {
  const originalCreateServer = net.createServer
  const mockedCreateServer = () => {
    let listenOptions: { port?: number; host?: string } = {}
    const fakeServer: any = {
      unref() {
        return this
      },
      on() {
        return this
      },
      listen(options: any, callback?: () => void) {
        if (options && typeof options === 'object') {
          listenOptions = options
          capturedHosts.push(options.host)
        }
        if (typeof callback === 'function') {
          process.nextTick(callback)
        }
        return this
      },
      address() {
        return { port: listenOptions.port }
      },
      close(callback?: () => void) {
        if (typeof callback === 'function') {
          process.nextTick(callback)
        }
        return this
      },
    }
    return fakeServer
  }
  ;(net as any).createServer = mockedCreateServer
  return () => {
    ;(net as any).createServer = originalCreateServer
  }
}

test.group('Helpers | getPort', (group) => {
  group.each.setup(() => {
    const originalPort = process.env.PORT
    const originalHost = process.env.HOST
    delete process.env.PORT
    delete process.env.HOST
    clearLockedPorts()

    return () => {
      delete process.env.PORT
      delete process.env.HOST
      if (originalPort !== undefined) {
        process.env.PORT = originalPort
      }
      if (originalHost !== undefined) {
        process.env.HOST = originalHost
      }
    }
  })

  test('use port set via process.env.PORT', async ({ fs, assert }) => {
    process.env.PORT = '4000'
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

  test('pass HOST from process.env to get-port', async ({ fs, assert, cleanup }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    process.env.PORT = '4500'
    process.env.HOST = '127.0.0.1'

    assert.equal(await getPort(fs.baseUrl), 4500)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('pass HOST from .env file to get-port', async ({ fs, assert, cleanup }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    await fs.create('.env', 'HOST=127.0.0.1\nPORT=4501')

    assert.equal(await getPort(fs.baseUrl), 4501)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('pass HOST from process.env when PORT comes from .env file', async ({
    fs,
    assert,
    cleanup,
  }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    process.env.HOST = '127.0.0.1'
    await fs.create('.env', 'PORT=4502')

    assert.equal(await getPort(fs.baseUrl), 4502)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('pass HOST from .env file when PORT comes from process.env', async ({
    fs,
    assert,
    cleanup,
  }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    process.env.PORT = '4503'
    await fs.create('.env', 'HOST=127.0.0.1')

    assert.equal(await getPort(fs.baseUrl), 4503)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('give preference to HOST from process.env over .env file', async ({
    fs,
    assert,
    cleanup,
  }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    process.env.HOST = '127.0.0.1'
    await fs.create('.env', 'HOST=0.0.0.0\nPORT=4504')

    assert.equal(await getPort(fs.baseUrl), 4504)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('give preference to HOST from .env.local file over .env file', async ({
    fs,
    assert,
    cleanup,
  }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    await fs.create('.env', 'HOST=0.0.0.0\nPORT=4505')
    await fs.create('.env.local', 'HOST=127.0.0.1')

    assert.equal(await getPort(fs.baseUrl), 4505)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('pass HOST to get-port when using the default port 3333', async ({
    fs,
    assert,
    cleanup,
  }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    process.env.HOST = '127.0.0.1'

    assert.equal(await getPort(fs.baseUrl), 3333)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('check the port on all the local hosts when HOST is not set', async ({
    fs,
    assert,
    cleanup,
  }) => {
    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    await fs.create('.env', 'PORT=4506')

    /**
     * With no host, get-port checks the default host first, then
     * "0.0.0.0", then each address of the network interfaces
     */
    assert.equal(await getPort(fs.baseUrl), 4506)
    assert.deepEqual(capturedHosts.slice(0, 2), [undefined, '0.0.0.0'])
  })
})
