/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import execa from 'execa'
import { Logger } from '@poppinss/fancy-logs'

const WARN_MESSAGE = [
	'Unable to generate manifest file.',
	'Check the following error stack for more info',
].join(' ')

/**
 * Exposes the API to execute generate manifest file
 */
export class Manifest {
	/**
	 * The maximum number of times we should attempt to generate
	 * the manifest file before giving up.
	 *
	 * This number make sound too big, but in real world scanerio, we
	 * have seen encountered malformed JSON between 10-12 times.
	 *
	 * The JSON gets malformed, when a parallel process (node ace serve --watch)
	 * is trying to update it.
	 */
	private maxAttempts = 15
	private attempts = 0

	constructor(private appRoot: string, private logger: Logger) {}

	/**
	 * Returns a boolean telling if the error message is pointing
	 * towards invalid or empty JSON file read attempt.
	 */
	private isMalformedJSONError(error: string) {
		return error.includes('Unexpected end of JSON input')
	}

	/**
	 * Generates the manifest file. We ignore `generate:manifest` errors for
	 * now, since it's a secondary task for us and one should run it
	 * in seperate process to find the actual errors.
	 */
	public async generate() {
		try {
			const response = await execa.node('ace', ['generate:manifest'], {
				buffer: true,
				cwd: this.appRoot,
				env: {
					FORCE_COLOR: 'true',
				},
			})

			/**
			 * Print warning when `stderr` exists
			 */
			if (response.stderr) {
				if (this.isMalformedJSONError(response.stderr) && this.attempts < this.maxAttempts) {
					this.attempts++
					await this.generate()
					return
				}

				this.logger.warn(WARN_MESSAGE)
				console.log(response.stderr)
				return
			}

			/**
			 * Log success
			 */
			if (response.stdout) {
				console.log(response.stdout)
			}
		} catch (error) {
			if (this.isMalformedJSONError(error.stderr) && this.attempts < this.maxAttempts) {
				this.attempts++
				await this.generate()
				return
			}

			/**
			 * Print warning on error
			 */
			this.logger.warn(WARN_MESSAGE)
			if (error.stderr) {
				console.log(error.stderr)
			}
		}
	}
}
