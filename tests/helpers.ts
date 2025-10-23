/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { sep } from 'node:path'
import { platform } from 'node:os'
import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { type FileSystem } from '@japa/file-system'

export async function setupFakeAdonisproject(fs: FileSystem) {
  await Promise.all([
    fs.createJson('tsconfig.json', { compilerOptions: {}, include: ['**/*'], exclude: [] }),
    fs.createJson('package.json', {
      hotHook: {
        boundaries: ['./app/controllers/**/*.ts'],
      },
      type: 'module',
      imports: {
        '#start/*': './start/*.js',
      },
    }),
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

/**
 * When filePath using backward slashes is written to a file, the backslashes
 * are considered as escape charcaters, hence results in a wrong path.
 *
 * This method replaces the backward slashes with two backward slashes
 */
export function normalizePathForWindows(filePath: string) {
  if (platform() === 'win32') {
    filePath = filePath.split(sep).join('\\\\')
  }
  return filePath
}
