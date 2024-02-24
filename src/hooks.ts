import {
  AssemblerHookNode,
  SourceFileChangedHookHandler,
  AssemblerHookHandler,
  RcFile,
} from '@adonisjs/application/types'
import { RuntimeException } from '@poppinss/utils'
import Hooks from '@poppinss/hooks'

export class AssemblerHooks {
  #config: RcFile['unstable_assembler']

  #hooks = new Hooks<{
    onDevServerStarted: [Parameters<AssemblerHookHandler>, []]
    onSourceFileChanged: [Parameters<SourceFileChangedHookHandler>, []]
    onBuildStarting: [Parameters<AssemblerHookHandler>, []]
    onBuildCompleted: [Parameters<AssemblerHookHandler>, []]
  }>()

  constructor(config: RcFile['unstable_assembler']) {
    this.#config = config
  }

  /**
   * Resolve the hook by importing the file and returning the default export
   */
  async #resolveHookNode(node: AssemblerHookNode<any>) {
    const exports = await node()

    if (!exports.default) {
      throw new RuntimeException('Assembler hook must be defined using the default export')
    }

    return exports.default
  }

  /**
   * Resolve hooks needed for dev-time and register them to the Hooks instance
   */
  async registerDevServerHooks() {
    await Promise.all([
      this.#config?.onDevServerStarted?.map(async (node) =>
        this.#hooks.add('onDevServerStarted', await this.#resolveHookNode(node))
      ),
      this.#config?.onSourceFileChanged?.map(async (node) =>
        this.#hooks.add('onSourceFileChanged', await this.#resolveHookNode(node))
      ),
    ])
  }

  /**
   * Resolve hooks needed for build-time and register them to the Hooks instance
   */
  async registerBuildHooks() {
    await Promise.all([
      this.#config?.onBuildStarting?.map(async (node) =>
        this.#hooks.add('onBuildStarting', await this.#resolveHookNode(node))
      ),
      this.#config?.onBuildCompleted?.map(async (node) =>
        this.#hooks.add('onBuildCompleted', await this.#resolveHookNode(node))
      ),
    ])
  }

  /**
   * When the dev server is started
   */
  async onDevServerStarted(...args: Parameters<AssemblerHookHandler>) {
    await this.#hooks.runner('onDevServerStarted').run(...args)
  }

  /**
   * When a source file changes
   */
  async onSourceFileChanged(...args: Parameters<SourceFileChangedHookHandler>) {
    await this.#hooks.runner('onSourceFileChanged').run(...args)
  }

  /**
   * When the build process is starting
   */
  async onBuildStarting(...args: Parameters<AssemblerHookHandler>) {
    await this.#hooks.runner('onBuildStarting').run(...args)
  }

  /**
   * When the build process is completed
   */
  async onBuildCompleted(...args: Parameters<AssemblerHookHandler>) {
    await this.#hooks.runner('onBuildCompleted').run(...args)
  }
}
