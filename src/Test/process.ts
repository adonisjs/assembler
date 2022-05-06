/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import execa from 'execa'
import { logger as uiLogger } from '@poppinss/cliui'

import { JapaFlags } from '../Contracts'

/**
 * Exposes the API to run tests as a child process.
 */
export class TestProcess {
  private nodeArgs: string[]

  constructor(
    private sourceFile: string,
    private projectRoot: string,
    private filters: JapaFlags,
    nodeArgs: string[] = [],
    private logger: typeof uiLogger,
    private env: { [key: string]: string } = {}
  ) {
    this.nodeArgs = nodeArgs.reduce<string[]>((result, arg) => {
      result = result.concat(arg.split(' '))
      return result
    }, [])
  }

  /**
   * Start the HTTP server as a child process.
   */
  public async run() {
    this.logger.info('running tests...')
    const filters = Object.keys(this.filters).reduce<string[]>((result, filter) => {
      const value = this.filters[filter]

      if (filter === '_') {
        result.push(...value)
        return result
      }

      result.push(filter)
      if (Array.isArray(value)) {
        result.push(value.join(','))
      } else {
        result.push(value)
      }

      return result
    }, [])

    try {
      await execa.node(this.sourceFile, filters, {
        stdio: 'inherit',
        cwd: this.projectRoot,
        env: {
          FORCE_COLOR: 'true',
          ...this.env,
        },
        nodeOptions: ['-r', '@adonisjs/assembler/build/register'].concat(this.nodeArgs),
      })
      return { hasErrors: false }
    } catch {
      return { hasErrors: true }
    }
  }
}
