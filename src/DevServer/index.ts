/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import getPort from 'get-port'
import { logger as uiLogger } from '@poppinss/cliui'
import { getWatcherHelpers } from '@adonisjs/require-ts'

import { Ts } from '../Ts'
import { RcFile } from '../RcFile'
import { Manifest } from '../Manifest'
import { EnvParser } from '../EnvParser'
import { HttpServer } from '../HttpServer'

import { SERVER_ENTRY_FILE } from '../../config/paths'

/**
 * Exposes the API to watch project for compilition changes.
 */
export class DevServer {
	private httpServer: HttpServer

	/**
	 * Reference to the typescript compiler
	 */
	private ts = new Ts(this.appRoot, this.logger)

	/**
	 * Reference to the RCFile
	 */
	private rcFile = new RcFile(this.appRoot)

	/**
	 * Manifest instance to generate ace manifest file
	 */
	private manifest = new Manifest(this.appRoot, this.logger)

	/**
	 * Require-ts watch helpers
	 */
	private watchHelpers = getWatcherHelpers(this.appRoot)

	constructor(
		private appRoot: string,
		private nodeArgs: string[] = [],
		private logger: typeof uiLogger = uiLogger
	) {}

	/**
	 * Create the http server
	 */
	private async createHttpServer() {
		if (this.httpServer) {
			return
		}

		const envParser = new EnvParser()
		await envParser.parse(this.appRoot)

		const envOptions = envParser.asEnvObject(['PORT', 'TZ'])

		/**
		 * Obtains a random port by giving preference to the one defined inside
		 * the `.env` file. This eases the process of running the application
		 * without manually changing ports inside the `.env` file when
		 * original port is in use.
		 */
		if (envOptions.PORT) {
			envOptions.PORT = String(
				await getPort({
					port: [Number(envOptions.PORT)],
					host: envParser.get('HOST'),
				})
			)
		}

		this.httpServer = new HttpServer(
			SERVER_ENTRY_FILE,
			this.appRoot,
			this.nodeArgs,
			this.logger,
			envOptions
		)
	}

	/**
	 * Clear stdout
	 */
	private clearScreen() {
		process.stdout.write('\x1B[2J\x1B[3J\x1B[H\x1Bc')
	}

	/**
	 * Start the dev server. Use [[watch]] to also watch for file
	 * changes
	 */
	public async start() {
		this.logger.info('Building project')

		/**
		 * Clear require-ts cache
		 */
		this.watchHelpers.clear()

		/**
		 * Start the HTTP server right away
		 */
		await this.createHttpServer()
		this.httpServer.start()

		/**
		 * Notify that the http server has died
		 */
		this.httpServer.on('exit', ({ code }) => {
			this.logger.warning(`Underlying HTTP server died with "${code} code"`)
		})
	}

	/**
	 * Build and watch for file changes
	 */
	public async watch(poll = false) {
		await this.start()

		/**
		 * Parse config to find the files excluded inside
		 * tsconfig file
		 */
		const config = this.ts.parseConfig()
		if (!config) {
			this.logger.warning('Cannot start watcher because of errors in the config file')
			return
		}

		/**
		 * Stick file watcher
		 */
		const watcher = this.ts.tsCompiler.watcher(config, 'raw')

		/**
		 * Watcher is ready after first compile
		 */
		watcher.on('watcher:ready', () => {
			this.logger.info('watching file system for changes')
		})

		/**
		 * Source file removed
		 */
		watcher.on('source:unlink', async ({ absPath, relativePath }) => {
			this.clearScreen()
			this.watchHelpers.clear(absPath)
			this.logger.action('delete').succeeded(relativePath)

			/**
			 * Generate manifest when filePath is a commands path
			 */
			if (this.rcFile.isCommandsPath(relativePath)) {
				this.manifest.generate()
			}

			this.httpServer.restart()
		})

		/**
		 * Source file added
		 */
		watcher.on('source:add', async ({ absPath, relativePath }) => {
			this.clearScreen()
			this.watchHelpers.clear(absPath)
			this.logger.action('add').succeeded(relativePath)

			/**
			 * Generate manifest when filePath if file is in commands path
			 */
			if (this.rcFile.isCommandsPath(relativePath)) {
				this.manifest.generate()
			}

			this.httpServer.restart()
		})

		/**
		 * Source file changed
		 */
		watcher.on('source:change', async ({ absPath, relativePath }) => {
			this.clearScreen()
			this.watchHelpers.clear(absPath)
			this.logger.action('update').succeeded(relativePath)

			/**
			 * Generate manifest when filePath is a commands path
			 */
			if (this.rcFile.isCommandsPath(relativePath)) {
				this.manifest.generate()
			}

			this.httpServer.restart()
		})

		/**
		 * New file added
		 */
		watcher.on('add', async ({ relativePath }) => {
			const metaData = this.rcFile.getMetaData(relativePath)
			if (!metaData.metaFile) {
				return
			}

			this.clearScreen()

			this.logger.action('create').succeeded(relativePath)
			if (metaData.reload) {
				this.httpServer.restart()
			}
		})

		/**
		 * File changed
		 */
		watcher.on('change', async ({ relativePath }) => {
			const metaData = this.rcFile.getMetaData(relativePath)
			if (!metaData.metaFile) {
				return
			}

			this.clearScreen()
			this.logger.action('update').succeeded(relativePath)

			if (metaData.reload || metaData.rcFile) {
				this.httpServer.restart()
			}
		})

		/**
		 * File removed
		 */
		watcher.on('unlink', async ({ relativePath }) => {
			const metaData = this.rcFile.getMetaData(relativePath)
			if (!metaData.metaFile) {
				return
			}

			this.clearScreen()

			if (metaData.rcFile) {
				this.logger.info('cannot continue after deletion of .adonisrc.json file')
				watcher.chokidar.close()
				return
			}

			this.logger.action('delete').succeeded(relativePath)
			if (metaData.reload) {
				this.httpServer.restart()
			}
		})

		/**
		 * Start the watcher
		 */
		watcher.watch(['.'], {
			usePolling: poll,
		})
	}
}
