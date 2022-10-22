import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import Emittery from 'emittery'
import { logger as uiLogger } from '@poppinss/cliui'
import { resolveDir } from '@poppinss/utils/build/helpers'
import execa from 'execa'

export type DevServerResponse =
  | {
      state: 'not-installed' | 'no-assets'
    }
  | {
      state: 'running'
      port: string
      host: string
    }

export abstract class BaseAssetsBundlerDriver extends Emittery {
  protected bundlerArgs: string[] = []

  /**
   * Binary to execute
   */
  protected abstract binaryName: string

  /**
   * Options passed to spawn a child process
   */
  protected execaOptions = {
    preferLocal: true,
    buffer: false,
    stdio: 'pipe' as const,
    localDir: this.application.appRoot,
    cwd: this.application.appRoot,
    windowsHide: false,
    env: {
      FORCE_COLOR: 'true',
      // TODO/ add this.env
      // ...this.env,
    },
  }

  constructor(
    protected application: ApplicationContract,
    bundlerArgs: string[] = [],
    protected logger: typeof uiLogger = uiLogger
  ) {
    super()
    this.bundlerArgs = bundlerArgs.reduce((result, arg) => {
      result = result.concat(arg.split(' '))
      return result
    }, [] as string[])
  }

  /**
   * Returns the sanitized value for a given flag if defined
   */
  protected findArg(pattern: string): undefined | string {
    let argIndex = this.bundlerArgs.findIndex((arg) => arg === pattern)
    if (argIndex > -1) {
      return this.bundlerArgs[argIndex + 1]
    }

    argIndex = this.bundlerArgs.findIndex((arg) => arg.includes(pattern))
    if (argIndex > -1) {
      const tokens = this.bundlerArgs[argIndex].split('=')
      return tokens[1] && tokens[1].trim()
    }
  }

  /**
   * Returns the custom port defined using the `--port` flag in encore
   * flags
   */
  protected findCustomPort(): undefined | string {
    return this.findArg('--port')
  }

  /**
   * Returns the custom host defined using the `--host` flag in encore
   * flags
   */
  protected findCustomHost(): undefined | string {
    return this.findArg('--host')
  }

  /**
   * Find if given package is installed
   */
  protected isPackageInstalled(name: string) {
    try {
      resolveDir(this.application.appRoot, name)
      return true
    } catch {
      return false
    }
  }

  /**
   * Logs the line to stdout
   */
  protected log(line: Buffer | string, type: 'error' | 'log' = 'log') {
    line = line.toString().trim()
    if (!line.length) {
      return
    }
    console[type](`[ ${this.logger.colors.cyan(this.binaryName)} ] ${line}`)
  }

  /**
   * Execute command
   */
  protected exec(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const childProcess = execa(this.binaryName, args, this.execaOptions)

      childProcess.stdout?.on('data', (line: Buffer) => this.log(line))
      childProcess.stderr?.on('data', (line: Buffer) => this.log(line, 'error'))
      childProcess.on('error', (error) => reject(error))
      childProcess.on('close', (code) => {
        if (code && code !== 0) {
          reject(`Process exited with code ${code}`)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Configure the driver
   */
  public abstract configure(): Promise<void>

  /**
   * Build assets either for production or development
   */
  public abstract build(env: 'production' | 'dev'): Promise<{ hasErrors: boolean }>

  /**
   * Start the assets bundler dev server
   */
  public abstract startDevServer(): Promise<DevServerResponse>
}
