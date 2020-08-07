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

import { RcFile } from '../src/RcFile'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('RcFile', (group) => {
	group.afterEach(async () => {
		await fs.cleanup()
	})

	test('get an array of meta file patterns from the rcfile', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: ['.env', 'public/**/*.(css|js)'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)', 'ace'])
	})

	test('get an array of meta file patterns that has reload server set to true', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [{ pattern: '.env', reloadServer: false }, 'public/**/*.(css|js)'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)', 'ace'])
		assert.deepEqual(rcFile.getRestartServerFilesGlob(), ['public/**/*.(css|js)'])
	})

	test('match relative paths against meta files', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [{ pattern: '.env', reloadServer: false }, 'public/**/*.(css|js)'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.isTrue(rcFile.isMetaFile('public/style.css'))
		assert.isTrue(rcFile.isMetaFile('public/script.js'))
		assert.isFalse(rcFile.isMetaFile('public/script.sass'))
	})

	test('match relative paths against reloadServer meta files', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [{ pattern: '.env', reloadServer: false }, 'public/**/*.(css|js)'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.isTrue(rcFile.isRestartServerFile('public/style.css'))
		assert.isTrue(rcFile.isRestartServerFile('public/script.js'))
		assert.isFalse(rcFile.isRestartServerFile('.env'))
	})

	test('filter .adonisrc.json file from files globs array', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [
					'.adonisrc.json',
					{ pattern: '.env', reloadServer: false },
					'public/**/*.(css|js)',
				],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)', 'ace'])
		assert.deepEqual(rcFile.getRestartServerFilesGlob(), ['public/**/*.(css|js)'])
	})

	test('filter ace file from files globs array', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: ['ace', { pattern: '.env', reloadServer: false }, 'public/**/*.(css|js)'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)', 'ace'])
		assert.deepEqual(rcFile.getRestartServerFilesGlob(), ['public/**/*.(css|js)'])
	})

	test('get metadata for files', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [
					'.adonisrc.json',
					{ pattern: '.env', reloadServer: false },
					'public/**/*.(css|js)',
				],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.deepEqual(rcFile.getMetaData('.adonisrc.json'), {
			reload: true,
			rcFile: true,
			metaFile: true,
		})

		assert.deepEqual(rcFile.getMetaData('public/style.css'), {
			reload: true,
			rcFile: false,
			metaFile: true,
		})

		assert.deepEqual(rcFile.getMetaData('.env'), {
			reload: false,
			rcFile: false,
			metaFile: true,
		})

		assert.deepEqual(rcFile.getMetaData('foo/bar.js'), {
			reload: false,
			rcFile: false,
			metaFile: false,
		})
	})

	test('match sub paths to the defined command path', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [],
				commands: ['./commands'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.isTrue(rcFile.isCommandsPath('commands/foo.ts'))
	})

	test('match actual path to the defined command path', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [],
				commands: ['./commands'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.isTrue(rcFile.isCommandsPath('commands.ts'))
	})

	test('do not work when commands refer to path outside the project root', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [],
				commands: ['../commands'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.isFalse(rcFile.isCommandsPath('commands.ts'))
		assert.isFalse(rcFile.isCommandsPath('commands/foo.ts'))
	})

	test('do not work when commands refer to a package', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: [],
				commands: ['@adonisjs/foo'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.isFalse(rcFile.isCommandsPath('@adonisjs/foo.ts'))
		assert.isFalse(rcFile.isCommandsPath('@adonisjs/foo/foo.ts'))
	})

	test('read file from the disk by-passing the cache', async (assert) => {
		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: ['.env', 'public/**/*.(css|js)'],
			})
		)

		const rcFile = new RcFile(fs.basePath)
		assert.deepEqual(rcFile.getDiskContents(), {
			metaFiles: ['.env', 'public/**/*.(css|js)'],
		})

		await fs.add(
			'.adonisrc.json',
			JSON.stringify({
				metaFiles: ['.env'],
			})
		)
		assert.deepEqual(rcFile.getDiskContents(), {
			metaFiles: ['.env'],
		})
	})
})
