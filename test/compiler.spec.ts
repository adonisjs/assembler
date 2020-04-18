/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import test from 'japa'
import execa from 'execa'
import { join } from 'path'
import { Logger } from '@poppinss/fancy-logs'
import { Filesystem } from '@poppinss/dev-utils'

import { Compiler } from '../src/Compiler'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('Compiler', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('build source files', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/ace',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build))',
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)

  test('build source files with explicit outDir', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        outDir: 'build',
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build))',
    ])
  }).timeout(0)

  test('build source files with explicit rootDir', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build',
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build))',
    ])
  }).timeout(0)

  test('build source files to nested outDir', async (assert) => {
    const logger = new Logger({ fake: true })
    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build/dist',
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/dist/.adonisrc.json',
      'build/dist/src/foo.js',
      'build/dist/public/styles/main.css',
      'build/dist/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build/dist))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build/dist))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build/dist))',
    ])
  }).timeout(0)

  test('catch and report typescript errors', async (assert) => {
    const logger = new Logger({ fake: true })
    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build/dist',
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', 'import path from \'path\'')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/dist/.adonisrc.json',
      'build/dist/src/foo.js',
      'build/dist/public/styles/main.css',
      'build/dist/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])

    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build/dist))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build/dist))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(red(error)) typescript compiler errors',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build/dist))',
    ])
  }).timeout(0)

  test('do not emit when noEmitOnError is true', async (assert) => {
    const logger = new Logger({ fake: true })
    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build/dist',
        noEmitOnError: true,
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', 'import path from \'path\'')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/dist/.adonisrc.json',
      'build/dist/src/foo.js',
      'build/dist/public/styles/main.css',
      'build/dist/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, false, true, true])

    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build/dist))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build/dist))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(blue(info)) TS emit skipped',
      'underline(red(error)) typescript compiler errors',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build/dist))',
    ])
  }).timeout(0)

  test('build for production should copy package files to build folder', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('package.json', JSON.stringify({
      name: 'my-dummy-app',
      dependencies: {
        'lodash': 'latest',
      },
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        outDir: 'build',
      },
    }))

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')
    await execa('npm', ['install'], {
      buffer: false,
      cwd: fs.basePath,
      stdio: 'inherit',
    })

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compileForProduction('npm')

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) copy public/**/*.(js|css),ace,package.json,package-lock.json dim(yellow(build))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build))',
    ])

    const hasPackageLock = await fs.fsExtra.pathExists(join(fs.basePath, 'build', 'package-lock.json'))
    assert.isTrue(hasPackageLock)
  }).timeout(0)

  test('gracefully log error when ace file writes to stderr', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
      },
    }))

    await fs.add('ace', 'console.error(\'foo\')')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'ace',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    logger.logs.pop()

    assert.deepEqual(hasFiles, [true, true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) copy public/**/*.(js|css),ace dim(yellow(build))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build))',
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)

  test('ignore error when any of the meta file is missing', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
      },
    }))

    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/ace',
      'build/src/foo.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    logger.logs.pop()

    assert.deepEqual(hasFiles, [true, false, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) copy ace dim(yellow(build))',
      'underline(magenta(pending)) compiling typescript source files',
      'underline(green(success)) built successfully',
      'underline(blue(info)) copy .adonisrc.json dim(yellow(build))',
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)
})
