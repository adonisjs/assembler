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
  ' Make sure to manually run "node ace generate:manifest"',
].join('')

/**
 * Exposes the API to execute generate manifest file
 */
export class Manifest {
  constructor (private _appRoot: string, private _logger: Logger) {
  }

  /**
   * Generates the manifest file. We ignore `generate:manifest` errors for
   * now, since it's a secondary task for us and one should run it
   * in seperate process to find the actual errors.
   */
  public async generate () {
    try {
      const response = await execa.node('ace', ['generate:manifest'], {
        buffer: true,
        cwd: this._appRoot,
        env: {
          FORCE_COLOR: 'true',
        },
      })

      /**
       * Print warning when `stderr` exists
       */
      if (response.stderr) {
        this._logger.warn(WARN_MESSAGE)
        return
      }

      /**
       * Log success
       */
      if (response.stdout) {
        console.log(response.stdout)
      }
    } catch (error) {
      /**
       * Print warning on error
       */
      this._logger.warn(WARN_MESSAGE)
    }
  }
}
