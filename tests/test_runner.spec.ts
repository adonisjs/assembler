/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { cliui } from '@poppinss/cliui'

import { TestRunner } from '../index.ts'

test.group('TestRunner', () => {
  test('wait for index regeneration before re-running tests', async ({ fs, assert, cleanup }) => {
    const indexUpdate = Promise.withResolvers<void>()
    const indexUpdateStarted = Promise.withResolvers<void>()
    const testsFinished = Promise.withResolvers<void>()
    const watcherReady = Promise.withResolvers<void>()
    let testRuns = 0

    await fs.createJson('tsconfig.json', { include: ['**/*'], exclude: [] })
    await fs.create('bin/test.ts', '')

    const testRunner = new TestRunner(fs.baseUrl, {
      filters: {},
      nodeArgs: [],
      scriptArgs: [],
      hooks: {
        init: [
          {
            run(_, __, indexGenerator) {
              const addFile = indexGenerator.addFile.bind(indexGenerator)
              indexGenerator.addFile = async (filePath) => {
                indexUpdateStarted.resolve()
                await indexUpdate.promise
                await addFile(filePath)
              }
            },
          },
        ],
        testsStarting: [
          {
            run() {
              testRuns++
            },
          },
        ],
        testsFinished: [
          {
            run() {
              if (testRuns === 2) {
                testsFinished.resolve()
              }
            },
          },
        ],
      },
    })

    testRunner.ui = cliui()
    testRunner.ui.switchMode('raw')
    const logInfo = testRunner.ui.logger.info.bind(testRunner.ui.logger)
    testRunner.ui.logger.info = (...args: Parameters<typeof logInfo>) => {
      if (args[0] === 'watching file system for changes...') {
        watcherReady.resolve()
      }
      logInfo(...args)
    }

    await testRunner.runAndWatch()
    cleanup(() => testRunner.close())
    await watcherReady.promise

    await fs.create('app/controllers/users_controller.ts', 'export default class {}')
    await indexUpdateStarted.promise

    assert.equal(testRuns, 1)

    indexUpdate.resolve()
    await testsFinished.promise
  })
})
