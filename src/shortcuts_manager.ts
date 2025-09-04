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
 * Manages keyboard shortcuts for development server interaction.
 *
 * The ShortcutsManager provides a convenient way to handle keyboard inputs
 * during development, allowing users to restart servers, clear console,
 * open browsers, and perform other common development tasks through simple
 * key presses.
 *
 * @example
 * const shortcuts = new ShortcutsManager({
 *   logger: ui.logger,
 *   callbacks: {
 *     onRestart: () => server.restart(),
 *     onClear: () => console.clear(),
 *     onQuit: () => process.exit()
 *   }
 * })
 * shortcuts.setup()
 */
export class ShortcutsManager {
  /**
   * Logger instance for displaying messages
   */
  #logger: Logger

  /**
   * Callback functions for different keyboard shortcuts
   */
  #callbacks: KeyboardShortcutsCallbacks

  /**
   * The server URL used for opening browser
   */
  #serverUrl?: string

  /**
   * Key press event handler function
   */
  #keyPressHandler?: (data: Buffer) => void

  /**
   * Available keyboard shortcuts with their handlers
   */
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

  /**
   * Create a new ShortcutsManager instance
   *
   * @param options - Configuration options for the shortcuts manager
   */
  constructor(options: ShortcutsManagerOptions) {
    this.#logger = options.logger
    this.#callbacks = options.callbacks
  }

  /**
   * Set server url for opening in browser
   *
   * This URL will be used when the user presses 'o' to open the
   * development server in their default browser.
   *
   * @param url - The server URL to open when 'o' key is pressed
   */
  setServerUrl(url: string) {
    this.#serverUrl = url
  }

  /**
   * Initialize keyboard shortcuts by setting up raw mode on stdin
   *
   * This method enables raw mode on stdin to capture individual keypresses
   * and sets up the event listener for handling keyboard input. Only works
   * in TTY environments.
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
   * Handle key press events and execute corresponding shortcuts
   *
   * Processes individual key presses and matches them against registered
   * shortcuts. Also handles special key combinations like Ctrl+C and Ctrl+D.
   *
   * @param key - The pressed key as a string
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
   * Handle opening browser with the configured server URL
   *
   * Uses the 'open' package to launch the default browser and navigate
   * to the development server URL.
   */
  async #handleOpenBrowser() {
    this.#logger.log('')
    this.#logger.info(`Opening ${this.#serverUrl}...`)

    const { default: open } = await import('open')
    open(this.#serverUrl!)
  }

  /**
   * Show available keyboard shortcuts in the console
   *
   * Displays a formatted list of all available keyboard shortcuts
   * and their descriptions to help users understand what actions
   * are available.
   */
  showHelp() {
    this.#logger.log('')
    this.#logger.log('Available shortcuts:')

    this.#shortcuts.forEach(({ key, description }) => this.#logger.log(`· ${key}: ${description}`))
  }

  /**
   * Cleanup keyboard shortcuts and restore terminal state
   *
   * Disables raw mode on stdin, removes event listeners, and restores
   * the terminal to its normal state. Should be called when shutting down
   * the development server.
   */
  cleanup() {
    if (!process.stdin.isTTY) {
      return
    }

    process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdin.unref()
    process.stdin.removeListener('data', this.#keyPressHandler!)
    this.#keyPressHandler = undefined
  }
}
