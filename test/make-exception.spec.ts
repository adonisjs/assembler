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
import importFresh from 'import-fresh'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application/build/standalone'

import { toNewlineArray } from '../test-helpers'
import MakeException from '../commands/Make/Exception'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Exception', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make an exception class inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
    const app = new Application(fs.basePath, new Ioc(), rcContents, {})

    const exception = new MakeException(app, new Kernel(app))
    exception.name = 'user'
    await exception.handle()

    const UserException = await fs.get('app/Exceptions/UserException.ts')
    const ExceptionTemplate = await templates.get('exception.txt')
    assert.deepEqual(
      toNewlineArray(UserException),
      toNewlineArray(ExceptionTemplate.replace('{{ filename }}', 'UserException')),
    )
  })

  test('make a self-handled exception class inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
    const app = new Application(fs.basePath, new Ioc(), rcContents, {})

    const exception = new MakeException(app, new Kernel(app))
    exception.name = 'user'
    exception.selfHandle = true
    await exception.handle()

    const UserException = await fs.get('app/Exceptions/UserException.ts')
    const ExceptionTemplate = await templates.get('self-handle-exception.txt')
    assert.deepEqual(
      toNewlineArray(UserException),
      toNewlineArray(ExceptionTemplate.replace('{{ filename }}', 'UserException')),
    )
  })

  test('make an exception class inside a custom directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      namespaces: {
        exceptions: 'App/Exceptions/Custom',
      },
      aliases: {
        App: './app',
      },
    }))

    const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
    const app = new Application(fs.basePath, new Ioc(), rcContents, {})

    const exception = new MakeException(app, new Kernel(app))
    exception.name = 'user'
    exception.selfHandle = true
    await exception.handle()

    const UserException = await fs.get('app/Exceptions/Custom/UserException.ts')
    const ExceptionTemplate = await templates.get('self-handle-exception.txt')
    assert.deepEqual(
      toNewlineArray(UserException),
      toNewlineArray(ExceptionTemplate.replace('{{ filename }}', 'UserException')),
    )
  })
})
