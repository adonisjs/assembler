/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { type Logger } from '@poppinss/cliui'
import {
  type KeyboardShortcut,
  type ShortcutsManagerOptions,
  type KeyboardShortcutsCallbacks,
} from './types/common.ts'

/**
 * Manages keyboard shortcuts for development server
 */
export class ShortcutsManager {
  #logger: Logger
  #callbacks: KeyboardShortcutsCallbacks
  #serverUrl?: string
  #keyPressHandler?: (data: Buffer) => void

  #shortcuts: KeyboardShortcut[] = [
    {
      key: 'r',
      description: 'restart server',
      handler: () => {
        this.#logger.log('')
        this.#logger.info('Manual restart triggered...')
        this.#callbacks.onRestart()
      },
    },
    {
      key: 'c',
      description: 'clear console',
      handler: () => {
        this.#callbacks.onClear()
        this.#logger.info('Console cleared')
      },
    },
    {
      key: 'o',
      description: 'open in browser',
      handler: () => this.#handleOpenBrowser(),
    },
    {
      key: 'h',
      description: 'show this help',
      handler: () => this.showHelp(),
    },
  ]

  constructor(options: ShortcutsManagerOptions) {
    this.#logger = options.logger
    this.#callbacks = options.callbacks
  }

  /**
   * Set server url for opening in browser
   */
  setServerUrl(url: string) {
    this.#serverUrl = url
  }

  /**
   * Initialize keyboard shortcuts
   */
  setup() {
    if (!process.stdin.isTTY) {
      return
    }

    process.stdin.setRawMode(true)
    this.#keyPressHandler = (data: Buffer) => this.#handleKeyPress(data.toString())
    process.stdin.on('data', this.#keyPressHandler)
  }

  /**
   * Handle key press events
   */
  #handleKeyPress(key: string) {
    // Handle Ctrl+C (0x03) and Ctrl+D (0x04)
    if (key === '\u0003' || key === '\u0004') {
      return this.#callbacks.onQuit()
    }

    const shortcut = this.#shortcuts.find((s) => s.key === key)
    if (shortcut) {
      shortcut.handler()
    }
  }

  /**
   * Handle opening browser
   */
  async #handleOpenBrowser() {
    this.#logger.log('')
    this.#logger.info(`Opening ${this.#serverUrl}...`)

    const { default: open } = await import('open')
    open(this.#serverUrl!)
  }

  /**
   * Show available keyboard shortcuts
   */
  showHelp() {
    this.#logger.log('')
    this.#logger.log('Available shortcuts:')

    this.#shortcuts.forEach(({ key, description }) => this.#logger.log(`· ${key}: ${description}`))
  }

  /**
   * Cleanup keyboard shortcuts
   */
  cleanup() {
    if (!process.stdin.isTTY) {
      return
    }

    process.stdin.setRawMode(false)
    process.stdin.removeListener('data', this.#keyPressHandler!)
    this.#keyPressHandler = undefined
  }
}
