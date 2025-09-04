/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import ts from 'typescript'
import chokidar from 'chokidar'
import { test } from '@japa/runner'
import string from '@poppinss/utils/string'
import { parseConfig } from '../../src/utils.ts'
import { FileSystem } from '../../src/file_system.ts'

test.group('Watch', () => {
  test('get watch files list based using file system', async ({ assert, cleanup, fs }, done) => {
    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
      exclude: ['node_modules/**', 'build', 'public/js/*', 'inertia'],
    })
    await fs.create('src/foo.ts', '')
    await fs.create('src/index.ts', '')
    await fs.create('public/js/app.js', '')
    await fs.create('public/views/pages/home.edge', '')
    await fs.create('public/css/app.css', '')
    await fs.create('inertia/pages/home.tsx', '')
    await fs.create('build/index.js', '')
    await fs.create('node_modules/colors/index.ts', '')
    await fs.create('.git/refs/heads/foo', '')

    const fileSystem = new FileSystem(
      string.toUnixSlash(fs.basePath),
      parseConfig(fs.basePath, ts)!,
      {
        suites: [],
        metaFiles: [
          {
            pattern: 'public/**/*.edge',
            reloadServer: false,
          },
        ],
      }
    )

    const watcher = chokidar.watch(['.'], {
      ignored(file, stats) {
        if (!stats) {
          return false
        }
        if (stats.isFile()) {
          return !fileSystem.shouldWatchFile(file)
        }
        return !fileSystem.shouldWatchDirectory(file)
      },
      cwd: fs.basePath,
    })
    cleanup(() => watcher.close())

    watcher.on('ready', () => {
      const watchedFiles = watcher.getWatched()
      assert.snapshot(
        Object.keys(watcher.getWatched()).reduce<any>((result, key) => {
          result[string.toUnixSlash(key)] = watchedFiles[key]
          return result
        }, {})
      ).matchInline(`
        {
          ".": [
            "public",
            "src",
          ],
          "..": [
            "tmp",
          ],
          "public": [
            "css",
            "js",
            "views",
          ],
          "public/css": [],
          "public/js": [],
          "public/views": [
            "pages",
          ],
          "public/views/pages": [
            "home.edge",
          ],
          "src": [
            "foo.ts",
            "index.ts",
          ],
        }
      `)
      done()
    })
  }).waitForDone()
})
