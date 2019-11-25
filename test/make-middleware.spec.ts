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

import MakeMiddleware from '../commands/Make/Middleware'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Middleware', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a middleware inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const middleware = new MakeMiddleware(app)
    middleware.name = 'spoof_accept'
    await middleware.handle()

    const SpoofMiddleware = await fs.get('app/Middleware/SpoofAccept.ts')
    const MiddlewareTemplate = await templates.get('middleware.txt')
    assert.equal(SpoofMiddleware, MiddlewareTemplate.replace('${filename}', 'SpoofAccept'))
  })
})
