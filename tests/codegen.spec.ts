/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'

import { CodeGen } from '../index.ts'
import { type RoutesListItem } from '../src/types/code_scanners.ts'

/**
 * Every fixture lives inside a dedicated sub directory. Node caches the
 * "package.json" it discovers for a directory, so writing one at the shared
 * tmp root would leak the subpath imports of these tests into the other specs.
 */
const CWD = 'codegen/'

const PKG_JSON = JSON.stringify({
  type: 'module',
  imports: { '#controllers/*': './app/controllers/*.js' },
})

const ROUTES: Record<string, RoutesListItem[]> = {
  root: [
    {
      name: 'users.index',
      pattern: '/users',
      domain: 'root',
      methods: ['GET'],
      handler: {
        method: 'index',
        importExpression: `() => import('#controllers/users_controller')`,
      },
      tokens: [{ val: '/users', old: '/users', type: 0, end: '' }],
    },
  ],
}

test.group('CodeGen', () => {
  test('generate index files from the init hooks', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
      fs.create(`${CWD}app/controllers/users_controller.ts`, ''),
    ])

    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        init: [
          async () => ({
            default: (_, __, indexGenerator) => {
              indexGenerator.add('controllers', {
                as: 'barrelFile',
                output: '.adonisjs/server/controllers.ts',
                exportName: 'controllers',
                source: 'app/controllers',
                importAlias: '#controllers',
              })
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await codegen.run()

    await assert.fileExists(`${CWD}.adonisjs/server/controllers.ts`)
    await assert.fileContains(`${CWD}.adonisjs/server/controllers.ts`, [
      `UsersController: () => import('#controllers/users_controller')`,
    ])
  })

  test('run codegen without any hooks registered', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
    ])

    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {})
    codegen.ui.switchMode('raw')

    await codegen.run()
    assert.isDefined(codegen.indexGenerator)
    assert.isUndefined(codegen.routesScanner)
  })

  test('pass itself as the parent to the init hooks', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
    ])

    let parent: unknown
    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        init: [
          async () => ({
            default: (instance) => {
              parent = instance
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await codegen.run()

    assert.strictEqual(parent, codegen)
  })

  test('share routes with the routesCommitted hook', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
    ])

    let sharedRoutes: unknown
    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        routesCommitted: [
          async () => ({
            default: (_, routes) => {
              sharedRoutes = routes
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await codegen.run(() => ({ routes: ROUTES }))

    assert.deepEqual(sharedRoutes, ROUTES)
  })

  test('scan routes when a scanning hook is registered', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
      fs.create(
        `${CWD}app/controllers/users_controller.ts`,
        `export default class UsersController {
          index() {}
        }`
      ),
    ])

    const stack: string[] = []
    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        routesScanning: [
          async () => ({
            default: () => {
              stack.push('scanning')
            },
          }),
        ],
        routesScanned: [
          async () => ({
            default: (_, scanner) => {
              stack.push('scanned')
              assert.lengthOf(scanner.getScannedRoutes(), 1)
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await codegen.run(() => ({ routes: ROUTES }))

    assert.deepEqual(stack, ['scanning', 'scanned'])
    assert.isDefined(codegen.routesScanner)
  })

  test('do not scan routes when no hook is interested in them', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
    ])

    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {})
    codegen.ui.switchMode('raw')

    await codegen.run(() => ({ routes: ROUTES }))
    assert.isUndefined(codegen.routesScanner)
  })

  test('skip the routes stage when no snapshot is supplied', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
    ])

    let committed = false
    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        routesCommitted: [
          async () => ({
            default: () => {
              committed = true
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await codegen.run()

    assert.isFalse(committed)
  })

  test('write the index files before collecting the snapshot', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
      fs.create(`${CWD}app/controllers/users_controller.ts`, ''),
    ])

    /**
     * An application imports the generated barrel files from its preload files,
     * so they must exist on disk by the time the caller boots the app
     */
    let barrelExistsDuringSnapshot = false

    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        init: [
          async () => ({
            default: (_, __, indexGenerator) => {
              indexGenerator.add('controllers', {
                as: 'barrelFile',
                output: '.adonisjs/server/controllers.ts',
                exportName: 'controllers',
                source: 'app/controllers',
                importAlias: '#controllers',
              })
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await codegen.run(async () => {
      barrelExistsDuringSnapshot = await fs.exists(`${CWD}.adonisjs/server/controllers.ts`)
      return {}
    })

    assert.isTrue(barrelExistsDuringSnapshot)
  })

  test('bubble up errors thrown by the hooks', async ({ assert, fs }) => {
    await Promise.all([
      fs.create(`${CWD}adonisrc.ts`, 'export default {}'),
      fs.create(`${CWD}package.json`, PKG_JSON),
    ])

    const codegen = new CodeGen(new URL(CWD, fs.baseUrl), {
      hooks: {
        init: [
          async () => ({
            default: () => {
              throw new Error('Hook failed')
            },
          }),
        ],
      },
    })

    codegen.ui.switchMode('raw')
    await assert.rejects(() => codegen.run(), 'Hook failed')
  })
})
