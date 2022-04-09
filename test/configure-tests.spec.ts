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
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import Invoke from '../commands/Invoke'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('Configure Tests', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test
    .skipInCI('setup tests', async (assert) => {
      await fs.add(
        'package.json',
        JSON.stringify({
          name: 'sample_app',
        })
      )

      await fs.ensureRoot()
      const app = new Application(fs.basePath, 'test', {})

      const invoke = new Invoke(app, new Kernel(app).mockConsoleOutput())
      invoke.packages = ['tests']
      await invoke.run()

      assert.isTrue(await fs.fsExtra.pathExists(join(fs.basePath, 'test.ts')))
      assert.isTrue(await fs.fsExtra.pathExists(join(fs.basePath, 'tests/bootstrap.ts')))
      assert.isTrue(
        await fs.fsExtra.pathExists(join(fs.basePath, 'tests/functional/hello_world.spec.ts'))
      )
      assert.isTrue(await fs.fsExtra.pathExists(join(fs.basePath, 'contracts/tests.ts')))
    })
    .timeout(0)
})
