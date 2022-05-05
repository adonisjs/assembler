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
import MakeListener from '../commands/Make/Listener'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Listener', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make a listener inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const listener = new MakeListener(app, new Kernel(app).mockConsoleOutput())
    listener.name = 'user'
    await listener.run()

    const UserListener = await fs.get('app/Listeners/User.ts')
    const ListenerTemplate = await templates.get('event-listener.txt')
    assert.deepEqual(
      toNewlineArray(UserListener),
      toNewlineArray(ListenerTemplate.replace('{{ filename }}', 'User'))
    )
  })

  test('make a listener inside a custom directory', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        namespaces: {
          eventListeners: 'App/Events/Listeners',
        },
        aliases: {
          App: './app',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const listener = new MakeListener(app, new Kernel(app).mockConsoleOutput())
    listener.name = 'user'
    await listener.run()

    const UserListener = await fs.get('app/Events/Listeners/User.ts')
    const ListenerTemplate = await templates.get('event-listener.txt')
    assert.deepEqual(
      toNewlineArray(UserListener),
      toNewlineArray(ListenerTemplate.replace('{{ filename }}', 'User'))
    )
  })
})
