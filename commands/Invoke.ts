/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { BaseCommand, args } from '@adonisjs/ace'
import { Manifest } from '../src/Manifest'

/**
 * Invoke post install instructions
 */
export default class Invoke extends BaseCommand {
	public static commandName = 'invoke'
	public static description = 'Run post install instructions for a given AdonisJS package'

	/**
	 * Use yarn when building for production to install dependencies
	 */
	@args.string({ description: 'Name of the package for which to invoke post install instructions' })
	public name: string

	/**
	 * Invoked automatically by ace
	 */
	public async run() {
		const { tasks } = await import('@adonisjs/sink')

		await new tasks.Instructions(
			this.name,
			this.application.appRoot,
			this.application,
			true
		).execute()

		await new Manifest(this.application.appRoot, this.logger).generate()
	}
}
