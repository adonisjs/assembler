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
import { Kernel } from '@adonisjs/ace'
import { readJSONSync } from 'fs-extra'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import { toNewlineArray } from '../test-helpers'
import MakeCommand from '../commands/Make/Command'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Command', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make a command inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const command = new MakeCommand(app, new Kernel(app).mockConsoleOutput())
    command.name = 'greet'
    await command.run()

    const GreetCommand = await fs.get('commands/Greet.ts')
    const CommandTemplate = await templates.get('command.txt')
    assert.deepEqual(
      toNewlineArray(GreetCommand),
      toNewlineArray(
        CommandTemplate.replace('{{ filename }}', 'Greet').replace(
          '{{#toCommandName}}{{ filename }}{{/toCommandName}}',
          'greet'
        )
      )
    )
  })

  test('make a command inside a custom directory', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        directories: {
          commands: './foo',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const command = new MakeCommand(app, new Kernel(app).mockConsoleOutput())
    command.name = 'greet'
    await command.run()

    const GreetCommand = await fs.get('foo/Greet.ts')
    const CommandTemplate = await templates.get('command.txt')
    assert.deepEqual(
      toNewlineArray(GreetCommand),
      toNewlineArray(
        CommandTemplate.replace('{{ filename }}', 'Greet').replace(
          '{{#toCommandName}}{{ filename }}{{/toCommandName}}',
          'greet'
        )
      )
    )
  })

  test('convert camelcase command path to colon seperated name', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        directories: {
          commands: './foo',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const command = new MakeCommand(app, new Kernel(app).mockConsoleOutput())
    command.name = 'RunInstructions'
    await command.run()

    const GreetCommand = await fs.get('foo/RunInstructions.ts')
    const CommandTemplate = await templates.get('command.txt')
    assert.deepEqual(
      toNewlineArray(GreetCommand),
      toNewlineArray(
        CommandTemplate.replace('{{ filename }}', 'RunInstructions').replace(
          '{{#toCommandName}}{{ filename }}{{/toCommandName}}',
          'run:instructions'
        )
      )
    )
  })
})
