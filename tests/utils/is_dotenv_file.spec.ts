/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { isDotEnvFile } from '../../src/utils.js'

test.group('Helpers | Is DotEnv file', () => {
  test('check if file is a dot-env file', ({ assert }) => {
    assert.isTrue(isDotEnvFile('.env'))
    assert.isTrue(isDotEnvFile('.env.prod'))
    assert.isTrue(isDotEnvFile('.env.local'))
    assert.isFalse(isDotEnvFile('.env-file'))
  })
})
