/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { args } from '@adonisjs/core/build/standalone'
import { string } from '@poppinss/utils/build/helpers'

import { BaseGenerator } from './Base'

/**
 * Command to make a new command
 */
export default class MakeCommand extends BaseGenerator {
	/**
	 * Required by BaseGenerator
	 */
	protected pattern = 'pascalcase' as const
	protected resourceName: string

	/**
	 * Command meta data
	 */
	public static commandName = 'make:command'
	public static description = 'Make a new ace command'

	@args.string({ description: 'Name of the command class' })
	public name: string

	/**
	 * Returns the template stub based upon the `--resource`
	 * flag value
	 */
	protected getStub(): string {
		return join(__dirname, '..', '..', 'templates', 'command.txt')
	}

	/**
	 * Path to the commands directory
	 */
	protected getDestinationPath(): string {
		return this.application.rcFile.directories.commands || 'commands'
	}

	/**
	 * Passed down to the template.
	 */
	protected templateData() {
		return {
			toCommandName: () => {
				return function (filename: string, render: any) {
					return string.snakeCase(render(filename)).replace(/_/, ':')
				}
			},
		}
	}

	public async run(): Promise<void> {
		this.resourceName = this.name
		await super.generate()
	}
}
