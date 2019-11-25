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
import MakeCommand from '../commands/Make/Command'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Command', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a command inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const command = new MakeCommand(app)
    command.name = 'greet'
    await command.handle()

    const GreetCommand = await fs.get('commands/Greet.ts')
    const CommandTemplate = await templates.get('command.txt')
    assert.deepEqual(
      toNewlineArray(GreetCommand),
      toNewlineArray(CommandTemplate.replace('${filename}', 'Greet')),
    )
  })

  test('make a command inside a custom directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      directories: {
        commands: './foo',
      },
    }))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const command = new MakeCommand(app)
    command.name = 'greet'
    await command.handle()

    const GreetCommand = await fs.get('foo/Greet.ts')
    const CommandTemplate = await templates.get('command.txt')
    assert.deepEqual(
      toNewlineArray(GreetCommand),
      toNewlineArray(CommandTemplate.replace('${filename}', 'Greet')),
    )
  })
})
