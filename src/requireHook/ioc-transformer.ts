/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import type tsStatic from 'typescript'
import { iocTransformer } from '@adonisjs/ioc-transformer'

/**
 * Transformer to transform AdonisJS IoC container import
 * statements
 */
export default function (ts: typeof tsStatic, appRoot: string) {
	return iocTransformer(ts, require(join(appRoot, '.adonisjsrc.json')))
}
