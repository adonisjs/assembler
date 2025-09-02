/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/**
 * Main types module that re-exports all TypeScript type definitions
 * used throughout the AdonisJS Assembler package.
 *
 * This module provides a single entry point for all type definitions including:
 * - Hook types for development server, bundler, test runner, and file watcher
 * - Common configuration types for servers and runners
 * - Code scanner types for route analysis and type generation
 * - Code transformer types for middleware, policies, and environment validation
 *
 * @example
 * import { DevServerOptions, BundlerHooks, ScannedRoute } from '@adonisjs/assembler/types'
 */

export * from './hooks.ts'
export * from './common.ts'
export * from './code_scanners.ts'
export * from './code_transformer.ts'
