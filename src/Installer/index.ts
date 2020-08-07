/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import execa from 'execa'

/**
 * Exposes the API to install production dependencies for a project
 * using yarn or npm
 */
export class Installer {
	constructor(private appRoot: string, private client: 'npm' | 'yarn') {}

	/**
	 * Install dependencies
	 */
	public async install() {
		const args = this.client === 'npm' ? ['ci', '--production'] : ['install', '--production']
		await execa(this.client, args, {
			buffer: false,
			stdio: 'inherit',
			cwd: this.appRoot,
			env: {
				FORCE_COLOR: 'true',
			},
		})
	}
}
