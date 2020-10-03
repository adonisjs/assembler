/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import register from './src/requireHook'
register(process.env.ADONIS_ACE_CWD || process.cwd())
