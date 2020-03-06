/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import { Manifest } from '@adonisjs/ace'
new Manifest(__dirname).generate([
  './commands/Build',
  './commands/Serve',
  './commands/Invoke',
  './commands/Make/Command',
  './commands/Make/Controller',
  './commands/Make/Middleware',
  './commands/Make/Provider',
  './commands/Make/Validator',
  './commands/Make/View',
])
