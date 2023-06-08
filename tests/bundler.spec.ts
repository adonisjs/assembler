import { test } from '@japa/runner'
import { Bundler } from '../index.js'
import ts from 'typescript'

test.group('Bundler', () => {
  test('should copy metafiles to the build directory', async ({ assert, fs }) => {
    await Promise.all([
      fs.create('tsconfig.json', JSON.stringify({ compilerOptions: { outDir: 'build' } })),
      fs.create('.adonisrc.json', '{}'),
      fs.create('package.json', '{}'),
      fs.create('package-lock.json', '{}'),

      fs.create('resources/js/app.ts', ''),
      fs.create('resources/views/app.edge', ''),
      fs.create('resources/views/foo.edge', ''),
      fs.create('resources/views/nested/bar.edge', ''),
      fs.create('resources/views/nested/baz.edge', ''),
    ])

    const bundler = new Bundler(fs.baseUrl, ts, {
      metaFiles: [
        {
          pattern: 'resources/views/**/*.edge',
          reloadServer: false,
        },
      ],
    })

    await bundler.bundle(true, 'npm')

    await Promise.all([
      assert.fileExists('./build/resources/views/app.edge'),
      assert.fileExists('./build/resources/views/foo.edge'),
      assert.fileExists('./build/resources/views/nested/bar.edge'),
      assert.fileExists('./build/resources/views/nested/baz.edge'),
      assert.fileExists('./build/.adonisrc.json'),
      assert.fileExists('./build/package.json'),
      assert.fileExists('./build/package-lock.json'),
    ])
  })
})
