/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import test from 'japa'
import { join } from 'path'
import { Filesystem } from '@poppinss/dev-utils'

import { RcFile } from '../src/RcFile'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('RcFile', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('get an array of meta file patterns from the rcfile', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      metaFiles: ['.env', 'public/**/*.(css|js)'],
    }))

    const rcFile = new RcFile(fs.basePath)
    assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)'])
  })

  test('get an array of meta file patterns that has reload server set to true', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      metaFiles: [
        { pattern: '.env', reloadServer: false },
        'public/**/*.(css|js)',
      ],
    }))

    const rcFile = new RcFile(fs.basePath)
    assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)'])
    assert.deepEqual(rcFile.getRestartServerFilesGlob(), ['public/**/*.(css|js)'])
  })

  test('match relative paths against meta files', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      metaFiles: [
        { pattern: '.env', reloadServer: false },
        'public/**/*.(css|js)',
      ],
    }))

    const rcFile = new RcFile(fs.basePath)
    assert.isTrue(rcFile.isMetaFile('public/style.css'))
    assert.isTrue(rcFile.isMetaFile('public/script.js'))
    assert.isFalse(rcFile.isMetaFile('public/script.sass'))
  })

  test('match relative paths against reloadServer meta files', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      metaFiles: [
        { pattern: '.env', reloadServer: false },
        'public/**/*.(css|js)',
      ],
    }))

    const rcFile = new RcFile(fs.basePath)
    assert.isTrue(rcFile.isRestartServerFile('public/style.css'))
    assert.isTrue(rcFile.isRestartServerFile('public/script.js'))
    assert.isFalse(rcFile.isRestartServerFile('.env'))
  })

  test('filter .adonisrc.json file from files globs array', async (assert) => {
    await fs.add('.adonisrc.json', JSON.stringify({
      metaFiles: [
        '.adonisrc.json',
        { pattern: '.env', reloadServer: false },
        'public/**/*.(css|js)',
      ],
    }))

    const rcFile = new RcFile(fs.basePath)
    assert.deepEqual(rcFile.getMetaFilesGlob(), ['.env', 'public/**/*.(css|js)'])
    assert.deepEqual(rcFile.getRestartServerFilesGlob(), ['public/**/*.(css|js)'])
  })
})
