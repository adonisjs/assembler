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
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import Invoke from '../commands/Invoke'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('Configure Vite', (group) => {
  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('setup vite', async ({ assert }) => {
    await fs.add(
      'package.json',
      JSON.stringify({
        name: 'sample_app',
      })
    )

    await fs.ensureRoot()
    const app = new Application(fs.basePath, 'test', {})

    const invoke = new Invoke(app, new Kernel(app).mockConsoleOutput())
    invoke.packages = ['vite']
    await invoke.run()

    const envFile = await fs.fsExtra.pathExists(join(fs.basePath, 'vite.config.ts'))
    const envExampleFile = await fs.fsExtra.readFile(
      join(fs.basePath, 'resources/js/app.ts'),
      'utf-8'
    )

    const pkgFile = await fs.get('package.json')
    assert.properties(JSON.parse(pkgFile).devDependencies, ['vite', '@adonisjs/vite-plugin-adonis'])

    assert.isTrue(envFile)
    assert.equal(envExampleFile.trim(), '// app entrypoint')
  })
    .timeout(0)
    .skip(true, 'TODO: Will fail until @adonisjs/vite-plugin-adonis is published')
})
