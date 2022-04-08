/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { join } from 'path'
import { readJSONSync } from 'fs-extra'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import MakeTest from '../commands/Make/Test'
import { toNewlineArray } from '../test-helpers'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Test', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a test inside the suite directory', async (assert) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        tests: {
          suites: [{ name: 'functional', files: ['tests/functional/**/*.spec.ts'] }],
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const makeTest = new MakeTest(app, new Kernel(app).mockConsoleOutput())
    makeTest.suite = 'functional'
    makeTest.name = 'Users'
    await makeTest.run()

    const testFile = await fs.get('tests/functional/user.spec.ts')
    const testTemplate = await templates.get('test.txt')
    assert.deepEqual(
      toNewlineArray(testFile),
      toNewlineArray(testTemplate.replace('{{ name }}', 'Users'))
    )
  })

  test('make a test inside nested directory', async (assert) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        tests: {
          suites: [{ name: 'functional', files: ['tests/functional/**/*.spec.ts'] }],
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const makeTest = new MakeTest(app, new Kernel(app))
    makeTest.suite = 'functional'
    makeTest.name = 'Users/index'
    await makeTest.run()

    const testFile = await fs.get('tests/functional/users/index.spec.ts')
    const testTemplate = await templates.get('test.txt')
    assert.deepEqual(
      toNewlineArray(testFile),
      toNewlineArray(testTemplate.replace('{{ name }}', 'Users index'))
    )
  })

  test('return error when suite is not registered', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const makeTest = new MakeTest(app, new Kernel(app).mockConsoleOutput())
    makeTest.suite = 'functional'
    makeTest.name = 'Users/index'
    await makeTest.run()

    assert.deepEqual(makeTest.ui.testingRenderer.logs, [
      {
        stream: 'stderr',
        message:
          '[ red(error) ]  Invalid suite "functional". Make sure the suite is registered inside the .adonisrc.json file',
      },
    ])

    assert.isFalse(await fs.exists('tests/functional/users/index.spec.ts'))
  })
})
