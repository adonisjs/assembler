import { Application } from '@adonisjs/application'
import { test } from '@japa/runner'
import { Filesystem } from '@poppinss/dev-utils'
import { join } from 'path'
import { AssetsBundlerManager } from '../src/Assets/AssetsBundlerManager'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('Assets Bundler Manage', (group) => {
  group.each.teardown(() => fs.cleanup())

  group.tap((t) => t.pin())

  test('Should throw if cant detect bundler', async ({ assert }) => {
    assert.plan(1)
    const app = new Application(fs.basePath, 'test', {})

    try {
      new AssetsBundlerManager(app)
    } catch (err) {
      assert.deepEqual(err.code, 'E_UNABLE_TO_DETECT_ASSETS_BUNDLER')
    }
  })

  test('Should pick the one defined in RC file', async ({ assert }) => {
    const app = new Application(fs.basePath, 'test', {})
    app.rcFile.assetsDriver = 'vite'

    const manager = new AssetsBundlerManager(app)
    assert.deepEqual(manager.driver.name, 'vite')
  })

  test('should auto detect vite based on conf files', async ({ assert }) => {
    await fs.add('vite.config.ts', '')
    const app = new Application(fs.basePath, 'test', {})

    const manager = new AssetsBundlerManager(app)
    assert.deepEqual(manager.driver.name, 'vite')
  })

  test('should auto detect encore based on conf files', async ({ assert }) => {
    await fs.add('webpack.config.js', '')
    const app = new Application(fs.basePath, 'test', {})

    const manager = new AssetsBundlerManager(app)
    assert.deepEqual(manager.driver.name, 'encore')
  })
})
