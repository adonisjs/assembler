/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { ManifestGenerator } from '@adonisjs/ace'
import { fsReadAll } from '@poppinss/utils/build/helpers'

/**
 * Generates ace-manifest file
 */
new ManifestGenerator(
	join(__dirname, '..'),
	fsReadAll(
		join(__dirname, '../commands'),
		(file) => !file.includes('Base') && file.endsWith('.js')
	).map((file) => `./commands/${file}`)
).generate()
