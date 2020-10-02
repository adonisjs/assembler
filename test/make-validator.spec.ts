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
import importFresh from 'import-fresh'
import { Kernel } from '@adonisjs/ace'
import { Filesystem } from '@poppinss/dev-utils'
import { Application } from '@adonisjs/application'

import { toNewlineArray } from '../test-helpers'
import MakeValidator from '../commands/Make/Validator'

const fs = new Filesystem(join(__dirname, '__app'))
const templates = new Filesystem(join(__dirname, '..', 'templates'))

test.group('Make Validator', (group) => {
	group.before(() => {
		process.env.ADONIS_ACE_CWD = fs.basePath
	})

	group.after(() => {
		delete process.env.ADONIS_ACE_CWD
	})

	group.afterEach(async () => {
		await fs.cleanup()
	})

	test('make a model inside the default directory', async (assert) => {
		await fs.add('.adonisrc.json', JSON.stringify({}))

		const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
		const app = new Application(fs.basePath, 'test', rcContents)

		const validator = new MakeValidator(app, new Kernel(app))
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

	test('make a validator inside a custom directory', async (assert) => {
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

		const rcContents = importFresh(join(fs.basePath, '.adonisrc.json')) as any
		const app = new Application(fs.basePath, 'test', rcContents)

		const validator = new MakeValidator(app, new Kernel(app))
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
