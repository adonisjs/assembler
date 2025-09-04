/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { join, relative } from 'node:path'
import { IndexGenerator } from '../src/index_generator/main.ts'

test.group('Index generator', () => {
  test('create index from flat and nested files', async ({ assert, fs }) => {
    const outputPath = './.adonisjs/backend/controllers.ts'

    await fs.create('app/controllers/posts_controller.ts', '')
    await fs.create('app/controllers/user/posts_controller.ts', '')
    await fs.create('app/controllers/auth/signup_controller.ts', '')
    await fs.create('app/controllers/public/home_page.ts', '')

    const transformer = new IndexGenerator(fs.basePath)
    transformer.add('controllers', {
      as: 'barrelFile',
      exportName: 'controllers',
      output: outputPath,
      source: 'app/controllers',
      importAlias: '#controllers',
    })
    await transformer.generate()

    assert.snapshot(await fs.contents(outputPath)).matchInline(`
      "export const controllers = {
        'auth': {
          'SignupController': () => import('#controllers/auth/signup_controller'),
        },
        'PostsController': () => import('#controllers/posts_controller'),
        'public': {
          'HomePage': () => import('#controllers/public/home_page'),
        },
        'user': {
          'PostsController': () => import('#controllers/user/posts_controller'),
        },
      }"
    `)
  })

  test('create index without the import alias', async ({ assert, fs }) => {
    const outputPath = './.adonisjs/backend/controllers.ts'

    await fs.create('app/controllers/posts_controller.ts', '')
    await fs.create('app/controllers/user/posts_controller.ts', '')
    await fs.create('app/controllers/auth/signup_controller.ts', '')
    await fs.create('app/controllers/public/home_page.ts', '')

    const transformer = new IndexGenerator(fs.basePath)
    transformer.add('controllers', {
      as: 'barrelFile',
      exportName: 'controllers',
      output: outputPath,
      source: 'app/controllers',
    })
    await transformer.generate()

    assert.snapshot(await fs.contents(outputPath)).matchInline(`
      "export const controllers = {
        'auth': {
          'SignupController': () => import('../../app/controllers/auth/signup_controller.ts'),
        },
        'PostsController': () => import('../../app/controllers/posts_controller.ts'),
        'public': {
          'HomePage': () => import('../../app/controllers/public/home_page.ts'),
        },
        'user': {
          'PostsController': () => import('../../app/controllers/user/posts_controller.ts'),
        },
      }"
    `)
  })

  test('remove name suffix', async ({ assert, fs }) => {
    const outputPath = './.adonisjs/backend/controllers.ts'

    await fs.create('app/controllers/posts_controller.ts', '')
    await fs.create('app/controllers/user/posts_controller.ts', '')
    await fs.create('app/controllers/auth/signup_controller.ts', '')
    await fs.create('app/controllers/public/home_page.ts', '')

    const transformer = new IndexGenerator(fs.basePath)
    transformer.add('controllers', {
      as: 'barrelFile',
      exportName: 'controllers',
      output: outputPath,
      removeSuffix: 'controller',
      importAlias: '#controllers',
      source: 'app/controllers',
    })
    await transformer.generate()

    assert.snapshot(await fs.contents(outputPath)).matchInline(`
      "export const controllers = {
        'auth': {
          'Signup': () => import('#controllers/auth/signup_controller'),
        },
        'Posts': () => import('#controllers/posts_controller'),
        'public': {
          'HomePage': () => import('#controllers/public/home_page'),
        },
        'user': {
          'Posts': () => import('#controllers/user/posts_controller'),
        },
      }"
    `)
  })

  test('self compute output', async ({ assert, fs }) => {
    const outputPath = './.adonisjs/server/inertia.d.ts'

    await fs.create('inertia/pages/home.tsx', '')
    await fs.create('inertia/pages/blog/posts/index.tsx', '')
    await fs.create('inertia/pages/blog/comments/index.tsx', '')
    await fs.create('inertia/pages/blog/comments/show.tsx', '')

    const transformer = new IndexGenerator(fs.basePath)
    transformer.add('inertiaPages', {
      as(vfs, buffer) {
        const list = vfs.asList({
          transformValue(filePath) {
            return `InferPageProps<typeof import('${relative(join(fs.basePath, outputPath), filePath)}').default>`
          },
        })

        buffer.write(`declare module '@adonisjs/inertia' {`).indent()
        buffer.write(`interface Pages {`).indent()
        Object.keys(list).forEach((key) => {
          buffer.write(`'${key}': ${list[key]}`)
        })
        buffer.dedent().write(`}`)
        buffer.dedent().write(`}`)
      },
      output: outputPath,
      source: 'inertia/pages',
    })
    await transformer.generate()

    assert.snapshot(await fs.contents(outputPath)).matchInline(`
      "declare module '@adonisjs/inertia' {
        interface Pages {
          'blog/comments/index': InferPageProps<typeof import('../../../inertia/pages/blog/comments/index.tsx').default>
          'blog/comments/show': InferPageProps<typeof import('../../../inertia/pages/blog/comments/show.tsx').default>
          'blog/posts/index': InferPageProps<typeof import('../../../inertia/pages/blog/posts/index.tsx').default>
          'home': InferPageProps<typeof import('../../../inertia/pages/home.tsx').default>
        }
      }"
    `)
  })
})
