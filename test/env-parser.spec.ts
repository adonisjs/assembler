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
import { Filesystem } from '@poppinss/dev-utils'

import { EnvParser } from '../src/EnvParser'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('EnvParser', (group) => {
	group.afterEach(async () => {
		await fs.cleanup()
	})

	test('ignore exception raised when unable to lookup .env file', async () => {
		const envParser = new EnvParser()
		await envParser.parse(fs.basePath)
	})

	test('get value for a key defined inside .env file', async (assert) => {
		await fs.add('.env', 'PORT=3333')

		const envParser = new EnvParser()
		await envParser.parse(fs.basePath)
		assert.equal(envParser.get('PORT'), '3333')
	})

	test('get an object of values for defined keys', async (assert) => {
		await fs.add('.env', ['PORT=3333', 'TZ=Asia/Calcutta'].join('\n'))

		const envParser = new EnvParser()
		await envParser.parse(fs.basePath)
		assert.deepEqual(envParser.asEnvObject(['PORT', 'TZ', 'HOST']), {
			PORT: '3333',
			TZ: 'Asia/Calcutta',
		})
	})
})
