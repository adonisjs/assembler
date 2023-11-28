import { test } from '@japa/runner'
import { copyFiles } from '../src/helpers.js'
import { join } from 'node:path'

test.group('Copy files', () => {
  test('expand glob patterns and copy files to the destination', async ({ assert, fs }) => {
    await fs.create('resources/views/welcome.edge', '')
    await fs.create('resources/views/about.edge', '')
    await fs.create('resources/views/contact/main.edge', '')

    await fs.create('public/foo/test/a.json', '')
    await fs.create('public/foo/test/b/a.json', '')

    await copyFiles(
      ['resources/views/*.edge', 'public/**'],
      fs.basePath,
      join(fs.basePath, 'build')
    )

    await assert.fileExists('build/resources/views/welcome.edge')
    await assert.fileExists('build/resources/views/about.edge')
    await assert.fileExists('build/resources/views/contact/main.edge')

    await assert.fileExists('build/public/foo/test/a.json')
    await assert.fileExists('build/public/foo/test/b/a.json')
  })

  test('copy relative file paths to the destination', async ({ fs, assert }) => {
    await fs.create('resources/views/welcome.edge', '')
    await fs.create('resources/views/about.edge', '')
    await fs.create('package.json', '')

    await copyFiles(
      ['resources/views/welcome.edge', 'resources/views/about.edge', 'package.json'],
      fs.basePath,
      join(fs.basePath, 'build')
    )

    await assert.fileExists('build/resources/views/welcome.edge')
    await assert.fileExists('build/resources/views/about.edge')
    await assert.fileExists('build/package.json')
  })

  test('ignore missing files at source', async ({ fs, assert }) => {
    await fs.create('resources/views/welcome.edge', '')
    await fs.create('resources/views/about.edge', '')

    await copyFiles(
      ['resources/views/welcome.edge', 'resources/views/about.edge', 'package.json'],
      fs.basePath,
      join(fs.basePath, 'build')
    )

    await assert.fileExists('build/resources/views/welcome.edge')
    await assert.fileExists('build/resources/views/about.edge')
  })

  test('ignore junk files', async ({ fs, assert }) => {
    await fs.create('resources/views/welcome.edge', '')
    await fs.create('resources/views/about.edge', '')
    await fs.create('resources/views/.DS_Store', '')

    await copyFiles(['resources/views/*'], fs.basePath, join(fs.basePath, 'build'))
    await assert.fileExists('build/resources/views/welcome.edge')
    await assert.fileExists('build/resources/views/about.edge')
    await assert.fileNotExists('build/resources/views/.DS_STORE')
  })

  test('glob pattern should pick dot-files and dot-folders', async ({ fs, assert }) => {
    await fs.create('public/.vite/manifest.json', '')
    await fs.create('public/.redirects', '')

    await copyFiles(['public/**'], fs.basePath, join(fs.basePath, 'build'))
    await assert.fileExists('build/public/.vite/manifest.json')
    await assert.fileExists('build/public/.redirects')
  })
})
