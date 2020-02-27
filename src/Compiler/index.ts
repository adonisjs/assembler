/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import mem from 'mem'
import slash from 'slash'
import copyfiles from 'cpy'
import tsStatic from 'typescript'
import { join, relative } from 'path'
import { Logger } from '@poppinss/fancy-logs'
import { remove, outputJSON } from 'fs-extra'
import { resolveFrom } from '@poppinss/utils'
import { TypescriptCompiler } from '@poppinss/chokidar-ts'
import { iocTransformer } from '@adonisjs/ioc-transformer'

import { RcFile } from '../RcFile'
import { Manifest } from '../Manifest'
import { Installer } from '../Installer'
import { HttpServer, DummyHttpServer } from '../HttpServer'
import {
  RCFILE_NAME,
  TSCONFIG_FILE_NAME,
  SERVER_ENTRY_FILE,
  DEFAULT_BUILD_DIR,
} from '../../config/paths'

/**
 * Exposes the API to build the AdonisJs project for development or
 * production. The production build has it's own set of node_modules
 */
export class Compiler {
  /**
   * Reference to typescript compiler
   */
  public tsCompiler = new TypescriptCompiler(
    this.appRoot,
    TSCONFIG_FILE_NAME,
    require(resolveFrom(this.appRoot, 'typescript/lib/typescript')),
  )

  /**
   * Reference to HTTP server
   */
  public httpServer: HttpServer | DummyHttpServer

  /**
   * Reference to rc File
   */
  public rcFile = new RcFile(this.appRoot)

  /**
   * Manifest instance to generate ace manifest file
   */
  public manifest = new Manifest(this.appRoot, this.logger)

  /**
   * Returns relative unix path from the project root. Used for
   * display only
   */
  private getRelativeUnixPath = mem((absPath: string) => slash(relative(this.appRoot, absPath)))

  constructor (
    public appRoot: string,
    private serveApp: boolean,
    private nodeArgs: string[] = [],
    private logger: Logger = new Logger(),
  ) {
    this.tsCompiler.use(() => {
      return iocTransformer(this.tsCompiler.ts, this.rcFile.application.rcFile)
    }, 'after')
  }

  /**
   * Create the http server
   */
  public createHttpServer (outDir: string) {
    if (this.httpServer) {
      return
    }

    const Server = this.serveApp ? HttpServer : DummyHttpServer
    this.httpServer = new Server(SERVER_ENTRY_FILE, outDir, this.nodeArgs, this.logger)
  }

  /**
   * Render ts diagnostics
   */
  public renderDiagnostics (
    diagnostics: tsStatic.Diagnostic[],
    host: tsStatic.CompilerHost,
  ) {
    console.log(this.tsCompiler.ts.formatDiagnosticsWithColorAndContext(diagnostics, host))
  }

  /**
   * Parses the tsconfig file
   */
  public parseConfig (): undefined | tsStatic.ParsedCommandLine {
    const { error, config } = this.tsCompiler.configParser().parse()

    if (error) {
      this.logger.error(`unable to compile ${TSCONFIG_FILE_NAME}`)
      this.renderDiagnostics([error], this.tsCompiler.ts.createCompilerHost({}))
      return
    }

    if (config && config.errors.length) {
      this.logger.error(`unable to compile ${TSCONFIG_FILE_NAME}`)
      this.renderDiagnostics(config.errors, this.tsCompiler.ts.createCompilerHost(config.options))
      return
    }

    config!.options.rootDir = config!.options.rootDir || this.appRoot
    config!.options.outDir = config!.options.outDir || join(this.appRoot, DEFAULT_BUILD_DIR)
    return config
  }

  /**
   * Cleans up the build directory
   */
  public async cleanupBuildDirectory (outDir: string) {
    this.logger.info({ message: 'cleaning up build directory', suffix: this.getRelativeUnixPath(outDir) })
    await remove(outDir)
  }

  /**
   * Copies .adonisrc.json file to the destination
   */
  public async copyAdonisRcFile (outDir: string) {
    this.logger.info({ message: `copy ${RCFILE_NAME}`, suffix: this.getRelativeUnixPath(outDir) })
    await outputJSON(
      join(outDir, RCFILE_NAME),
      Object.assign({}, this.rcFile.getDiskContents(), { typescript: false }),
      { spaces: 2 },
    )
  }

  /**
   * Copy all meta files to the build directory
   */
  public async copyMetaFiles (outDir: string, extraFiles?: string[]) {
    const metaFiles = this.rcFile.getMetaFilesGlob().concat(extraFiles || [])
    this.logger.info({ message: `copy ${metaFiles.join(',')}`, suffix: this.getRelativeUnixPath(outDir) })
    await this.copyFiles(metaFiles, outDir)
  }

  /**
   * Copy files to destination directory
   */
  public async copyFiles (files: string[], outDir: string) {
    await copyfiles(files, outDir, { cwd: this.appRoot, parents: true })
  }

  /**
   * Build typescript source files
   */
  public buildTypescriptSource (config: tsStatic.ParsedCommandLine) {
    this.logger.pending('compiling typescript source files')

    const builder = this.tsCompiler.builder(config)
    const { skipped, diagnostics } = builder.build()

    if (skipped) {
      this.logger.info('TS emit skipped')
    }

    if (diagnostics.length) {
      this.logger.error('typescript compiler errors')
      this.renderDiagnostics(diagnostics, builder.host)
    } else {
      this.logger.success('built successfully')
    }
  }

  /**
   * Compile project. See [[Compiler.compileForProduction]] for
   * production build
   */
  public async compile (): Promise<boolean> {
    const config = this.parseConfig()
    if (!config) {
      return false
    }

    await this.cleanupBuildDirectory(config.options.outDir!)
    await this.copyAdonisRcFile(config.options.outDir!)
    await this.copyMetaFiles(config.options.outDir!)
    this.buildTypescriptSource(config)
    await this.manifest.generate()

    /**
     * Start HTTP server
     */
    if (this.serveApp) {
      this.createHttpServer(config.options.outDir!)
      this.httpServer.start()
    }

    return true
  }

  /**
   * Compile project. See [[Compiler.compile]] for development build
   */
  public async compileForProduction (client: 'npm' | 'yarn'): Promise<boolean> {
    const config = this.parseConfig()
    if (!config) {
      return false
    }

    const pkgFiles = client === 'npm'
      ? ['package.json', 'package-lock.json']
      : ['package.json', 'yarn.lock']

    await this.cleanupBuildDirectory(config.options.outDir!)
    await this.copyAdonisRcFile(config.options.outDir!)
    await this.copyMetaFiles(config.options.outDir!, pkgFiles)
    this.buildTypescriptSource(config)

    this.logger.info({ message: 'installing production dependencies', suffix: client })
    await new Installer(config.options.outDir!, client).install()

    /**
     * Manifest can be generated without blocking the flow
     */
    this.manifest.generate()

    /**
     * Start HTTP server in production
     */
    if (this.serveApp) {
      this.createHttpServer(config.options.outDir!)
      this.httpServer.start()
    }

    return true
  }
}
