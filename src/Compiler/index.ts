/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import slash from 'slash'
import copyfiles from 'cpy'
import tsStatic from 'typescript'
import { join, relative } from 'path'
import { remove, outputJSON } from 'fs-extra'
import { iocTransformer } from '@adonisjs/ioc-transformer'
import { logger as uiLogger, instructions } from '@poppinss/cliui'

import { Ts } from '../Ts'
import { RcFile } from '../RcFile'
import { Manifest } from '../Manifest'
import { RCFILE_NAME } from '../../config/paths'

/**
 * Exposes the API to build the AdonisJs project for development or
 * production. The production build has it's own set of node_modules
 */
export class Compiler {
	/**
	 * Reference to typescript compiler
	 */
	private ts = new Ts(this.appRoot, this.logger)

	/**
	 * Reference to rc File
	 */
	private rcFile = new RcFile(this.appRoot)

	constructor(public appRoot: string, private logger: typeof uiLogger = uiLogger) {
		this.ts.tsCompiler.use(() => {
			return iocTransformer(this.ts.tsCompiler.ts, this.rcFile.application.rcFile)
		}, 'after')
	}

	/**
	 * Returns relative unix path from the project root. Used for
	 * display only
	 */
	private getRelativeUnixPath(absPath: string): string {
		return slash(relative(this.appRoot, absPath))
	}

	/**
	 * Cleans up the build directory
	 */
	private async cleanupBuildDirectory(outDir: string) {
		this.logger.info('cleaning up build directory', undefined, this.getRelativeUnixPath(outDir))
		await remove(outDir)
	}

	/**
	 * Copies .adonisrc.json file to the destination
	 */
	private async copyAdonisRcFile(outDir: string) {
		this.logger.info(
			`copy (${this.logger.colors.yellow(`${RCFILE_NAME} => ${this.getRelativeUnixPath(outDir)}`)})`
		)

		await outputJSON(
			join(outDir, RCFILE_NAME),
			Object.assign({}, this.rcFile.getDiskContents(), {
				typescript: false,
				lastCompiledAt: new Date().toISOString(),
			}),
			{ spaces: 2 }
		)
	}

	/**
	 * Copy all meta files to the build directory
	 */
	private async copyMetaFiles(outDir: string, extraFiles?: string[]) {
		const metaFiles = this.rcFile.getMetaFilesGlob().concat(extraFiles || [])
		this.logger.info(`copy ${metaFiles.join(',')}`, undefined, this.getRelativeUnixPath(outDir))
		await this.copyFiles(metaFiles, outDir)
	}

	/**
	 * Copy files to destination directory
	 */
	private async copyFiles(files: string[], outDir: string) {
		try {
			await copyfiles(files, outDir, { cwd: this.appRoot, parents: true })
		} catch (error) {
			if (!error.message.includes("the file doesn't exist")) {
				throw error
			}
		}
	}

	/**
	 * Build typescript source files
	 */
	private buildTypescriptSource(config: tsStatic.ParsedCommandLine): boolean {
		this.logger.info('compiling typescript source files')

		const builder = this.ts.tsCompiler.builder(config)
		const { skipped, diagnostics } = builder.build()

		if (skipped) {
			this.logger.warning('typescript emit skipped')
		}

		if (diagnostics.length) {
			this.logger.error('typescript compiler errors')
			this.ts.renderDiagnostics(diagnostics, builder.host)
		}

		return !skipped
	}

	/**
	 * Compile project. See [[Compiler.compileForProduction]] for
	 * production build
	 */
	public async compile(extraFiles?: string[]): Promise<boolean> {
		const config = this.ts.parseConfig()
		if (!config) {
			return false
		}

		/**
		 * Always cleanup the out directory
		 */
		await this.cleanupBuildDirectory(config.options.outDir!)

		/**
		 * Build typescript source
		 */
		const emitOutput = this.buildTypescriptSource(config)
		if (!emitOutput) {
			return false
		}

		/**
		 * Begin by copying meta files
		 */
		await this.copyMetaFiles(config.options.outDir!, extraFiles)

		/**
		 * Copy `.adonisrc.json` file
		 */
		await this.copyAdonisRcFile(config.options.outDir!)

		/**
		 * Generate commands manifest
		 */

		/**
		 * Manifest instance to generate ace manifest file
		 */
		const manifest = new Manifest(config.options.outDir!, this.logger)
		const created = await manifest.generate()

		/**
		 * Do not continue when unable to generate the manifest file as commands
		 * won't be available
		 */
		if (!created) {
			return false
		}

		this.logger.success('built successfully')
		return true
	}

	/**
	 * Compile project. See [[Compiler.compile]] for development build
	 */
	public async compileForProduction(client: 'npm' | 'yarn'): Promise<boolean> {
		const config = this.ts.parseConfig()
		if (!config) {
			return false
		}

		const pkgFiles =
			client === 'npm' ? ['package.json', 'package-lock.json'] : ['package.json', 'yarn.lock']

		/**
		 * Always cleanup the out directory
		 */
		await this.cleanupBuildDirectory(config.options.outDir!)

		/**
		 * Build typescript source
		 */
		const emitOutput = this.buildTypescriptSource(config)
		if (!emitOutput) {
			return false
		}

		/**
		 * Begin by copying meta files
		 */
		await this.copyMetaFiles(config.options.outDir!, pkgFiles)

		/**
		 * Copy `.adonisrc.json` file
		 */
		await this.copyAdonisRcFile(config.options.outDir!)

		/**
		 * Generate commands manifest
		 */
		const manifest = new Manifest(config.options.outDir!, this.logger)
		const created = await manifest.generate()

		/**
		 * Do not continue when unable to generate the manifest file as commands
		 * won't be available
		 */
		if (!created) {
			return false
		}

		/**
		 * Print usage instructions
		 */
		const installCommand = client === 'npm' ? 'npm ci --production' : 'yarn install --production'
		const relativeBuildPath = this.getRelativeUnixPath(config.options.outDir!)

		this.logger.success('built successfully')
		this.logger.log('')

		instructions()
			.heading('Run the following commands to start the server in production')
			.add(this.logger.colors.cyan(`cd ${relativeBuildPath}`))
			.add(this.logger.colors.cyan(installCommand))
			.add(this.logger.colors.cyan('node server.js'))
			.render()

		return true
	}
}
