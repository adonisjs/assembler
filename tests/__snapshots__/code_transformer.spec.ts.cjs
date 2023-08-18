exports[`Code transformer > set correct position when defined 1`] = `"import router from '@adonisjs/core/services/router'
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

exports[`Code transformer > add a route middleware 1`] = `"import router from '@adonisjs/core/services/router'
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

exports[`Code transformer > add route and server middleware 1`] = `"import router from '@adonisjs/core/services/router'
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

exports[`Code transformer > add leading comment 1`] = `"import { Env } from '@adonisjs/core/env'

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

