/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import getPort from 'get-port'
import { Chokidar } from '@poppinss/chokidar-ts'
import { logger as uiLogger } from '@poppinss/cliui'

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
		/**
		 * Stick file watcher
		 */
		const watcher = new Chokidar(this.appRoot)

		/**
		 * Watcher is ready after first compile
		 */
		watcher.on('watcher:ready', () => {
			this.logger.info('watching file system for changes')
		})

		/**
		 * Source file removed
		 */
		watcher.on('source:unlink', async (filePath) => {
			this.clearScreen()
			this.logger.action('delete').succeeded(filePath)

			/**
			 * Generate manifest when filePath is a commands path
			 */
			if (this.rcFile.isCommandsPath(filePath)) {
				this.manifest.generate()
			}

			this.httpServer.restart()
		})

		/**
		 * Source file added
		 */
		watcher.on('source:add', async (filePath) => {
			this.clearScreen()
			this.logger.action('add').succeeded(filePath)

			/**
			 * Generate manifest when filePath is a commands path
			 */
			if (this.rcFile.isCommandsPath(filePath)) {
				this.manifest.generate()
			}

			this.httpServer.restart()
		})

		/**
		 * Source file changed
		 */
		watcher.on('source:change', async (filePath) => {
			this.clearScreen()
			this.logger.action('update').succeeded(filePath)

			/**
			 * Generate manifest when filePath is a commands path
			 */
			if (this.rcFile.isCommandsPath(filePath)) {
				this.manifest.generate()
			}

			this.httpServer.restart()
		})

		/**
		 * New file added
		 */
		watcher.on('add', async (filePath) => {
			const metaData = this.rcFile.getMetaData(filePath)
			if (!metaData.metaFile) {
				return
			}

			this.clearScreen()

			this.logger.action('create').succeeded(filePath)
			if (metaData.reload) {
				this.httpServer.restart()
			}
		})

		/**
		 * File changed
		 */
		watcher.on('change', async (filePath) => {
			const metaData = this.rcFile.getMetaData(filePath)
			if (!metaData.metaFile) {
				return
			}

			this.clearScreen()
			this.logger.action('update').succeeded(filePath)

			if (metaData.reload || metaData.rcFile) {
				this.httpServer.restart()
			}
		})

		/**
		 * File removed
		 */
		watcher.on('unlink', async (filePath) => {
			const metaData = this.rcFile.getMetaData(filePath)
			if (!metaData.metaFile) {
				return
			}

			this.clearScreen()

			if (metaData.rcFile) {
				this.logger.info('cannot continue after deletion of .adonisrc.json file')
				watcher.chokidar.close()
				return
			}

			this.logger.action('delete').succeeded(filePath)
			if (metaData.reload) {
				this.httpServer.restart()
			}
		})

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
		 * Start the watcher
		 */
		watcher.watch(['.'], {
			ignored: config.raw.exclude,
			usePolling: poll,
		})
	}
}
