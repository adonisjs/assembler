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
import { readJSONSync } from 'fs-extra'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import MakeView from '../commands/Make/View'

const fs = new Filesystem(join(__dirname, '__app'))

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

  test('make an empty view inside the default directory', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({}))

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const view = new MakeView(app, new Kernel(app).mockConsoleOutput())
    view.name = 'welcome'
    await view.run()

    const welcomeView = await fs.get('resources/views/welcome.edge')
    assert.deepEqual(welcomeView.trim(), '')
  })

  test('make an empty view inside custom directory', async (assert) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        directories: {
          views: 'public/views',
        },
      })
    )

    const rcContents = readJSONSync(join(fs.basePath, '.adonisrc.json'))
    const app = new Application(fs.basePath, 'test', rcContents)

    const view = new MakeView(app, new Kernel(app).mockConsoleOutput())
    view.name = 'welcome'
    await view.run()

    const welcomeView = await fs.get('public/views/welcome.edge')
    assert.deepEqual(welcomeView.trim(), '')
  })
})
