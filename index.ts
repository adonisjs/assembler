/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { join } from 'path'
import { fsReadAll } from '@poppinss/utils/build'
import { Manifest } from '@adonisjs/ace'

new Manifest(__dirname).generate(
  fsReadAll(
    join(__dirname, './commands'),
    (file) => !file.includes('Base') && file.endsWith('.js')
  ).map(file => `./commands/${file}`)
)
