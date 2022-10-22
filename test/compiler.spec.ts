/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import execa from 'execa'
import { join } from 'path'
import { Filesystem } from '@poppinss/dev-utils'
import { instantiate } from '@poppinss/cliui/build/api'

import { Compiler } from '../src/Compiler'
import { success, info, warning, error, dimYellow } from '../test-helpers'
import { Application } from '@adonisjs/application'

const ui = instantiate(true)
const fs = new Filesystem(join(__dirname, '__app'))
const app = new Application(fs.basePath, 'web', {})

test.group('Compiler', (group) => {
  group.setup(() => {
    ui.logger.useRenderer(ui.testingRenderer)
  })

  group.each.teardown(() => {
    ui.testingRenderer.logs = []
  })

  group.each.teardown(async () => {
    await fs.cleanup()
  })

  test('build source files', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {},
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/.adonisrc.json',
        'build/ace',
        'build/src/foo.js',
        'build/public/styles/main.css',
        'build/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [true, true, true, true, true])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('public/**/*.(js|css),ace => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)

  test('build source files with explicit outDir', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          outDir: 'build',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/.adonisrc.json',
        'build/src/foo.js',
        'build/public/styles/main.css',
        'build/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('public/**/*.(js|css),ace => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
    ])
  }).timeout(0)

  test('build source files with explicit rootDir', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/.adonisrc.json',
        'build/src/foo.js',
        'build/public/styles/main.css',
        'build/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('public/**/*.(js|css),ace => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
    ])
  }).timeout(0)

  test('build source files to nested outDir', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build/dist',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build/dist"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('public/**/*.(js|css),ace => build/dist')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build/dist')} }`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
    ])
  }).timeout(0)

  test('do not build when config has errors', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          foo: 'bar',
          rootDir: './',
          outDir: 'build/dist',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', "import path from 'path'")
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [false, false, false, false])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${error}  unable to parse tsconfig.json`,
        stream: 'stderr',
      },
    ])
  }).timeout(0)

  test('catch and report typescript errors', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build/dist',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', "import path from 'path'")
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile(false)

    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [true, true, true, true])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build/dist"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${error}  typescript compiler errors`,
        stream: 'stderr',
      },
      {
        message: `${info}  copy { ${dimYellow('public/**/*.(js|css),ace => build/dist')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build/dist')} }`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
    ])
  }).timeout(0)

  test('do not continue on error', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build/dist',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', "import path from 'path'")
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile(true)

    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [false, false, false, false])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build/dist"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${error}  typescript compiler errors`,
        stream: 'stderr',
      },
      {
        message: '',
        stream: 'stderr',
      },
      {
        message: `bgRed(Cannot complete the build process as there are typescript errors. Use "--ignore-ts-errors" flag to ignore Typescript errors)`,
        stream: 'stderr',
      },
      {
        message: `${info}  cleaning up ${dimYellow('"./build/dist"')} directory`,
        stream: 'stdout',
      },
    ])
  }).timeout(0)

  test('do not emit when noEmitOnError is true', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build/dist',
          noEmitOnError: true,
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', "import path from 'path'")
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [false, false, false, false])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build/dist"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${warning}  typescript emit skipped`,
        stream: 'stdout',
      },
      {
        message: `${error}  typescript compiler errors`,
        stream: 'stderr',
      },
    ])
  }).timeout(0)

  test('build for production should copy package files to build folder', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'package.json',
      JSON.stringify({
        name: 'my-dummy-app',
        dependencies: {
          lodash: 'latest',
        },
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          outDir: 'build',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')
    await execa('npm', ['install'], {
      buffer: false,
      cwd: fs.basePath,
      stdio: 'inherit',
    })

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compileForProduction(false, 'npm')

    const hasFiles = await Promise.all(
      [
        'build/.adonisrc.json',
        'build/src/foo.js',
        'build/public/styles/main.css',
        'build/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow(
          'public/**/*.(js|css),ace,package.json,package-lock.json => build'
        )} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
      {
        message: '',
        stream: 'stdout',
      },
    ])

    const hasPackageLock = await fs.fsExtra.pathExists(
      join(fs.basePath, 'build', 'package-lock.json')
    )
    assert.isTrue(hasPackageLock)
  }).timeout(0)

  test('gracefully log error when ace file finishes with non-zero exit code', async ({
    assert,
  }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {},
      })
    )

    await fs.add('ace', "console.error('foo');process.exit(1)")
    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      [
        'build/.adonisrc.json',
        'build/ace',
        'build/src/foo.js',
        'build/public/styles/main.css',
        'build/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [false, false, false, false, false])
    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('public/**/*.(js|css),ace => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${warning}  Unable to generate manifest file. Check the following error for more info`,
        stream: 'stdout',
      },
      {
        message: 'foo',
        stream: 'stderr',
      },
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)

  test('ignore error when any of the meta file is missing', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/css/app.js'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {},
      })
    )

    await fs.add('src/foo.ts', '')
    await fs.add('ace', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    await compiler.compile()

    const hasFiles = await Promise.all(
      ['build/.adonisrc.json', 'build/ace', 'build/src/foo.js', 'build/public/css/app.js'].map(
        (file) => fs.fsExtra.pathExists(join(fs.basePath, file))
      )
    )

    ui.testingRenderer.logs.pop()

    assert.deepEqual(hasFiles, [true, true, true, false])
    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  cleaning up ${dimYellow('"./build"')} directory`,
        stream: 'stdout',
      },
      {
        message: `${info}  compiling typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('public/css/app.js,ace => build')} }`,
        stream: 'stdout',
      },
      {
        message: `${info}  copy { ${dimYellow('.adonisrc.json => build')} }`,
        stream: 'stdout',
      },
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)

  test('build should support custom tsconfig file', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
      })
    )

    await fs.add(
      'package.json',
      JSON.stringify({
        name: 'my-dummy-app',
        dependencies: {},
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          outDir: 'build',
        },
      })
    )

    await fs.add(
      'tsconfig.production.json',
      JSON.stringify({
        extends: './tsconfig.json',
        exclude: ['build', 'src/ignored.ts'],
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', '')
    await fs.add('src/ignored.ts', '')

    const compiler = new Compiler(app, [], false, ui.logger, 'tsconfig.production.json')
    await compiler.compileForProduction(false, 'npm')

    const hasFiles = await Promise.all(
      ['build/.adonisrc.json', 'build/src/foo.js', 'build/src/ignored.js'].map((file) =>
        fs.fsExtra.pathExists(join(fs.basePath, file))
      )
    )

    assert.deepEqual(hasFiles, [true, true, false])
  }).timeout(0)

  test('typecheck and report typescript errors', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build/dist',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', "import path from 'path'")
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    const isValid = await compiler.typeCheck()

    assert.isFalse(isValid)
    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [false, false, false, false])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  type checking typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${error}  typescript compiler errors`,
        stream: 'stderr',
      },
    ])
  }).timeout(0)

  test('complete successfully when typechecking has no errors', async ({ assert }) => {
    await fs.add(
      '.adonisrc.json',
      JSON.stringify({
        typescript: true,
        metaFiles: ['public/**/*.(js|css)'],
      })
    )

    await fs.add(
      'tsconfig.json',
      JSON.stringify({
        include: ['**/*'],
        exclude: ['build'],
        compilerOptions: {
          rootDir: './',
          outDir: 'build/dist',
        },
      })
    )

    await fs.add('ace', '')
    await fs.add('src/foo.ts', "import 'path'")
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(app, [], false, ui.logger)
    const isValid = await compiler.typeCheck()

    assert.isTrue(isValid)
    const hasFiles = await Promise.all(
      [
        'build/dist/.adonisrc.json',
        'build/dist/src/foo.js',
        'build/dist/public/styles/main.css',
        'build/dist/public/scripts/main.js',
      ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file)))
    )

    assert.deepEqual(hasFiles, [false, false, false, false])

    assert.deepEqual(ui.testingRenderer.logs, [
      {
        message: `${info}  type checking typescript source files`,
        stream: 'stdout',
      },
      {
        message: `${success}  built successfully`,
        stream: 'stdout',
      },
    ])
  }).timeout(0)
})
