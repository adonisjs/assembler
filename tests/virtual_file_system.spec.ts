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
import string from '@poppinss/utils/string'
import StringBuilder from '@poppinss/utils/string_builder'
import { createControllers, setupFakeAdonisproject } from './helpers.ts'

import { VirtualFileSystem } from '../src/virtual_file_system.ts'

test.group('Virtual file system', () => {
  test('list files from a source directory', async ({ fs, assert }) => {
    await setupFakeAdonisproject(fs)
    await createControllers()

    const source = string.toUnixSlash(join(fs.basePath, 'app/controllers'))
    const vfs = new VirtualFileSystem(source)
    await vfs.scan()

    assert.deepEqual(vfs.asList(), {
      'api/auth/tokens_controller': join(source, 'api/auth/tokens_controller.ts'),
      'api/profile_controller': join(source, 'api/profile_controller.ts'),
      'public/home_controller': join(source, 'public/home_controller.ts'),
      'posts_controller': join(source, 'posts_controller.ts'),
    })

    assert.deepEqual(
      vfs.asList({
        transformKey: (key) => new StringBuilder(key).removeSuffix('controller').toString(),
      }),
      {
        'api/auth/tokens': join(source, 'api/auth/tokens_controller.ts'),
        'api/profile': join(source, 'api/profile_controller.ts'),
        'public/home': join(source, 'public/home_controller.ts'),
        'posts': join(source, 'posts_controller.ts'),
      }
    )
  })

  test('list files as a tree', async ({ fs, assert }) => {
    await setupFakeAdonisproject(fs)
    await createControllers()

    const source = string.toUnixSlash(join(fs.basePath, 'app/controllers'))
    const vfs = new VirtualFileSystem(source)
    await vfs.scan()

    assert.deepEqual(vfs.asTree(), {
      api: {
        auth: {
          tokens_controller: join(source, 'api/auth/tokens_controller.ts'),
        },
        profile_controller: join(source, 'api/profile_controller.ts'),
      },
      public: {
        home_controller: join(source, 'public/home_controller.ts'),
      },
      posts_controller: join(source, 'posts_controller.ts'),
    })

    assert.deepEqual(
      vfs.asTree({
        transformKey: (key) => new StringBuilder(key).removeSuffix('controller').toString(),
      }),
      {
        api: {
          auth: {
            tokens: join(source, 'api/auth/tokens_controller.ts'),
          },
          profile: join(source, 'api/profile_controller.ts'),
        },
        public: {
          home: join(source, 'public/home_controller.ts'),
        },
        posts: join(source, 'posts_controller.ts'),
      }
    )
  })

  test('use glob to filter files', async ({ fs, assert }) => {
    await setupFakeAdonisproject(fs)
    await createControllers()

    const source = string.toUnixSlash(join(fs.basePath, 'features'))
    const vfs = new VirtualFileSystem(source, {
      glob: ['**/controllers/*.ts'],
    })
    await vfs.scan()

    /**
     * Will be added
     */
    vfs.add(join(source, 'common/controllers/health_controller.ts'))

    /**
     * Will be ignored, since not a controller
     */
    vfs.add(join(source, 'newsletter/models/subscriber.ts'))

    /**
     * Will be ignored, since outside of the source directory
     */
    vfs.add(join(source, '../controllers/users_controller.ts'))

    assert.deepEqual(vfs.asList(), {
      'common/controllers/health_controller': join(
        source,
        'common/controllers/health_controller.ts'
      ),
      'auth/controllers/login_controller': join(source, 'auth/controllers/login_controller.ts'),
      'blog/controllers/post_comments_controller': join(
        source,
        'blog/controllers/post_comments_controller.ts'
      ),
      'blog/controllers/posts_controller': join(source, 'blog/controllers/posts_controller.ts'),
    })
  })

  test('filter files using the filter fn', async ({ fs, assert }) => {
    await setupFakeAdonisproject(fs)
    await createControllers()

    const source = string.toUnixSlash(join(fs.basePath, 'app/controllers'))
    const vfs = new VirtualFileSystem(source, {
      filter: (path, isDirectory) => {
        if (isDirectory) {
          return true
        }
        if (path.endsWith('posts_controller.ts')) {
          return false
        }
        return true
      },
    })
    await vfs.scan()

    assert.deepEqual(vfs.asList(), {
      'api/auth/tokens_controller': join(source, 'api/auth/tokens_controller.ts'),
      'api/profile_controller': join(source, 'api/profile_controller.ts'),
      'public/home_controller': join(source, 'public/home_controller.ts'),
    })

    assert.deepEqual(
      vfs.asList({
        transformKey: (key) => new StringBuilder(key).removeSuffix('controller').toString(),
      }),
      {
        'api/auth/tokens': join(source, 'api/auth/tokens_controller.ts'),
        'api/profile': join(source, 'api/profile_controller.ts'),
        'public/home': join(source, 'public/home_controller.ts'),
      }
    )
  })

  test('apply the filter fn when adding a file', ({ fs, assert }) => {
    const source = string.toUnixSlash(join(fs.basePath, 'app/controllers'))
    const vfs = new VirtualFileSystem(source, {
      filter: (path, isDirectory) => isDirectory || !path.endsWith('posts_controller.ts'),
    })

    assert.isFalse(vfs.add(join(source, 'posts_controller.ts')))
    assert.deepEqual(vfs.asList(), {})
  })

  test('refuse a file from a prefixed sibling directory', ({ fs, assert }) => {
    const source = string.toUnixSlash(join(fs.basePath, 'source'))
    const vfs = new VirtualFileSystem(source)

    assert.isFalse(vfs.add(join(fs.basePath, 'source-other/file.ts')))
    assert.deepEqual(vfs.asList(), {})
  })

  test('get file contents as ast and cache it', async ({ fs, assert }) => {
    await setupFakeAdonisproject(fs)
    await createControllers()

    const source = string.toUnixSlash(join(fs.basePath, 'app/controllers'))
    const vfs = new VirtualFileSystem(source, {})

    await vfs.scan()

    const ast = await vfs.get(join(source, 'posts_controller.ts'))
    const cachedAst = await vfs.get(join(source, 'posts_controller.ts'))
    assert.strictEqual(ast, cachedAst)

    vfs.invalidate()
    const newAst = await vfs.get(join(source, 'posts_controller.ts'))
    assert.notStrictEqual(ast, newAst)
  })

  test('clear files from virtual memory', async ({ fs, assert }) => {
    await setupFakeAdonisproject(fs)
    await createControllers()

    const source = string.toUnixSlash(join(fs.basePath, 'app/controllers'))
    const vfs = new VirtualFileSystem(source)
    await vfs.scan()

    assert.deepEqual(vfs.asList(), {
      'api/auth/tokens_controller': join(source, 'api/auth/tokens_controller.ts'),
      'api/profile_controller': join(source, 'api/profile_controller.ts'),
      'public/home_controller': join(source, 'public/home_controller.ts'),
      'posts_controller': join(source, 'posts_controller.ts'),
    })

    vfs.clear()
    assert.deepEqual(vfs.asList(), {})
  })

  test('scan files when absolute path contains a dot-prefixed directory', async ({
    fs,
    assert,
  }) => {
    await fs.create('.claude/worktrees/my-app/app/controllers/users_controller.ts', '')
    await fs.create('.claude/worktrees/my-app/app/controllers/posts_controller.ts', '')
    await fs.create('.claude/worktrees/my-app/app/controllers/api/auth_controller.ts', '')

    const source = string.toUnixSlash(join(fs.basePath, '.claude/worktrees/my-app/app/controllers'))
    const vfs = new VirtualFileSystem(source)
    await vfs.scan()

    assert.deepEqual(vfs.asList(), {
      'users_controller': join(source, 'users_controller.ts'),
      'posts_controller': join(source, 'posts_controller.ts'),
      'api/auth_controller': join(source, 'api/auth_controller.ts'),
    })
  })
})
