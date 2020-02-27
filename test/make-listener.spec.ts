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
import MakeListener from '../commands/Make/Listener'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Listener', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a listener inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const listener = new MakeListener(app, new Kernel(app))
    listener.name = 'user'
    await listener.handle()

    const UserListener = await fs.get('app/Listeners/User.ts')
    const ListenerTemplate = await templates.get('event-listener.txt')
    assert.deepEqual(
      toNewlineArray(UserListener),
      toNewlineArray(ListenerTemplate.replace('${filename}', 'User')),
    )
  })

  test('make a listener inside a custom directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      namespaces: {
        eventListeners: 'App/Events/Listeners',
      },
      aliases: {
        App: './app'
      }
    }))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const listener = new MakeListener(app, new Kernel(app))
    listener.name = 'user'
    await listener.handle()

    const UserListener = await fs.get('app/Events/Listeners/User.ts')
    const ListenerTemplate = await templates.get('event-listener.txt')
    assert.deepEqual(
      toNewlineArray(UserListener),
      toNewlineArray(ListenerTemplate.replace('${filename}', 'User')),
    )
  })
})
