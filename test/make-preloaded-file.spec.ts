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
import PreloadFile from '../commands/Make/PreloadFile'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Preloaded File', (group) => {
	group.before(() => {
		process.env.ADONIS_ACE_CWD = fs.basePath
	})

	group.after(() => {
		delete process.env.ADONIS_ACE_CWD
	})

	group.afterEach(async () => {
		await fs.cleanup()
	})

	test('make a preload file inside the start directory', async (assert) => {
		await fs.add('.adonisrc.json', JSON.stringify({}))

		const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
		const app = new Application(fs.basePath, new Ioc(), rcContents, {})

		const preloadFile = new PreloadFile(app, new Kernel(app))
		preloadFile.name = 'viewGlobals'
		preloadFile.environment = 'console,web'
		await preloadFile.handle()

		const AppProvider = await fs.get('start/viewGlobals.ts')
		const ProviderTemplate = await templates.get('preload-file.txt')
		assert.deepEqual(
			toNewlineArray(AppProvider),
			toNewlineArray(ProviderTemplate.replace('{{ filename }}', 'AppProvider'))
		)

		const rcRawContents = await fs.get('.adonisrc.json')
		assert.deepEqual(JSON.parse(rcRawContents), {
			preloads: [
				{
					file: './start/viewGlobals',
					environment: ['console', 'web'],
				},
			],
		})
	})

	test('make a preload file inside custom directory', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				directories: {
					start: 'foo',
				},
			})
		)

		const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
		const app = new Application(fs.basePath, new Ioc(), rcContents, {})

		const preloadFile = new PreloadFile(app, new Kernel(app))
		preloadFile.name = 'viewGlobals'
		preloadFile.environment = 'console,web'
		await preloadFile.handle()

		const AppProvider = await fs.get('foo/viewGlobals.ts')
		const ProviderTemplate = await templates.get('preload-file.txt')
		assert.deepEqual(
			toNewlineArray(AppProvider),
			toNewlineArray(ProviderTemplate.replace('{{ filename }}', 'AppProvider'))
		)

		const rcRawContents = await fs.get('.adonisrc.json')
		assert.deepEqual(JSON.parse(rcRawContents), {
			directories: { start: 'foo' },
			preloads: [
				{
					file: './foo/viewGlobals',
					environment: ['console', 'web'],
				},
			],
		})
	})
})
