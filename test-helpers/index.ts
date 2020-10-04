/*
 * @adonisjs/assembler
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

export function toNewlineArray(contents: string): string[] {
	return contents.split(/\r?\n/)
}

export const info = process.env.CI ? '[ info ]' : '[ blue(info) ]'
export const success = process.env.CI ? '[ success ]' : '[ green(success) ]'
export const error = process.env.CI ? '[ error ]' : '[ red(error) ]'
export const warning = process.env.CI ? '[ warn ]' : '[ yellow(warn) ]'
export const dimYellow = (value: string) => `dim(yellow(${value}))`
