/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { register } from '@adonisjs/require-ts'

/**
 * Exports the function to be used for registering require hook
 * for AdonisJS applications
 */
export default function registerForAdonis(appRoot: string) {
  return register(appRoot, {
    cache: true,
    transformers: {
      after: [
        {
          transform: '@adonisjs/assembler/build/src/requireHook/ioc-transformer',
        },
      ],
    },
  })
}
