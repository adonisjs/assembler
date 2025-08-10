/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Cache from 'tmp-cache'
import { isJunk } from 'junk'
import fastGlob from 'fast-glob'
import Hooks from '@poppinss/hooks'
import { existsSync } from 'node:fs'
import getRandomPort from 'get-port'
import type tsStatic from 'typescript'
import { fileURLToPath } from 'node:url'
import { execaNode, execa } from 'execa'
import { parseImports } from 'parse-imports'
import { type SgNode } from '@ast-grep/napi'
import { importDefault } from '@poppinss/utils'
import { copyFile, mkdir } from 'node:fs/promises'
import { EnvLoader, EnvParser } from '@adonisjs/env'
import chokidar, { type ChokidarOptions } from 'chokidar'
import { type UnWrapLazyImport } from '@poppinss/utils/types'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'

import debug from './debug.ts'
import type { Import, RunScriptOptions } from './types/common.ts'
import {
  type WatcherHooks,
  type BundlerHooks,
  type DevServerHooks,
  type TestRunnerHooks,
} from './types/hooks.ts'

/**
 * Default set of args to pass in order to run TypeScript
 * source. Used by "run" and "runNode" scripts
 */
const DEFAULT_NODE_ARGS = ['--import=@poppinss/ts-exec', '--enable-source-maps']

/**
 * Parses tsconfig.json and prints errors using typescript compiler
 * host
 */
export function parseConfig(
  cwd: URL | string,
  ts: typeof tsStatic
): tsStatic.ParsedCommandLine | undefined {
  const cwdPath = typeof cwd === 'string' ? cwd : fileURLToPath(cwd)
  const configFile = join(cwdPath, 'tsconfig.json')
  debug('parsing config file "%s"', configFile)

  let hardException: null | tsStatic.Diagnostic = null
  const parsedConfig = ts.getParsedCommandLineOfConfigFile(
    configFile,
    {},
    {
      ...ts.sys,
      useCaseSensitiveFileNames: true,
      getCurrentDirectory: () => cwdPath,
      onUnRecoverableConfigFileDiagnostic: (error) => (hardException = error),
    }
  )

  if (hardException) {
    const compilerHost = ts.createCompilerHost({})
    console.log(ts.formatDiagnosticsWithColorAndContext([hardException], compilerHost))
    return
  }

  if (parsedConfig!.errors.length) {
    const compilerHost = ts.createCompilerHost({})
    console.log(ts.formatDiagnosticsWithColorAndContext(parsedConfig!.errors, compilerHost))
    return
  }

  return parsedConfig
}

/**
 * Runs a Node.js script as a child process and inherits the stdio streams
 */
export function runNode(cwd: string | URL, options: RunScriptOptions) {
  const childProcess = execaNode(options.script, options.scriptArgs, {
    nodeOptions: DEFAULT_NODE_ARGS.concat(options.nodeArgs),
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    reject: options.reject ?? false,
    buffer: false,
    stdio: options.stdio || 'inherit',
    env: {
      ...(options.stdio === 'pipe' ? { FORCE_COLOR: 'true' } : {}),
      ...options.env,
    },
  })

  return childProcess
}

/**
 * Runs a script as a child process and inherits the stdio streams
 */
export function run(cwd: string | URL, options: Omit<RunScriptOptions, 'nodeArgs'>) {
  const childProcess = execa(options.script, options.scriptArgs, {
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    buffer: false,
    stdio: options.stdio || 'inherit',
    env: {
      ...(options.stdio === 'pipe' ? { FORCE_COLOR: 'true' } : {}),
      ...options.env,
    },
  })

  return childProcess
}

/**
 * Watches the file system using tsconfig file
 */
export function watch(options: ChokidarOptions) {
  return chokidar.watch(['.'], options)
}

/**
 * Check if file is a .env file
 */
export function isDotEnvFile(filePath: string) {
  if (filePath === '.env') {
    return true
  }

  return filePath.includes('.env.')
}

/**
 * Returns the port to use after inspect the dot-env files inside
 * a given directory.
 *
 * A random port is used when the specified port is in use. Following
 * is the logic for finding a specified port.
 *
 * - The "process.env.PORT" value is used if exists.
 * - The dot-env files are loaded using the "EnvLoader" and the PORT
 *   value is used by iterating over all the loaded files. The
 *   iteration stops after first find.
 */
export async function getPort(cwd: URL): Promise<number> {
  /**
   * Use existing port if exists
   */
  if (process.env.PORT) {
    return getRandomPort({ port: Number(process.env.PORT) })
  }

  /**
   * Loop over files and use the port from their contents. Stops
   * after first match
   */
  const files = await new EnvLoader(cwd).load()
  for (let file of files) {
    const envVariables = await new EnvParser(file.contents).parse()
    if (envVariables.PORT) {
      return getRandomPort({ port: Number(envVariables.PORT) })
    }
  }

  /**
   * Use 3333 as the port
   */
  return getRandomPort({ port: 3333 })
}

/**
 * Helper function to copy files from relative paths or glob
 * patterns
 */
export async function copyFiles(files: string[], cwd: string, outDir: string) {
  /**
   * Looping over files and create a new collection with paths
   * and glob patterns
   */
  const { paths, patterns } = files.reduce<{ patterns: string[]; paths: string[] }>(
    (result, file) => {
      /**
       * If file is a glob pattern, then push it to patterns
       */
      if (fastGlob.isDynamicPattern(file)) {
        result.patterns.push(file)
        return result
      }

      /**
       * Otherwise, check if file exists and push it to paths to copy
       */
      if (existsSync(join(cwd, file))) {
        result.paths.push(file)
      }

      return result
    },
    { patterns: [], paths: [] }
  )

  debug('copyFiles inputs: %O, paths: %O, patterns: %O', files, paths, patterns)

  /**
   * Getting list of relative paths from glob patterns
   */
  const filePaths = paths.concat(await fastGlob(patterns, { cwd, dot: true })).filter((file) => {
    return !isJunk(basename(file))
  })

  /**
   * Finally copy files to the destination by keeping the same
   * directory structure and ignoring junk files
   */
  debug('copying files %O to destination "%s"', filePaths, outDir)
  const copyPromises = filePaths.map(async (file) => {
    const src = isAbsolute(file) ? file : join(cwd, file)
    const dest = join(outDir, relative(cwd, src))

    await mkdir(dirname(dest), { recursive: true })
    return copyFile(src, dest)
  })

  return await Promise.all(copyPromises)
}

/**
 * Memoize a function using an LRU cache. The function must accept
 * only one argument as a string value.
 */
export function memoize<Result>(
  fn: (input: string) => any,
  maxKeys?: number
): (input: string) => Result {
  const cache = new Cache<string, Result>({ max: maxKeys })

  return (input: string) => {
    if (cache.has(input)) {
      return cache.get(input)!
    }
    return fn(input)
  }
}

/**
 * Imports a selected set of lazy hooks and creates an instance of the
 * Hooks class
 */
type AllHooks = WatcherHooks & DevServerHooks & BundlerHooks & TestRunnerHooks
export async function loadHooks<K extends keyof AllHooks>(
  rcFileHooks: Partial<AllHooks> | undefined,
  names: K[]
) {
  const groups = names.map((name) => {
    return {
      group: name,
      hooks: rcFileHooks?.[name] ?? [],
    }
  })

  const hooks = new Hooks<{
    [P in K]: [
      Parameters<UnWrapLazyImport<AllHooks[K][number]>>,
      Parameters<UnWrapLazyImport<AllHooks[K][number]>>,
    ]
  }>()

  for (const { group, hooks: collection } of groups) {
    for (const item of collection) {
      hooks.add(group, await importDefault<{}>(item))
    }
  }

  return hooks
}

/**
 * Wraps a function inside another function that throttles the concurrent
 * executions of a function. If the function is called too quickly, then
 * it may result in two invocations at max.
 */
export function throttle<Args extends any[]>(
  fn: (...args: Args) => PromiseLike<any>,
  name?: string
): (...args: Args) => Promise<void> {
  name = name || 'throttled'

  let isBusy = false
  let hasQueuedCalls = false
  let lastCallArgs: Args

  async function throttled(...args: Args) {
    if (isBusy) {
      debug('ignoring "%s" invocation as current execution is in progress', name)
      hasQueuedCalls = true
      lastCallArgs = args
      return
    }

    isBusy = true
    debug('executing "%s" function', name)
    await fn(...args)

    isBusy = false
    if (hasQueuedCalls) {
      hasQueuedCalls = false
      debug('resuming and running latest "%s" invocation', name)
      await throttled(...lastCallArgs)
    }
  }

  return throttled
}

/**
 * Finds an import reference inside a code snippet
 */
export async function findImport(code: string, importReference: string): Promise<Import | null> {
  const importIdentifier = importReference.split('.')[0]

  for (const $import of await parseImports(code, {})) {
    /**
     * An import without any clause
     */
    if (!$import.importClause) {
      continue
    }

    /**
     * An import without any clause
     */
    if (!$import.moduleSpecifier.value) {
      continue
    }

    /**
     * Import identifier matches a default import
     */
    if ($import.importClause.default === importIdentifier) {
      return {
        specifier: $import.moduleSpecifier.value,
        isConstant: $import.moduleSpecifier.isConstant,
        clause: {
          type: 'default',
          value: importIdentifier,
        },
      } satisfies Import
    }

    /**
     * Import identifier matches a namespace import
     */
    if ($import.importClause.namespace === importIdentifier) {
      return {
        specifier: $import.moduleSpecifier.value,
        isConstant: $import.moduleSpecifier.isConstant,
        clause: {
          type: 'namespace',
          value: importIdentifier,
        },
      } satisfies Import
    }

    const namedImport = $import.importClause.named.find(({ binding }) => {
      return binding === importIdentifier
    })

    /**
     * Import identifier matches a named import
     */
    if (namedImport) {
      return {
        specifier: $import.moduleSpecifier.value,
        isConstant: $import.moduleSpecifier.isConstant,
        clause: {
          type: 'named',
          value: namedImport.specifier,
          ...(namedImport.binding !== namedImport.specifier
            ? {
                alias: namedImport.binding,
              }
            : {}),
        },
      } satisfies Import
    }
  }

  return null
}

/**
 * Returns an array of SgNodes for class methods. The class name
 * could be fetched using the `KCLASS` identifier.
 */
export function inspectClassMethods(node: SgNode): SgNode[] {
  return node.findAll({
    rule: {
      kind: 'method_definition',
      inside: {
        pattern: {
          selector: 'class_declaration',
          context: 'class $KCLASS {$$$}',
        },
        stopBy: 'end',
      },
    },
  })
}

/**
 * Converts an array of SgNode to plain text by removing whitespaces,
 * identation and comments in between. Tested with the following
 * children nodes only.
 *
 * - MemberExpression
 * - Identifer
 */
export function nodeToPlainText(node: SgNode) {
  let out: string[] = []
  function toText(one: SgNode) {
    const children = one.children()
    if (!children.length) {
      out.push(one.text())
    } else {
      children.forEach((child) => toText(child))
    }
  }

  toText(node)
  return out.join('')
}

/**
 * Inspects arguments for one or more method calls. If you want to
 * scope the search within a specific context, then make sure to
 * first narrow down the AST and pass a specific SgNode.
 *
 * For example: In case of validators, we will first find the Controller
 * method for which we want the validation method calls.
 */
export function inspectMethodArguments(node: SgNode, methodCalls: string[]): SgNode[] {
  const matchingExpressions = node.findAll({
    rule: {
      any: methodCalls.map((methodCall) => {
        return {
          pattern: {
            context: `${methodCall}($$$ARGUMENTS)`,
            selector: 'call_expression',
          },
        }
      }),
    },
  })

  return matchingExpressions.flatMap((matchingExpression) => {
    return matchingExpression.findAll({ rule: { kind: 'arguments' } })
  })
}

/**
 * Inspect the validator direct usage code snippets. A member expression
 * calling the ".validate" method is considered as direct usage of
 * the validator.
 */
export function searchValidatorDirectUsage(node: SgNode): SgNode[] {
  const matchingExpressions = node.findAll({
    rule: {
      pattern: {
        context: '$$$VALIDATOR.validate($$$)',
        selector: 'call_expression',
      },
    },
  })

  return matchingExpressions.flatMap((expression) => {
    /**
     * Since we capture all "$$$.validate" calls, the first node
     * within the call expression will be a member expression
     * and its property identifier will be "validate".
     *
     * What we need is the text of this member expression without the
     * comments
     */
    const firstMemberExpression = expression.getMultipleMatches('VALIDATOR')
    return firstMemberExpression.flatMap((exp) => {
      return exp.find({
        rule: { any: [{ kind: 'identifier' }, { kind: 'member_expression' }] },
      })!
    })
  })
}
