/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join } from 'node:path/posix'

import { readTsConfig } from '../src/utils.ts'
import { FileSystem } from '../src/file_system.ts'

const BASE_PATH = join(import.meta.dirname, '..')

test.group('File system', () => {
  test('inspect file path "{input}"')
    .with([
      {
        input: 'src/bundler.ts',
        matchType: 'script',
      },
      {
        input: 'foo.ts',
        matchType: 'script',
      },
      {
        input: 'hello.txt',
        matchType: null,
      },
      {
        input: 'hello.txt',
        matchType: null,
      },
      {
        input: 'public/js/app.ts',
        matchType: null,
      },
      {
        input: 'public/views/pages/home.edge',
        matchType: 'meta',
      },
      {
        input: 'schemas/user.gql',
        matchType: 'meta',
      },
      {
        input: 'node_modules/@colors/colors/safe.js',
        matchType: null,
      },
      {
        input: 'node_modules/@colors/colors/safe.ts',
        matchType: null,
      },
      {
        input: 'tests/unit/maths.spec.ts',
        matchType: 'test',
      },
      {
        input: 'packages/auth/unit/verify_credentials.spec.ts',
        matchType: 'test',
      },
    ])
    .run(({ assert }, { input, matchType }) => {
      const config = readTsConfig(BASE_PATH)!
      config.config.include = ['**/*']
      config.config.exclude = ['node_modules/**', 'public/**', 'schemas/**']

      const fs = new FileSystem(BASE_PATH, config, {
        metaFiles: [
          {
            pattern: 'public/views/**/*.edge',
            reloadServer: false,
          },
          {
            pattern: 'schemas/**/*.gql',
            reloadServer: true,
          },
        ],
        suites: [
          {
            name: 'unit',
            files: ['tests/unit/*.spec.ts', 'packages/**/unit/*.spec.ts'],
          },
        ],
      })

      if (matchType) {
        assert.isNotNull(fs.inspect(join(BASE_PATH, input), input))
        assert.property(fs.inspect(join(BASE_PATH, input), input), 'fileType')
        assert.equal(fs.inspect(join(BASE_PATH, input), input)!.fileType, matchType)
      } else {
        assert.isNull(fs.inspect(join(BASE_PATH, input), input))
      }
    })

  test('test if directory should be watched "{input}"')
    .with([
      {
        input: '.',
        result: true,
      },
      {
        input: 'src',
        result: true,
      },
      {
        input: 'public/js',
        result: false,
      },
      {
        input: 'public/css',
        result: false,
      },
      {
        input: 'public/views',
        result: true,
      },
      {
        input: 'public',
        result: true,
      },
      {
        input: 'schemas',
        result: true,
      },
      {
        input: 'node_modules',
        result: false,
      },
      {
        input: 'node_modules/@colors',
        result: false,
      },
      {
        input: '.github',
        result: false,
      },
      {
        input: '.git',
        result: false,
      },
    ])
    .run(({ assert }, { input, result }) => {
      const config = readTsConfig(BASE_PATH)!
      config.config.include = ['**/*']
      config.config.exclude = ['node_modules/**', 'public/(js|css)']

      const fs = new FileSystem(BASE_PATH, config, {
        metaFiles: [
          {
            pattern: 'public/views/**/*.edge',
            reloadServer: false,
          },
          {
            pattern: 'schemas/**/*.gql',
            reloadServer: true,
          },
        ],
        suites: [
          {
            name: 'unit',
            files: ['tests/unit/*.spec.ts', 'packages/**/unit/*.spec.ts'],
          },
        ],
      })

      assert.equal(fs.shouldWatchDirectory(join(BASE_PATH, input)), result)
    })

  test('do not consider .js files until allowJS flag is enabled', ({ assert }) => {
    const config = readTsConfig(BASE_PATH)!
    const fs = new FileSystem(BASE_PATH, config, {})
    assert.isNull(fs.inspect(join(BASE_PATH, 'src/foo.js'), 'src/foo.js'))

    config.config.compilerOptions = config.config.compilerOptions ?? {}
    config.config.compilerOptions.allowJs = true
    assert.equal(fs.inspect(join(BASE_PATH, 'src/foo.js'), 'src/foo.js')!.fileType, 'script')
  })

  test('do not consider .json files until resolveJsonModule flag is enabled', ({ assert }) => {
    const config = readTsConfig(BASE_PATH)!
    const fs = new FileSystem(BASE_PATH, config, {})
    assert.equal(fs.inspect(join(BASE_PATH, 'src/foo.json'), 'src/foo.json')!.fileType, 'script')

    config.config.compilerOptions = config.config.compilerOptions ?? {}
    config.config.compilerOptions.resolveJsonModule = false
    assert.isNull(fs.inspect(join(BASE_PATH, 'src/foo.json'), 'src/foo.json'))
  })
})
