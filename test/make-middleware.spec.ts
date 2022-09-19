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
import MakeMiddleware from '../commands/Make/Middleware'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Middleware', (group) => {
  group.setup(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.teardown(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('make a middleware inside the default directory', async ({ assert }) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const middleware = new MakeMiddleware(app, new Kernel(app).mockConsoleOutput())
    middleware.name = 'spoof_accept'
    await middleware.run()

    const SpoofMiddleware = await fs.get('app/Middleware/SpoofAccept.ts')
    const MiddlewareTemplate = await templates.get('middleware.txt')
    assert.deepEqual(
      toNewlineArray(SpoofMiddleware),
      toNewlineArray(MiddlewareTemplate.replace('{{ filename }}', 'SpoofAccept'))
    )
  })

  test('make a middleware inside a custom directory', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        namespaces: {
          middleware: 'App/Module/Testing/Middleware',
        },
        autoloads: {
          App: './app',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const middleware = new MakeMiddleware(app, new Kernel(app).mockConsoleOutput())
    middleware.name = 'spoof_accept'
    await middleware.run()

    const SpoofMiddleware = await fs.get('app/Module/Testing/Middleware/SpoofAccept.ts')
    const MiddlewareTemplate = await templates.get('middleware.txt')
    assert.deepEqual(
      toNewlineArray(SpoofMiddleware),
      toNewlineArray(MiddlewareTemplate.replace('{{ filename }}', 'SpoofAccept'))
    )
  })
})
