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

const WARN_MESSAGE = [
  'Unable to generate manifest file.',
  'Check the following error for more info',
].join(' ')

/**
 * Exposes the API to execute generate manifest file
 */
export class Manifest {
  /**
   * The maximum number of times we should attempt to generate
   * the manifest file before giving up.
   *
   * This number may sound too big, but in real world scanerio, we
   * have seen encountered malformed JSON between 10-12 times.
   *
   * The JSON gets malformed, when a parallel process (node ace serve --watch)
   * is trying to update it.
   */
  private maxAttempts = 15
  private attempts = 0

  constructor(private appRoot: string, private logger: typeof uiLogger) {}

  /**
   * Returns a boolean telling if the error message is pointing
   * towards invalid or empty JSON file read attempt.
   */
  private isMalformedJSONError(error: string) {
    return error.includes('Unexpected end of JSON input')
  }

  /**
   * Generates the manifest file. We ignore `generate:manifest` errors for
   * now, since it's a secondary task for us and one should run it
   * in seperate process to find the actual errors.
   */
  public async generate(): Promise<boolean> {
    try {
      const response = await execa(process.execPath, ['ace', 'generate:manifest'], {
        buffer: true,
        cwd: this.appRoot,
        env: {
          FORCE_COLOR: 'true',
        },
      })

      /**
       * Log success
       */
      if (response.stdout) {
        this.logger.log(response.stdout)
      }

      return true
    } catch (error) {
      if (this.isMalformedJSONError(error.stderr) && this.attempts < this.maxAttempts) {
        this.attempts++
        return this.generate()
      }

      /**
       * Print warning on error
       */
      this.logger.warning(WARN_MESSAGE)
      if (error.stderr) {
        this.logger.logError(error.stderr)
      }

      return false
    }
  }
}
