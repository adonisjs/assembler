/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join } from 'path'
import { readJSONSync } from 'fs-extra'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import { toNewlineArray } from '../test-helpers'
import MakeController from '../commands/Make/Controller'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Controller', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make a controller inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const controller = new MakeController(app, new Kernel(app).mockConsoleOutput())
    controller.name = 'user'
    await controller.run()

    const UsersController = await fs.get('app/Controllers/Http/UsersController.ts')
    const ControllerTemplate = await templates.get('controller.txt')
    assert.deepEqual(
      toNewlineArray(UsersController),
      toNewlineArray(ControllerTemplate.replace('{{ filename }}', 'UsersController'))
    )
  })

  test('make a resourceful controller inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const controller = new MakeController(app, new Kernel(app).mockConsoleOutput())
    controller.name = 'user'
    controller.resource = true
    await controller.run()

    const UsersController = await fs.get('app/Controllers/Http/UsersController.ts')
    const ResourceTemplate = await templates.get('resource-controller.txt')
    assert.deepEqual(
      toNewlineArray(UsersController),
      toNewlineArray(ResourceTemplate.replace('{{ filename }}', 'UsersController'))
    )
  })

  test('make a controller inside a custom directory', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        namespaces: {
          httpControllers: 'App/Controllers',
        },
        autoloads: {
          App: './app',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const controller = new MakeController(app, new Kernel(app).mockConsoleOutput())
    controller.name = 'user'
    await controller.run()

    const UsersController = await fs.get('app/Controllers/UsersController.ts')
    const ControllerTemplate = await templates.get('controller.txt')
    assert.deepEqual(
      toNewlineArray(UsersController),
      toNewlineArray(ControllerTemplate.replace('{{ filename }}', 'UsersController'))
    )
  })
})
