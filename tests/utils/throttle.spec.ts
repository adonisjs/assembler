/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { throttle } from '../../src/utils.ts'

test.group('Throttle', () => {
  test('throttle function calls', async ({ assert }) => {
    const counters: number[] = []

    const timeConsumingFn = throttle((counter: number) => {
      return new Promise((resolve) => {
        counters.push(counter)
        setTimeout(resolve, 3000)
      })
    })

    await Promise.all(new Array(10).fill('a').map((_, index) => timeConsumingFn(index)))
    assert.deepEqual(counters, [0, 9])
  }).disableTimeout()

  test('continues with the queued call when the active call rejects', async ({ assert }) => {
    const calls: number[] = []
    let rejectActiveCall: (error: Error) => void = () => {}
    const activeCallError = new Error('Active call failed')

    const throttled = throttle((call: number) => {
      calls.push(call)

      if (call === 1) {
        return new Promise<void>((_, reject) => {
          rejectActiveCall = reject
        })
      }

      return Promise.resolve()
    })

    const activeCall = throttled(1)
    await throttled(2)
    rejectActiveCall(activeCallError)

    await assert.rejects(() => activeCall, 'Active call failed')
    assert.deepEqual(calls, [1, 2])

    await throttled(3)
    assert.deepEqual(calls, [1, 2, 3])
  })

  test('without throttle', async ({ assert }) => {
    let callsCount = 0

    const timeConsumingFn = () => {
      return new Promise((resolve) => {
        callsCount++
        setTimeout(resolve, 3000)
      })
    }

    await Promise.all(new Array(10).fill('a').map(() => timeConsumingFn()))
    assert.equal(callsCount, 10)
  }).disableTimeout()
})
