/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import cpy from 'cpy'
import { isNotJunk } from 'junk'
import fastGlob from 'fast-glob'
import getRandomPort from 'get-port'
import type tsStatic from 'typescript'
import { fileURLToPath } from 'node:url'
import { execaNode, execa } from 'execa'
import { isAbsolute, relative } from 'node:path'
import { EnvLoader, EnvParser } from '@adonisjs/env'
import { ConfigParser, Watcher } from '@poppinss/chokidar-ts'

import type { RunOptions, WatchOptions } from './types.js'
import debug from './debug.js'

/**
 * Default set of args to pass in order to run TypeScript
 * source. Used by "run" and "runNode" scripts
 */
const DEFAULT_NODE_ARGS = [
  // Use ts-node/esm loader. The project must install it
  '--loader=ts-node/esm',
  // Disable annonying warnings
  '--no-warnings',
  // Enable expiremental meta resolve for cases where someone uses magic import string
  '--experimental-import-meta-resolve',
  // Enable source maps, since TSNode source maps are broken
  '--enable-source-maps',
]

/**
 * Parses tsconfig.json and prints errors using typescript compiler
 * host
 */
export function parseConfig(cwd: string | URL, ts: typeof tsStatic) {
  const { config, error } = new ConfigParser(cwd, 'tsconfig.json', ts).parse()
  if (error) {
    const compilerHost = ts.createCompilerHost({})
    console.log(ts.formatDiagnosticsWithColorAndContext([error], compilerHost))
    return
  }

  if (config!.errors.length) {
    const compilerHost = ts.createCompilerHost({})
    console.log(ts.formatDiagnosticsWithColorAndContext(config!.errors, compilerHost))
    return
  }

  return config
}

/**
 * Runs a Node.js script as a child process and inherits the stdio streams
 */
export function runNode(cwd: string | URL, options: RunOptions) {
  const childProcess = execaNode(options.script, options.scriptArgs, {
    nodeOptions: DEFAULT_NODE_ARGS.concat(options.nodeArgs),
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
 * Runs a script as a child process and inherits the stdio streams
 */
export function run(cwd: string | URL, options: Omit<RunOptions, 'nodeArgs'>) {
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
export function watch(cwd: string | URL, ts: typeof tsStatic, options: WatchOptions) {
  const config = parseConfig(cwd, ts)
  if (!config) {
    return
  }

  const watcher = new Watcher(typeof cwd === 'string' ? cwd : fileURLToPath(cwd), config!)
  const chokidar = watcher.watch(['.'], { usePolling: options.poll })
  return { watcher, chokidar }
}

/**
 * Check if file is an .env file
 */
export function isDotEnvFile(filePath: string) {
  if (filePath === '.env') {
    return true
  }

  return filePath.includes('.env.')
}

/**
 * Check if file is .adonisrc.json file
 */
export function isRcFile(filePath: string) {
  return filePath === '.adonisrc.json'
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
 *   value is by iterating over all the loaded files. The iteration
 *   stops after first find.
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
    const envVariables = new EnvParser(file.contents).parse()
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
      if (fastGlob.isDynamicPattern(file)) {
        result.patterns.push(file)
      } else {
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
  const filePaths = paths.concat(await fastGlob(patterns, { cwd }))

  /**
   * Computing relative destination. This is because, cpy is buggy when
   * outDir is an absolute path.
   */
  const destination = isAbsolute(outDir) ? relative(cwd, outDir) : outDir
  debug('copying files %O to destination "%s"', filePaths, destination)

  return cpy(filePaths.filter(isNotJunk), destination, {
    cwd: cwd,
    flat: false,
  })
}
