/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { join } from 'path'
import { readFile } from 'fs-extra'
import { env } from '@adonisjs/env/build/standalone'

/**
 * Parses the env file inside the project root or the build
 * root directory.
 */
export class EnvParser {
  private envContents: any = {}

  /**
   * Parse .env file contents
   */
  public async parse (rootDir: string) {
    try {
      this.envContents = env.parse(await readFile(join(rootDir, '.env'), 'utf-8'))
    } catch {
    }
  }

  /**
   * Returns value for a key inside the `.env` file
   */
  public get (key: string): string | undefined {
    return this.envContents[key]
  }

  /**
   * Returns an env object for the keys that has defined values
   */
  public asEnvObject (keys: string[]): { [key: string]: string } {
    return keys.reduce((result, key) => {
      const value = this.get(key)
      if (value !== undefined) {
        result[key] = value
      }
      return result
    }, {})
  }
}
