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
import MakeValidator from '../commands/Make/Validator'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Validator', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make a model inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const validator = new MakeValidator(app, new Kernel(app).mockConsoleOutput())
    validator.name = 'user'
    await validator.run()

    const UserValidator = await fs.get('app/Validators/UserValidator.ts')
    const ValidatorTemplate = await templates.get('validator.txt')
    assert.deepEqual(
      toNewlineArray(UserValidator),
      toNewlineArray(
        ValidatorTemplate.replace(new RegExp('\\{{ filename }}', 'g'), 'UserValidator')
      )
    )
  })

  test('make a validator inside a custom directory', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        namespaces: {
          validators: 'App',
        },
        autoloads: {
          App: './app',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const validator = new MakeValidator(app, new Kernel(app).mockConsoleOutput())
    validator.name = 'user'
    await validator.run()

    const UserValidator = await fs.get('app/UserValidator.ts')
    const ValidatorTemplate = await templates.get('validator.txt')
    assert.deepEqual(
      toNewlineArray(UserValidator),
      toNewlineArray(
        ValidatorTemplate.replace(new RegExp('\\{{ filename }}', 'g'), 'UserValidator')
      )
    )
  })
})
