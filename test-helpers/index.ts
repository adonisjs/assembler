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

export const icons =
	process.platform === 'win32'
		? {
				info: 'i',
				success: '✔',
				error: '✖',
				warning: '⚠',
		  }
		: {
				info: 'ℹ',
				success: '✔',
				error: '✖',
				warning: '⚠',
		  }

export const info = process.env.CI ? icons.info : `blue(${icons.info})`
export const success = process.env.CI ? icons.success : `green(${icons.success})`
export const error = process.env.CI ? icons.error : `red(${icons.error})`
export const warning = process.env.CI ? icons.warning : `yellow(${icons.warning})`
