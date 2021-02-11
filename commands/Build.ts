/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import hasYarn from 'has-yarn'
import { BaseCommand, flags } from '@adonisjs/core/build/standalone'

/**
 * Compile typescript project Javascript
 */
export default class Build extends BaseCommand {
	public static commandName = 'build'
	public static description = 'Compile typescript code to Javascript'

	/**
	 * Build for production
	 */
	@flags.boolean({ description: 'Build for production', alias: 'prod' })
	public production: boolean

	/**
	 * Select the client for deciding the lock file to copy to the
	 * build folder
	 */
	@flags.string({
		description: 'Select the package manager to decide which lock file to copy to the build folder',
	})
	public client: string

	/**
	 * Invoked automatically by ace
	 */
	public async run() {
		const { Compiler } = await import('../src/Compiler')

		/**
		 * Deciding the client to use for installing dependencies
		 */
		this.client = this.client || hasYarn(this.application.appRoot) ? 'yarn' : 'npm'
		if (this.client !== 'npm' && this.client !== 'yarn') {
			this.logger.warning('--client must be set to "npm" or "yarn"')
			return
		}

		try {
			if (this.production) {
				await new Compiler(this.application.appRoot, this.logger).compileForProduction(this.client)
			} else {
				await new Compiler(this.application.appRoot, this.logger).compile()
			}
		} catch (error) {
			this.logger.fatal(error)
		}
	}
}
