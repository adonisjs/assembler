/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join, resolve } from 'node:path'
import string from '@poppinss/utils/string'
import { readTsConfig } from '../../src/utils.ts'
import { fileURLToPath } from 'node:url'

test.group('Helpers | Read TSConfig', () => {
  test('return null when file is missing', async ({ fs, assert }) => {
    assert.isNull(readTsConfig(string.toUnixSlash(fileURLToPath(fs.baseUrl))))
  })

  test('read tsconfig file', async ({ assert, fs }) => {
    await fs.createJson('tsconfig.json', {
      include: ['**/*'],
    })
    await fs.create('foo.ts', '')

    const result = readTsConfig(string.toUnixSlash(fileURLToPath(fs.baseUrl)))!
    assert.deepEqual(result.config.include, ['**/*'])
  })

  test('read a custom tsconfig file', async ({ assert, fs }) => {
    await fs.createJson('config/tsconfig.build.json', {
      compilerOptions: {
        outDir: '../build',
      },
    })

    const result = readTsConfig(
      string.toUnixSlash(fileURLToPath(fs.baseUrl)),
      'config/tsconfig.build.json'
    )!

    assert.equal(result.path, fileURLToPath(new URL('config/tsconfig.build.json', fs.baseUrl)))
    assert.equal(result.config.compilerOptions?.outDir, '../build')
    assert.equal(result.getNormalizedOutDir(), string.toUnixSlash(join(fs.basePath, 'build')))
  })

  test('parse tsconfig file using ${configDir} variable to point to the root dir', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('tsconfig.json', {
      include: ['${configDir}/**/*', '${configDir}/.adonisjs/server/**/*'],
    })
    await fs.create('foo.ts', '')

    const result = readTsConfig(string.toUnixSlash(fileURLToPath(fs.baseUrl)))!
    assert.deepEqual(result.config.include, ['**/*', '.adonisjs/server/**/*'])
  })

  test('default output directory to the application build directory')
    .with(['tsconfig.json', 'config/tsconfig.build.json'])
    .run(async ({ assert, fs }, configPath) => {
      await fs.createJson(configPath, {})

      const result = readTsConfig(fs.basePath, configPath)!
      assert.equal(result.getNormalizedOutDir(), string.toUnixSlash(join(fs.basePath, 'build')))
    })

  test('normalize relative output directory "{outDir}"')
    .with([
      { outDir: 'build', expected: 'build' },
      { outDir: './dist', expected: 'dist' },
      { outDir: './/build', expected: 'build' },
      { outDir: './//build', expected: 'build' },
      { outDir: 'nested/../build', expected: 'build' },
      { outDir: '${configDir}/build', expected: 'build' },
      { outDir: '../sibling-build', expected: '../sibling-build' },
    ])
    .run(async ({ assert, fs }, { outDir, expected }) => {
      await fs.createJson('tsconfig.json', { compilerOptions: { outDir } })

      const result = readTsConfig(fs.basePath)!
      assert.equal(result.getNormalizedOutDir(), string.toUnixSlash(resolve(fs.basePath, expected)))
    })

  test('resolve an inherited output directory')
    .with(['../dist', '${configDir}/dist'])
    .run(async ({ assert, fs }, outDir) => {
      await fs.createJson('config/base.json', { compilerOptions: { outDir } })
      await fs.createJson('tsconfig.json', { extends: './config/base.json' })

      const result = readTsConfig(fs.basePath)!
      assert.equal(result.getNormalizedOutDir(), string.toUnixSlash(join(fs.basePath, 'dist')))
    })

  test('default to build when an inherited output directory is cleared', async ({ assert, fs }) => {
    await fs.createJson('config/base.json', { compilerOptions: { outDir: '../dist' } })
    await fs.createJson('config/tsconfig.build.json', {
      extends: './base.json',
      compilerOptions: { outDir: null },
    })

    const result = readTsConfig(fs.basePath, 'config/tsconfig.build.json')!
    assert.equal(result.getNormalizedOutDir(), string.toUnixSlash(join(fs.basePath, 'build')))
  })

  test('preserve output directory precedence with multiple base configs')
    .with([
      { outDir: undefined, expected: 'inherited-build' },
      { outDir: './/project-build', expected: 'project-build' },
      { outDir: null, expected: 'build' },
    ])
    .run(async ({ assert, fs }, { outDir, expected }) => {
      await fs.createJson('config/first.json', { compilerOptions: { outDir: '../first-build' } })
      await fs.createJson('config/second.json', {
        compilerOptions: { outDir: '../inherited-build' },
      })
      await fs.createJson('tsconfig.json', {
        extends: ['./config/first.json', './config/second.json'],
        compilerOptions: { outDir },
      })

      const result = readTsConfig(fs.basePath)!
      assert.equal(result.getNormalizedOutDir(), string.toUnixSlash(join(fs.basePath, expected)))
    })

  test('reject unsafe output directory "{$self}" only when requested')
    .with(['.', './', '', 'build/..', '..', '../..'])
    .run(async ({ assert, fs }, outDir) => {
      await fs.createJson('tsconfig.json', { compilerOptions: { outDir } })

      const result = readTsConfig(fs.basePath)
      assert.isNotNull(result)
      assert.throws(
        () => result!.getNormalizedOutDir(),
        /It must not be the application root or one of its parent directories/
      )
    })

  test('reject a parent output directory when the application name starts with two dots', async ({
    assert,
    fs,
  }) => {
    await fs.createJson('..app/tsconfig.json', { compilerOptions: { outDir: '..' } })

    const result = readTsConfig(join(fs.basePath, '..app'))!
    assert.throws(
      () => result.getNormalizedOutDir(),
      /It must not be the application root or one of its parent directories/
    )
  })

  test('reject the application root from a nested config file', async ({ assert, fs }) => {
    await fs.createJson('config/tsconfig.build.json', { compilerOptions: { outDir: '..' } })

    const result = readTsConfig(fs.basePath, 'config/tsconfig.build.json')!
    assert.throws(
      () => result.getNormalizedOutDir(),
      /It must not be the application root or one of its parent directories/
    )
  })
})
