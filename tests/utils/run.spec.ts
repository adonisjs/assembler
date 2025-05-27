/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { pEvent } from 'p-event'
import { test } from '@japa/runner'
import { runNode } from '../../src/utils.js'

test.group('Child process', () => {
  test('run typescript file as a child process', async ({ fs, assert }) => {
    await fs.create(
      'foo.ts',
      `
      process.send('ready')
    `
    )

    const childProcess = runNode(fs.basePath, { script: 'foo.ts', scriptArgs: [], nodeArgs: [] })
    const payload = await pEvent(childProcess, 'message', { rejectionEvents: ['error'] })

    await pEvent(childProcess, 'close', { rejectionEvents: ['error'] })

    assert.equal(childProcess.exitCode, 0)
    assert.equal(payload, 'ready')
  })

  test('pass arguments to the script', async ({ fs, assert }) => {
    await fs.create(
      'foo.ts',
      `
      process.send({ args: process.argv.splice(2) })
    `
    )

    const childProcess = runNode(fs.basePath, {
      script: 'foo.ts',
      scriptArgs: ['--watch', '--foo=bar'],
      nodeArgs: [],
    })
    const payload = await pEvent(childProcess, 'message', { rejectionEvents: ['error'] })
    await pEvent(childProcess, 'close', { rejectionEvents: ['error'] })

    assert.equal(childProcess.exitCode, 0)
    assert.deepEqual(payload, { args: ['--watch', '--foo=bar'] })
  })

  test('pass arguments to node', async ({ assert, fs }) => {
    await fs.create(
      'foo.ts',
      `
      process.send({ args: process.execArgv })
    `
    )

    const childProcess = runNode(fs.basePath, {
      script: 'foo.ts',
      scriptArgs: ['--watch', '--foo=bar'],
      nodeArgs: ['--conditions=dev'],
    })

    const payload = await pEvent(childProcess, 'message', { rejectionEvents: ['error'] })
    await pEvent(childProcess, 'close', { rejectionEvents: ['error'] })

    assert.equal(childProcess.exitCode, 0)
    assert.deepEqual(payload, {
      args: ['--import=@poppinss/ts-exec', '--enable-source-maps', '--conditions=dev'],
    })
  })

  test('wait for child process to finish', async ({ fs, assert }) => {
    await fs.create(
      'foo.ts',
      `
      setTimeout(() => {}, 1000)
    `
    )

    const childProcess = runNode(fs.basePath, { script: 'foo.ts', scriptArgs: [], nodeArgs: [] })
    await pEvent(childProcess, 'close', { rejectionEvents: ['error'] })
    assert.equal(childProcess.exitCode, 0)
  })

  test('get child process exit code', async ({ fs, assert }) => {
    await fs.create(
      'foo.ts',
      `
      throw new Error('Something went wrong')
    `
    )

    const childProcess = runNode(fs.basePath, { script: 'foo.ts', scriptArgs: [], nodeArgs: [] })

    await pEvent(childProcess, 'close', { rejectionEvents: ['error'] })
    assert.equal(childProcess.exitCode, 1)
  })

  test('await and get child process exit code', async ({ fs, assert }) => {
    assert.plan(1)

    await fs.create(
      'foo.ts',
      `
      throw new Error('Something went wrong')
    `
    )

    const childProcess = runNode(fs.basePath, {
      script: 'foo.ts',
      scriptArgs: [],
      nodeArgs: [],
      reject: true,
    })
    try {
      await childProcess
    } catch {
      assert.equal(childProcess.exitCode, 1)
    }
  })
})
