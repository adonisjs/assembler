/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { parse, Lang } from '@ast-grep/napi'
import { inspectClass, inspectClassMethods } from '../../src/helpers.ts'

test.group('Inspect class methods', () => {
  test('Inspect all methods of a class', ({ assert }) => {
    const root = parse(
      Lang.TypeScript,
      `class Foo {
        /**
         * Docblock comments
         */
        async foo() {}

        private bar(a, b, c) {
        }

        async #baz() {}

        protected fooBar(
          a,
          b,
          c
        ) {
        }

        /**
         * Declared as Property
         */
        hello = function() {}.bind(this)

        /**this method must exist*/ world() {}

        // commented out foo() {}
      }`
    ).root()

    const methods = inspectClassMethods(inspectClass(root)!).map((e) => {
      return e.find({ rule: { kind: 'property_identifier' } })?.text()
    })

    assert.deepEqual(methods, [
      'foo',
      'bar',
      /** Private methods are skipped */ undefined,
      'fooBar',
      'world',
    ])
  })
})
