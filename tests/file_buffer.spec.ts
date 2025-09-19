/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { FileBuffer } from '../src/file_buffer.ts'

test.group('File buffer', () => {
  test('use nested file buffers', ({ assert }) => {
    const buffer = new FileBuffer()
    const importsBuffer = buffer.create()

    buffer.write(importsBuffer)
    buffer.write('export namespace {').indent()
    buffer.dedent().write('}')

    importsBuffer.write(`import foo from './foo.ts'`)
    importsBuffer.write(`import bar from './bar.ts'`)

    assert.snapshot(buffer.flush()).matchInline(`
      "import foo from './foo.ts'
      import bar from './bar.ts'
      export namespace {
      }"
    `)
  })

  test('use nested file buffers with a line break', ({ assert }) => {
    const buffer = new FileBuffer()
    const importsBuffer = buffer.create()

    buffer.writeLine(importsBuffer)
    buffer.write('export namespace {').indent()
    buffer.dedent().write('}')

    importsBuffer.write(`import foo from './foo.ts'`)
    importsBuffer.write(`import bar from './bar.ts'`)

    assert.snapshot(buffer.flush()).matchInline(`
      "import foo from './foo.ts'
      import bar from './bar.ts'

      export namespace {
      }"
    `)
  })
})
