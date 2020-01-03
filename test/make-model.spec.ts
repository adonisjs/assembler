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
import { Ioc } from '@adonisjs/fold'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application/build/standalone'

import { toNewlineArray } from '../test-helpers'
import MakeModel from '../commands/Make/Model'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Model', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a model inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const model = new MakeModel(app, new Kernel(app))
    model.name = 'user'
    await model.handle()

    const UserModel = await fs.get('app/Models/User.ts')
    const ModelTemplate = await templates.get('model.txt')
    assert.deepEqual(
      toNewlineArray(UserModel),
      toNewlineArray(ModelTemplate.replace('${filename}', 'User')),
    )
  })

  test('make a model inside a custom directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      namespaces: {
        models: 'App',
      },
      autoloads: {
        App: './app',
      },
    }))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const model = new MakeModel(app, new Kernel(app))
    model.name = 'user'
    await model.handle()

    const UserModel = await fs.get('app/User.ts')
    const ModelTemplate = await templates.get('model.txt')
    assert.deepEqual(
      toNewlineArray(UserModel),
      toNewlineArray(ModelTemplate.replace('${filename}', 'User')),
    )
  })
})
