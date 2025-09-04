/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { debuglog } from 'node:util'

/**
 * Debug logger for the AdonisJS assembler package.
 * 
 * This debug instance is configured to log messages under the 'adonisjs:assembler'
 * namespace. Debug messages are only shown when the NODE_DEBUG environment variable
 * includes 'adonisjs:assembler'.
 * 
 * @example
 * // Enable debug logging
 * // NODE_DEBUG=adonisjs:assembler node ace serve
 * debug('Starting development server...')
 */
export default debuglog('adonisjs:assembler')
