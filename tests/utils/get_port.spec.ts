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
import { getPort } from '../../src/utils.ts'

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

  test('pass HOST from process.env to get-port', async ({ fs, assert, cleanup }) => {
    const originalPort = process.env.PORT
    const originalHost = process.env.HOST
    cleanup(() => {
      if (originalPort === undefined) {
        delete process.env.PORT
      } else {
        process.env.PORT = originalPort
      }
      if (originalHost === undefined) {
        delete process.env.HOST
      } else {
        process.env.HOST = originalHost
      }
    })

    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    process.env.PORT = '4500'
    process.env.HOST = '127.0.0.1'

    assert.equal(await getPort(fs.baseUrl), 4500)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })

  test('pass HOST from .env file to get-port', async ({ fs, assert, cleanup }) => {
    const originalPort = process.env.PORT
    const originalHost = process.env.HOST
    delete process.env.PORT
    delete process.env.HOST
    cleanup(() => {
      if (originalPort === undefined) {
        delete process.env.PORT
      } else {
        process.env.PORT = originalPort
      }
      if (originalHost === undefined) {
        delete process.env.HOST
      } else {
        process.env.HOST = originalHost
      }
    })

    const capturedHosts: Array<string | undefined> = []
    cleanup(mockCreateServer(capturedHosts))

    await fs.create('.env', 'HOST=127.0.0.1\nPORT=4501')

    assert.equal(await getPort(fs.baseUrl), 4501)
    assert.deepEqual(capturedHosts, ['127.0.0.1'])
  })
})
