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

export function replaceFactoryBindings(source: string, model: string, importPath: string) {
  return toNewlineArray(
    source
      .replace('{{{ modelImportPath }}}', importPath)
      .replace(/{{#toModelName}}{{{ model }}}{{\/toModelName}}/gi, model)
  )
}

export const info = '[ blue(info) ]'
export const success = '[ green(success) ]'
export const error = '[ red(error) ]'
export const warning = '[ yellow(warn) ]'
export const dimYellow = (value: string) => `dim(yellow(${value}))`
