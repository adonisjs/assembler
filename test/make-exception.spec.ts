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
import MakeException from '../commands/Make/Exception'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Exception', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make an exception class inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const exception = new MakeException(app, new Kernel(app).mockConsoleOutput())
    exception.name = 'user'
    await exception.run()

    const UserException = await fs.get('app/Exceptions/UserException.ts')
    const ExceptionTemplate = await templates.get('exception.txt')
    assert.deepEqual(
      toNewlineArray(UserException),
      toNewlineArray(
        ExceptionTemplate.replace(new RegExp('\\{{ filename }}', 'g'), 'UserException')
      )
    )
  })

  test('make a self-handled exception class inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const exception = new MakeException(app, new Kernel(app).mockConsoleOutput())
    exception.name = 'user'
    exception.selfHandle = true
    await exception.run()

    const UserException = await fs.get('app/Exceptions/UserException.ts')
    const ExceptionTemplate = await templates.get('self-handle-exception.txt')
    assert.deepEqual(
      toNewlineArray(UserException),
      toNewlineArray(
        ExceptionTemplate.replace(new RegExp('\\{{ filename }}', 'g'), 'UserException')
      )
    )
  })

  test('make an exception class inside a custom directory', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        namespaces: {
          exceptions: 'App/Exceptions/Custom',
        },
        aliases: {
          App: './app',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const exception = new MakeException(app, new Kernel(app).mockConsoleOutput())
    exception.name = 'user'
    exception.selfHandle = true
    await exception.run()

    const UserException = await fs.get('app/Exceptions/Custom/UserException.ts')
    const ExceptionTemplate = await templates.get('self-handle-exception.txt')
    assert.deepEqual(
      toNewlineArray(UserException),
      toNewlineArray(
        ExceptionTemplate.replace(new RegExp('\\{{ filename }}', 'g'), 'UserException')
      )
    )
  })
})
