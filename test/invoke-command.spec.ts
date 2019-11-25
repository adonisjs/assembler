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
import { Filesystem } from '@poppinss/dev-utils'
import { Ioc } from '@adonisjs/fold'
import { Application } from '@adonisjs/application/build/standalone'

import Invoke from '../commands/Invoke'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('Invoke', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('return with error when not ADONIS_ACE_CWD is not defined', async (assert) => {
    const app = new Application(fs.basePath, new Ioc(), {}, {})
    app.environment = 'test'

    const invoke = new Invoke(app)
    await invoke.handle()

    assert.deepEqual(invoke.logger.logs, ['underline(red(error)) Cannot invoke post install instructions. Make sure you running this command as "node ace invoke"'])
  })

  test('execute instructions defined in package.json file', async (assert) => {
    process.env.ADONIS_ACE_CWD = fs.basePath

    await fs.add('node_modules/@adonisjs/sample/package.json', JSON.stringify({
      name: '@adonisjs/sample',
      adonisjs: {
        env: {
          'PORT': '3333',
        },
      },
    }))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const invoke = new Invoke(app)
    invoke.name = '@adonisjs/sample'
    await invoke.handle()

    const envFile = await fs.fsExtra.readFile(join(fs.basePath, '.env'), 'utf-8')
    const envExampleFile = await fs.fsExtra.readFile(join(fs.basePath, '.env.example'), 'utf-8')

    assert.equal(envFile.trim(), 'PORT=3333')
    assert.equal(envExampleFile.trim(), 'PORT=')
  })
})
