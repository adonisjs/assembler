/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { fsReadAll } from '@poppinss/utils'
import { ManifestGenerator } from '@adonisjs/ace'

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
