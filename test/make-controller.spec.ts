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
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application/build/standalone'

import { toNewlineArray } from '../test-helpers'
import MakeController from '../commands/Make/Controller'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Controller', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a controller inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const controller = new MakeController(app)
    controller.name = 'user'
    await controller.handle()

    const UsersController = await fs.get('app/Controllers/Http/UsersController.ts')
    const ControllerTemplate = await templates.get('controller.txt')
    assert.deepEqual(
      toNewlineArray(UsersController),
      toNewlineArray(ControllerTemplate.replace('${filename}', 'UsersController')),
    )
  })

  test('make a resourceful controller inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const controller = new MakeController(app)
    controller.name = 'user'
    controller.resource = true
    await controller.handle()

    const UsersController = await fs.get('app/Controllers/Http/UsersController.ts')
    const ResourceTemplate = await templates.get('resource-controller.txt')
    assert.deepEqual(
      toNewlineArray(UsersController),
      toNewlineArray(ResourceTemplate.replace('${filename}', 'UsersController')),
    )
  })

  test('make a controller inside a custom directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      namespaces: {
        httpControllers: 'App/Controllers',
      },
      autoloads: {
        App: './app',
      },
    }))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const controller = new MakeController(app)
    controller.name = 'user'
    await controller.handle()

    const UsersController = await fs.get('app/Controllers/UsersController.ts')
    const ControllerTemplate = await templates.get('controller.txt')
    assert.deepEqual(
      toNewlineArray(UsersController),
      toNewlineArray(ControllerTemplate.replace('${filename}', 'UsersController')),
    )
  })
})
