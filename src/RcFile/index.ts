/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import picomatch from 'picomatch'
import { Ioc } from '@adonisjs/fold'
import { resolveFrom } from '@poppinss/utils'
import { Application } from '@adonisjs/application/build/standalone'

import { RCFILE_NAME, ACE_FILE_NAME } from '../../config/paths'

/**
 * Exposes the API to pull meta files from the `.adonisrc.json` file and
 * also match relative file paths against the defined globs.
 */
export class RcFile {
  public rcFilePath = resolveFrom(this._appRoot, `./${RCFILE_NAME}`)

  /**
   * Raw rcfile contents
   */
  public raw = require(this.rcFilePath)

  /**
   * Reference to application
   */
  public application = new Application(this._appRoot, new Ioc(), this.raw, {})

  /**
   * A matcher to know if a file is part of the meta files globs
   */
  public isMetaFile: (filePath: string) => boolean = picomatch(this.getMetaFilesGlob())

  /**
   * A matcher to know if a file is part of the restart server files globs
   */
  public isRestartServerFile: (filePath: string) => boolean = picomatch(this.getRestartServerFilesGlob())

  constructor (private _appRoot: string) {
  }

  /**
   * Returns true when file is `.adonisrc.json` itself
   */
  public isRcFile (filePath: string) {
    return filePath === RCFILE_NAME
  }

  /**
   * Returns an array of globs for the meta files
   * to be copied
   */
  public getMetaFilesGlob (): string[] {
    return this.application
      .rcFile
      .metaFiles
      .filter(({ pattern }) => ![RCFILE_NAME, ACE_FILE_NAME].includes(pattern))
      .map(({ pattern }) => pattern)
      .concat([ACE_FILE_NAME])
  }

  /**
   * Returns an array of globs for the meta files that has `reloadServer`
   * set to true
   */
  public getRestartServerFilesGlob (): string[] {
    return this.application.rcFile.metaFiles
      .filter(({ reloadServer, pattern }) => {
        return reloadServer === true && ![RCFILE_NAME, ACE_FILE_NAME].includes(pattern)
      })
      .map(({ pattern }) => pattern)
  }

  /**
   * Returns metadata for a given file path. The metadata can
   * be used to execute certain actions during file watch.
   */
  public getMetaData (filePath: string) {
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
