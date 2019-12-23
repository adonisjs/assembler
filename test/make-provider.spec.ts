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
import MakeProvider from '../commands/Make/Provider'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Provider', (group) => {
  group.before(() => {
    process.env.ADONIS_ACE_CWD = fs.basePath
  })

  group.after(() => {
    delete process.env.ADONIS_ACE_CWD
  })

  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('make a provider inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const provider = new MakeProvider(app, new Kernel(app))
    provider.name = 'app'
    await provider.handle()

    const AppProvider = await fs.get('providers/AppProvider.ts')
    const ProviderTemplate = await templates.get('provider.txt')
    assert.deepEqual(
      toNewlineArray(AppProvider),
      toNewlineArray(ProviderTemplate.replace('${filename}', 'AppProvider')),
    )

    const rcContents = await fs.get('.adonisrc.json')
    assert.deepEqual(JSON.parse(rcContents), {
      providers: ['./providers/AppProvider'],
    })
  })

  test('make a provider inside a custom directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      directories: {
        providers: 'foo',
      },
    }))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const provider = new MakeProvider(app, new Kernel(app))
    provider.name = 'app'
    await provider.handle()

    const AppProvider = await fs.get('foo/AppProvider.ts')
    const ProviderTemplate = await templates.get('provider.txt')
    assert.deepEqual(
      toNewlineArray(AppProvider),
      toNewlineArray(ProviderTemplate.replace('${filename}', 'AppProvider')),
    )

    const rcContents = await fs.get('.adonisrc.json')
    assert.deepEqual(JSON.parse(rcContents), {
      directories: {
        providers: 'foo',
      },
      providers: ['./foo/AppProvider'],
    })
  })

  test('setup correct path when nested provider is created', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const provider = new MakeProvider(app, new Kernel(app))
    provider.name = 'auth/app'
    await provider.handle()

    const AppProvider = await fs.get('providers/auth/AppProvider.ts')
    const ProviderTemplate = await templates.get('provider.txt')
    assert.deepEqual(
      toNewlineArray(AppProvider),
      toNewlineArray(ProviderTemplate.replace('${filename}', 'AppProvider')),
    )

    const rcContents = await fs.get('.adonisrc.json')
    assert.deepEqual(JSON.parse(rcContents), {
      providers: ['./providers/auth/AppProvider'],
    })
  })

  test('make ace provider', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const app = new Application(fs.basePath, new Ioc(), {}, {})

    const provider = new MakeProvider(app, new Kernel(app))
    provider.name = 'app'
    provider.ace = true
    await provider.handle()

    const AppProvider = await fs.get('providers/AppProvider.ts')
    const ProviderTemplate = await templates.get('provider.txt')
    assert.deepEqual(
      toNewlineArray(AppProvider),
      toNewlineArray(ProviderTemplate.replace('${filename}', 'AppProvider')),
    )

    const rcContents = await fs.get('.adonisrc.json')
    assert.deepEqual(JSON.parse(rcContents), {
      aceProviders: ['./providers/AppProvider'],
    })
  })
})
