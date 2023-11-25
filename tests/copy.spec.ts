import { test } from '@japa/runner'
import { copyFiles } from '../src/helpers.js'
import { join } from 'node:path'

test.group('Copy files', () => {
  test('match file patterns', async ({ fs }) => {
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

    await fs.exists('build/resources/views/welcome.edge')
    await fs.exists('build/resources/views/about.edge')
    await fs.exists('build/resources/views/contact/main.edge')

    await fs.exists('build/public/foo/test/a.json')
    await fs.exists('build/public/foo/test/b/a.json')
  })

  test('copy files that are not glob patterns', async ({ fs }) => {
    await fs.create('resources/views/welcome.edge', '')
    await fs.create('resources/views/about.edge', '')
    await fs.create('package.json', '')

    await copyFiles(
      ['resources/views/welcome.edge', 'resources/views/about.edge', 'package.json'],
      fs.basePath,
      join(fs.basePath, 'build')
    )

    await fs.exists('build/resources/views/welcome.edge')
    await fs.exists('build/resources/views/about.edge')
    await fs.exists('build/package.json')
  })

  test("copy files even if one path doesn't exist", async ({ fs }) => {
    await fs.create('resources/views/welcome.edge', '')
    await fs.create('resources/views/about.edge', '')

    await copyFiles(
      ['resources/views/welcome.edge', 'resources/views/about.edge', 'package.json'],
      fs.basePath,
      join(fs.basePath, 'build')
    )

    await fs.exists('build/resources/views/welcome.edge')
    await fs.exists('build/resources/views/about.edge')
  })
})
