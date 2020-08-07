/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import hasYarn from 'has-yarn'
import { BaseCommand, flags } from '@adonisjs/ace'

/**
 * Compile typescript project Javascript
 */
export default class Build extends BaseCommand {
	public static commandName = 'build'
	public static description =
		'Compile typescript code to Javascript. Optionally watch for file changes'

	/**
	 * Allows watching for file changes
	 */
	@flags.boolean({ description: 'Watch filesystem and re-compile changes', alias: 'w' })
	public watch: boolean

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
	 * Detect changes by polling files
	 */
	@flags.boolean({
		description: 'Detect file changes by polling files instead of listening to filesystem events',
		alias: 'p',
	})
	public poll: boolean

	/**
	 * Invoked automatically by ace
	 */
	public async handle() {
		const { Watcher } = await import('../src/Watcher')
		const { Compiler } = await import('../src/Compiler')
		const { ADONIS_ACE_CWD, ADONIS_IS_TYPESCRIPT } = await import('../config/env')

		const cwd = ADONIS_ACE_CWD()

		/**
		 * Dis-allow when CWD is missing. It will always be set by `node ace`
		 * commands and also when project is not a typescript project.
		 */
		if (!cwd || !ADONIS_IS_TYPESCRIPT()) {
			this.logger.error(
				'Cannot build a non-typescript project. Make sure to run "node ace build" from the project root'
			)
			return
		}

		/**
		 * --watch and --production flags aren't allowed together
		 */
		if (this.watch && this.production) {
			this.logger.info('--watch and --production flags cannot be used together. Skipping --watch')
		}

		/**
		 * Deciding the client to use for installing dependencies
		 */
		this.client = this.client || hasYarn(cwd) ? 'yarn' : 'npm'
		if (this.client !== 'npm' && this.client !== 'yarn') {
			this.logger.warn('--client must be set to "npm" or "yarn"')
			return
		}

		try {
			if (this.production) {
				await new Compiler(cwd, false, [], this.logger).compileForProduction(this.client)
			} else if (this.watch) {
				await new Watcher(cwd, false, [], this.logger).watch(this.poll)
			} else {
				await new Compiler(cwd, false, [], this.logger).compile()
			}
		} catch (error) {
			this.logger.fatal(error)
		}
	}
}
