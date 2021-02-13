/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import slash from 'slash'
import picomatch from 'picomatch'
import { join, relative } from 'path'
import importFresh from 'import-fresh'
import { Application } from '@adonisjs/application'
import { resolveFrom } from '@poppinss/utils/build/helpers'

import { RCFILE_NAME, ACE_FILE_NAME } from '../../config/paths'

/**
 * Exposes the API to pull meta files from the `.adonisrc.json` file and
 * also match relative file paths against the defined globs.
 */
export class RcFile {
	public rcFilePath = resolveFrom(this.appRoot, `./${RCFILE_NAME}`)

	/**
	 * Raw rcfile contents
	 */
	public raw = this.getDiskContents()

	/**
	 * Reference to application
	 */
	public application = new Application(this.appRoot, 'console', this.raw)

	/**
	 * A matcher to know if a file is part of the meta files globs
	 */
	public isMetaFile: (filePath: string) => boolean = picomatch(this.getMetaFilesGlob())

	/**
	 * A matcher to know if a file is part of the restart server files globs
	 */
	public isRestartServerFile: (filePath: string) => boolean = picomatch(
		this.getRestartServerFilesGlob()
	)

	/**
	 * Commands match to know, if file path is part of the commands paths defined
	 * inside `.adonisrc.json` file
	 */
	public isCommandsPath: (filePath: string) => boolean = picomatch(this.commandsGlob())

	constructor(private appRoot: string) {}

	/**
	 * Returns an array of globs for the meta files that has `reloadServer`
	 * set to true
	 */
	private getRestartServerFilesGlob(): string[] {
		return this.application.rcFile.metaFiles
			.filter(({ reloadServer, pattern }) => {
				return reloadServer === true && ![RCFILE_NAME, ACE_FILE_NAME].includes(pattern)
			})
			.map(({ pattern }) => pattern)
	}

	/**
	 * Returns the commands glob for registered commands. We convert the
	 * command paths to glob pattern
	 */
	private commandsGlob(): string[] {
		const commands = this.application.rcFile.commands.reduce((result: string[], commandPath) => {
			if (/^(.){1,2}\//.test(commandPath)) {
				commandPath = slash(relative(this.appRoot, join(this.appRoot, commandPath)))
				result = result.concat([`${commandPath}.*`, `${commandPath}/**/*`])
			}
			return result
		}, [])

		return commands
	}

	/**
	 * Returns true when file is `.adonisrc.json` itself
	 */
	private isRcFile(filePath: string) {
		return filePath === RCFILE_NAME
	}

	/**
	 * Returns an array of globs for the meta files
	 * to be copied
	 */
	public getMetaFilesGlob(): string[] {
		return this.application.rcFile.metaFiles
			.filter(({ pattern }) => ![RCFILE_NAME, ACE_FILE_NAME].includes(pattern))
			.map(({ pattern }) => pattern)
			.concat([ACE_FILE_NAME])
	}

	/**
	 * Reloads the rcfile.json bypassing the require cache
	 */
	public getDiskContents(): any {
		return importFresh(this.rcFilePath) as any
	}

	/**
	 * Returns metadata for a given file path. The metadata can
	 * be used to execute certain actions during file watch.
	 */
	public getMetaData(filePath: string) {
		/**
		 * File path === '.adonisrc.json'
		 */
		if (this.isRcFile(filePath)) {
			return {
				reload: true,
				rcFile: true,
				metaFile: true,
			}
		}

		/**
		 * File is part of `reloadServer` metadata file globs
		 */
		if (this.isRestartServerFile(filePath)) {
			return {
				reload: true,
				rcFile: false,
				metaFile: true,
			}
		}

		/**
		 * File is part of metadata file globs, but reload = false
		 */
		if (this.isMetaFile(filePath)) {
			return {
				reload: false,
				rcFile: false,
				metaFile: true,
			}
		}

		/**
		 * Out of scope
		 */
		return {
			reload: false,
			rcFile: false,
			metaFile: false,
		}
	}
}
