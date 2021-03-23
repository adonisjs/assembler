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

test.group('Invoke', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('execute instructions defined in package.json file', async (assert) => {
    await fs.add(
      'node_modules/@adonisjs/sample/package.json',
      JSON.stringify({
        name: '@adonisjs/sample',
        adonisjs: {
          env: {
            PORT: '3333',
          },
        },
      })
    )

    const app = new Application(fs.basePath, 'test', {})

    const invoke = new Invoke(app, new Kernel(app))
    invoke.name = '@adonisjs/sample'
    await invoke.run()

    const envFile = await fs.fsExtra.readFile(join(fs.basePath, '.env'), 'utf-8')
    const envExampleFile = await fs.fsExtra.readFile(join(fs.basePath, '.env.example'), 'utf-8')

    assert.equal(envFile.trim(), 'PORT=3333')
    assert.equal(envExampleFile.trim(), 'PORT=3333')
  })
})
