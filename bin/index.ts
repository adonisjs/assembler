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
 * Get the file path to every assembler commands
 */
const commandsPaths = fsReadAll(
  join(__dirname, '../commands'),
  (file) => !file.includes('Base') && file.endsWith('.js')
)
  .map((file) => `./commands/${file}`)
  .map((file) => file.replace(/\\/g, '/'))

/**
 * Generates ace-manifest file
 */
new ManifestGenerator(join(__dirname, '..'), commandsPaths).generate()
