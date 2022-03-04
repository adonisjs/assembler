/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export type JapaFlags = Partial<{
  '--tests': string[]
  '--tags': string[]
  '--groups': string[]
  '--ignore-tags': string[]
  '--files': string[]
  '--timeout': number
  '--suites': string[]
  '--force-exit': boolean
}>
