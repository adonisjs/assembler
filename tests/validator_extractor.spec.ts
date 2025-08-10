/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { extractValidator } from '../src/code_scanners/routes_scanner/validator_extractor.ts'

test.group('Validator extractor', () => {
  test('extract validator for a given method inside a class', async ({ assert }) => {
    await extractValidator(
      `
    import { createUserValidator } from '#validators/user'

    class UsersController {
      async store({ request }: HttpContext) {
        const payload = await request.validateUsing(
          /** This validator should not be duplicated */
          createUserValidator
        )
      }

      async update({ request }: HttpContext) {
        await request.validateUsing(updateUserValidator)
      }

      async destroy({ request }: HttpContext) {
        await request.validateUsing(updateUserValidator)
      }
    }
    `,
      'store'
    )
  })
})
