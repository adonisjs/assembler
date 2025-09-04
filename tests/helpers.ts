/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type FileSystem } from '@japa/file-system'
import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'

export async function setupFakeAdonisproject(fs: FileSystem) {
  await Promise.all([
    fs.createJson('tsconfig.json', { compilerOptions: {} }),
    fs.create('start/kernel.ts', await readFile('./tests/fixtures/kernel.txt', 'utf-8')),
    fs.create('adonisrc.ts', await readFile('./tests/fixtures/adonisrc.txt', 'utf-8')),
    fs.create('start/env.ts', await readFile('./tests/fixtures/env.txt', 'utf-8')),
  ])
}

export const createControllers = test.macro(async (t) => {
  await Promise.all([
    t.context.fs.create('features/common/models/user.ts', ''),
    t.context.fs.create('features/auth/controllers/login_controller.ts', ''),
    t.context.fs.create('features/blog/controllers/posts_controller.ts', ''),
    t.context.fs.create('features/blog/models/post.ts', ''),
    t.context.fs.create('features/blog/models/comment.ts', ''),
    t.context.fs.create('features/blog/controllers/post_comments_controller.ts', ''),
    t.context.fs.create('app/controllers/posts_controller.ts', ''),
    t.context.fs.create('app/controllers/types.d.ts', ''),
    t.context.fs.create('app/controllers/README.md', ''),
    t.context.fs.create('app/controllers/api/auth/tokens_controller.ts', ''),
    t.context.fs.create('app/controllers/api/profile_controller.ts', ''),
    t.context.fs.create('app/controllers/public/home_controller.ts', ''),
  ])
})
