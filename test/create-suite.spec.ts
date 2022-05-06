/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join } from 'path'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'
import { files } from '@adonisjs/sink'
import CreateSuite from '../commands/Make/Suite'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('CreateSuite', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('Should add suite to RcFile and create sample test', async ({ assert }) => {
    await fs.ensureRoot()
    const app = new Application(fs.basePath, 'test', {})
    const suiteName = 'my-super-suite'
    const createSuite = new CreateSuite(app, new Kernel(app).mockConsoleOutput())

    createSuite.suite = suiteName
    await createSuite.run()

    const sampleTestExist = fs.fsExtra.pathExistsSync(
      join(fs.basePath, `tests/${suiteName}/test.spec.ts`)
    )
    assert.isTrue(sampleTestExist)

    const rcFile = new files.AdonisRcFile(fs.basePath)
    assert.deepEqual(rcFile.get('tests.suites'), [
      {
        name: suiteName,
        files: [`tests/${suiteName}/**/*.spec(.ts|.js)`],
        timeout: 60000,
      },
    ])
  })

  test("Shouldn't add suite to RcFile if it already exists", async ({ assert }) => {
    await fs.ensureRoot()
    const app = new Application(fs.basePath, 'test', {})
    const suiteName = 'my-super-suite'
    const createSuite = new CreateSuite(app, new Kernel(app).mockConsoleOutput())

    createSuite.suite = suiteName
    await createSuite.run()
    await createSuite.run()
    await createSuite.run()

    const rcFile = new files.AdonisRcFile(fs.basePath)
    assert.deepEqual(rcFile.get('tests.suites'), [
      {
        name: suiteName,
        files: [`tests/${suiteName}/**/*.spec(.ts|.js)`],
        timeout: 60000,
      },
    ])
  })

  test("Shouldn't add a sample file if specified", async ({ assert }) => {
    await fs.ensureRoot()
    const app = new Application(fs.basePath, 'test', {})

    const suiteName = 'my-super-suite'
    const createSuite = new CreateSuite(app, new Kernel(app).mockConsoleOutput())

    createSuite.suite = suiteName
    createSuite.withExampleTest = false
    await createSuite.run()

    const sampleTestExist = fs.fsExtra.pathExistsSync(
      join(fs.basePath, `tests/${suiteName}/test.spec.ts`)
    )

    assert.isFalse(sampleTestExist)
  })
})
