exports[`Code transformer | addMiddlewareToStack > set correct position when defined 1`] = `"import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#foo/middleware.js'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('#foo/middleware2.js')
])

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
])

export const middleware = router.named({})
"`

exports[`Code transformer | addMiddlewareToStack > add a route middleware 1`] = `"import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/session/session_middleware'),
])

router.use([
  () => import('#foo/bar.js'),
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/random_middleware')
])

export const middleware = router.named({})
"`

exports[`Code transformer | addMiddlewareToStack > add route and server middleware 1`] = `"import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/random_middleware')
])

router.use([
  () => import('#foo/bar.js'),
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
])

export const middleware = router.named({})
"`

exports[`Code transformer | defineEnvValidations > add leading comment 1`] = `"import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),

  /*
  |----------------------------------------------------------
  | Redis configuration
  |----------------------------------------------------------
  */
  REDIS_HOST: Env.schema.string.optional(),
  REDIS_PORT: Env.schema.number()
})
"`

exports[`Code transformer | addProvider > add provider to rc file with specific environments 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    },
    {
      file: () => import('@adonisjs/redis-provider'),
      environment: ['console', 'repl'],
    }
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
  ],
  commands: [
    () => import('@adonisjs/core/commands')
  ]
})
"`

exports[`Code transformer | addProvider > do no add environments when they are all specified 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    },
    () => import('@adonisjs/redis-provider')
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
  ],
  commands: [
    () => import('@adonisjs/core/commands')
  ]
})
"`

exports[`Code transformer | addMetaFile > add meta files to rc file with reload server 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    }
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
    {
      pattern: 'assets/**',
      reloadServer: true,
    }
  ],
  commands: [
    () => import('@adonisjs/core/commands')
  ]
})
"`

exports[`Code transformer | setDirectory > set directory in rc file 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    }
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
  ],
  commands: [
    () => import('@adonisjs/core/commands')
  ],
  directories: {
    views: 'templates'
  }
})
"`

exports[`Code transformer | setCommandAlias > set command alias in rc file 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    }
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
  ],
  commands: [
    () => import('@adonisjs/core/commands')
  ],
  commandsAliases: {
    migrate: 'migration:run'
  }
})
"`

exports[`Code transformer | addPreloadFile > add preload file with specific environments 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
    {
      file: () => import('#start/foo.js'),
      environment: ['console', 'repl'],
    }
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    }
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
  ],
  commands: [
    () => import('@adonisjs/core/commands')
  ]
})
"`

exports[`Code transformer | addMiddlewareToStack > override duplicates when adding named middelware 1`] = `"import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/session/session_middleware'),
])

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
])

export const middleware = router.named({
  auth: () => import('#foo/bar3.js')
})
"`

exports[`Code transformer | addMiddlewareToStack > do not add duplicate named middleware 1`] = `"import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

server.errorHandler(() => import('#exceptions/handler'))

server.use([
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/session/session_middleware'),
])

router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
])

export const middleware = router.named({
  auth: () => import('#foo/bar.js')
})
"`

exports[`Code transformer | addCommand > add command to rc file 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  preloads: [
    () => import('./start/routes.ts'),
    {
      file: () => import('./start/ace.ts'),
      environment: ['console'],
    },
  ],
  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl'],
    }
  ],
  metaFiles: [
    {
      pattern: 'public/**',
      reloadServer: true
    },
  ],
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('#foo/bar.js'),
    () => import('#foo/bar2.js')
  ]
})
"`

exports[`Code transformer | addCommand > should add command even if commands property is missing 1`] = `"import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  typescript: true,
  commands: [() => import('#foo/bar.js')]
})
"`

