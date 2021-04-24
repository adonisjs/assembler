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

test.group('Configure Encore', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test
    .skipInCI('setup encore', async (assert) => {
      await fs.add(
        'package.json',
        JSON.stringify({
          name: 'sample_app',
        })
      )

      await fs.ensureRoot()
      const app = new Application(fs.basePath, 'test', {})

      const invoke = new Invoke(app, new Kernel(app))
      invoke.name = 'encore'
      await invoke.run()

      const envFile = await fs.fsExtra.pathExists(join(fs.basePath, 'webpack.config.js'))
      const envExampleFile = await fs.fsExtra.readFile(
        join(fs.basePath, 'resources/js/app.js'),
        'utf-8'
      )

      assert.isTrue(envFile)
      assert.equal(envExampleFile.trim(), '// app entrypoint')
    })
    .timeout(0)
})
