# @adonisjs/assembler

<br />

[![gh-workflow-image]][gh-workflow-url] [![npm-image]][npm-url] ![][typescript-image] [![license-image]][license-url]

## Introduction
AdonisJS Assembler is a development toolkit used by AdonisJS to perform tasks like **starting the dev server in watch mode**, **running tests in watch mode**, and **applying codemods** to modify source files.

Assembler should always be installed as a development dependency. If your project needs Assembler APIs in production, you must reconsider your approach.

## Goals
Assembler is built around the following goals.

- Expose a coding interface and not a user interface. In other words, Assembler will never expose any CLI commands.
- Encapsulate tasks under a single API. Instead of providing ten different utilities to run a dev server, Assembler will expose one API to run the dev server.
- House all development APIs needed by AdonisJS. Therefore, the scope of the Assembler might increase over time.

## Dev server
The development server can be started using the `DevServer` class. It will run `bin/server.ts` file from the AdonisJS project as a child process and monitor it for changes (in both HMR and watcher modes).

Every time there is a file change, the `DevServer` will execute the file watcher hooks and if needed will restart the development server.

You may import and use the `DevServer` as follows.

```ts
import ts from 'typescript'
import { DevServer } from '@adonisjs/assembler'

const appRoot = new URL('./', import.meta.url)

const devServer = new DevServer(appRoot, {
  /**
   * Arguments to pass to the "bin/server.ts" file
   */
  scriptArgs: [],

  /**
   * Arguments to pass to the Node.js CLI
   */
  nodeArgs: [],

  /**
   * An array of metaFiles to watch and re-start the
   * HTTP server only if the "reloadServer" flag is
   * true.
   */
  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    }
  ]
})

devServer.onError((error) => {
  process.exitCode = 1
})
devServer.onClose((exitCode) => {
  process.exitCode = exitCode
})

await devServer.runAndWatch(ts)
```

You may start the dev server in HMR mode by setting `hmr: true` and calling the `start` method.

```ts
const devServer = new DevServer(appRoot, {
  hmr: true,
  // ...rest of the config
})

await devServer.start()
```

## Test runner
The `TestRunner` is used to execute the `bin/test.ts` file of your AdonisJS application. Like the `DevServer`, the `TestRunner` allows you to watch for file changes and re-run the tests. The following steps are taken to re-run tests in watch mode.

- If the changed file is a test file, only tests for that file will be re-run.
- Otherwise, all tests will re-run with respect to the initial filters applied when running the `node ace test` command.

### Usage

You may import and use the `TestRunner` as follows.

```ts
import ts from 'typescript'
import { TestRunner } from '@adonisjs/assembler'

const appRoot = new URL('./', import.meta.url)

const runner = new TestRunner(appRoot, {
  /**
   * Arguments to pass to the "bin/test.ts" file
   */
  scriptArgs: [],

  /**
   * Arguments to pass to the Node.js CLI
   */
  nodeArgs: [],

  /**
   * An array of suites and their glob patterns
   */
  suites: [
    {
      name: 'unit',
      files: ['tests/unit/**/*.spec.ts']
    },
    {
      name: 'functional',
      files: ['tests/functional/**/*.spec.ts']
    }
  ],

  /**
   * Initial set of filters to apply. These filters
   * will be re-applied when re-running tests in
   * watch mode
   */
  filters: {
    suites: ['unit'],
    tags: ['@slow']
  }
})

await runner.runAndWatch(ts)
```

You can run tests without the watcher using the `run` method.

```ts
await runner.run()
```

## Bundler
The `Bundler` is used to create the production build of an AdonisJS application. The following steps are performed to generate the build.

- Clean up the existing build directory.
- Create JavaScript build using `tsc` (The TypeScript's official compiler).
- Copy the `ace.js` file to the build folder. Since the ace file ends with the `.js` extension, it is not compiled by the TypeScript compiler.
- Copy `package.json` and the **lock-file of the package manager** you are using to the `build` folder. This operation only supports `bun | npm | yarn | pnpm`. For other bundlers, you will have to copy the lock file manually.
- The end.

### Usage
You may import and use the `Bundler` as follows.

```ts
import ts from 'typescript'
import { Bundler } from '@adonisjs/assembler'

const appRoot = new URL('./', import.meta.url)

const bundler = new Bundler(appRoot, ts, {
  /**
   * Metafiles to copy to the build folder
   */
  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    }
  ],
})
```

## Codemods
Assembler also exports certain codemods to modify the source files of an AdonisJS project to configure packages.

The codemods relies on the defaults of AdonisJS and will not work if a project does not follow the defaults. This is an intentional limit since we only have limited time to craft codemods that work with every possible setup.

### Usage
You may import and use the `Codemods` as follows.

```ts
import { CodeTransformer } from '@adonisjs/assembler/code_transformer'

const appRoot = new URL('./', import.meta.url)

const transformer = new CodeTransformer(appRoot)
```

### defineEnvValidations
Define validation rules for environment variables. The method accepts a key-value pair of variables. The `key` is the env variable name, and the `value` is the validation expression as a string.

> [!IMPORTANT]
> This codemod expects the `start/env.ts` file to exist and must have the `export default await Env.create` method call.
>
> Also, the codemod does not overwrite the existing validation rule for a given environment variable. This is done to respect in-app modifications.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.defineEnvValidations({
    leadingComment: 'App environment variables',
    variables: {
      PORT: 'Env.schema.number()',
      HOST: 'Env.schema.string()',
    }
  })
} catch (error) {
  console.error('Unable to define env validations')
  console.error(error)
}
```

Output

```ts
import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  PORT: Env.schema.number(),
  HOST: Env.schema.string(),
})
```

### addMiddlewareToStack
Register AdonisJS middleware to one of the known middleware stacks. The method accepts the middleware stack and an array of middleware to register.

The middleware stack could be one of `server | router | named`.

> [!IMPORTANT]
> This codemod expects the `start/kernel.ts` file to exist and must have a function call for the middleware stack for which you are trying to register a middleware.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addMiddlewareToStack('router', [
    {
      path: '@adonisjs/core/bodyparser_middleware'
    }
  ])
} catch (error) {
  console.error('Unable to register middleware')
  console.error(error)
}
```

Output

```ts
import router from '@adonisjs/core/services/router'

router.use([
  () => import('@adonisjs/core/bodyparser_middleware')
])
```

You may define named middleware as follows.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addMiddlewareToStack('named', [
    {
      name: 'auth',
      path: '@adonisjs/auth/auth_middleware'
    }
  ])
} catch (error) {
  console.error('Unable to register middleware')
  console.error(error)
}
```

### updateRcFile
Register `providers`, `commands`, define `metaFiles` and `commandAliases` to the `adonisrc.ts` file.

> [!IMPORTANT]
> This codemod expects the `adonisrc.ts` file to exist and must have an `export default defineConfig` function call.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.updateRcFile((rcFile) => {
    rcFile
      .addProvider('@adonisjs/lucid/db_provider')
      .addCommand('@adonisjs/lucid/commands'),
      .setCommandAlias('migrate', 'migration:run')
  })
} catch (error) {
  console.error('Unable to update adonisrc.ts file')
  console.error(error)  
}
```

Output

```ts
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  commands: [
    () => import('@adonisjs/lucid/commands')
  ],
  providers: [
    () => import('@adonisjs/lucid/db_provider')
  ],
  commandAliases: {
    migrate: 'migration:run'
  }
})
```

### addJapaPlugin
Register a Japa plugin to the `tests/bootstrap.ts` file.

> [!IMPORTANT]
> This codemod expects the `tests/bootstrap.ts` file to exist and must have the `export const plugins: Config['plugins']` export.

```ts
const transformer = new CodeTransformer(appRoot)

const imports = [
  {
    isNamed: false,
    module: '@adonisjs/core/services/app',
    identifier: 'app'
  },
  {
    isNamed: true,
    module: '@adonisjs/session/plugins/api_client',
    identifier: 'sessionApiClient'
  }
]
const pluginUsage = 'sessionApiClient(app)'

try {
  await transformer.addJapaPlugin(pluginUsage, imports)
} catch (error) {
  console.error('Unable to register japa plugin')
  console.error(error)
}
```

Output

```ts
import app from '@adonisjs/core/services/app'
import { sessionApiClient } from '@adonisjs/session/plugins/api_client'

export const plugins: Config['plugins'] = [
  sessionApiClient(app)
]
```

### addVitePlugin

Register a Vite plugin to the `vite.config.ts` file.

> [!IMPORTANT]
> This codemod expects the `vite.config.ts` file to exist and must have the `export default defineConfig` function call.

```ts
const transformer = new CodeTransformer(appRoot)
const imports = [
  {
    isNamed: false,
    module: '@vitejs/plugin-vue',
    identifier: 'vue'
  },
]
const pluginUsage = 'vue({ jsx: true })'

try {
  await transformer.addVitePlugin(pluginUsage, imports)
} catch (error) {
  console.error('Unable to register vite plugin')
  console.error(error)
}
```

Output

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue({ jsx: true })
  ]
})
```

### addPolicies
Register AdonisJS bouncer policies to the list of `policies` object exported from the `app/policies/main.ts` file.

> [!IMPORTANT]
> This codemod expects the `app/policies/main.ts` file to exist and must export a `policies` object from it.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addPolicies([
    {
      name: 'PostPolicy',
      path: '#policies/post_policy'
    }
  ])
} catch (error) {
  console.error('Unable to register policy')
  console.error(error)
}
```

Output

```ts
export const policies = {
  UserPolicy: () => import('#policies/post_policy')
}
```

### addValidator
Create a new validator file or add a validator to an existing file. If the file does not exist, it will be created with the provided contents. If it exists and the export name is not already defined, the validator will be appended to the file.

> [!IMPORTANT]
> This codemod respects the `validators` directory configured in `adonisrc.ts` and defaults to `app/validators`.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addValidator({
    validatorFileName: 'user.ts',
    exportName: 'loginValidator',
    contents: `export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8)
  })
)`
  })
} catch (error) {
  console.error('Unable to add validator')
  console.error(error)
}
```

Output (app/validators/user.ts)

```ts
export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().email(),
    password: vine.string().minLength(8)
  })
)
```

### addLimiter
Create a new rate limiter file or add a limiter to an existing file. If the file does not exist, it will be created with the provided contents. If it exists and the export name is not already defined, the limiter will be appended to the file.

> [!IMPORTANT]
> Limiters are created in the `start` directory configured in `adonisrc.ts` and defaults to `start`.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addLimiter({
    limiterFileName: 'limiters.ts',
    exportName: 'apiThrottle',
    contents: `export const apiThrottle = limiter.define('api', () => {
  return limiter.allowRequests(10).every('1 minute')
})`
  })
} catch (error) {
  console.error('Unable to add limiter')
  console.error(error)
}
```

Output (start/limiters.ts)

```ts
export const apiThrottle = limiter.define('api', () => {
  return limiter.allowRequests(10).every('1 minute')
})
```

### addModelMixins
Apply one or more mixins to a model class. This wraps the model's extends clause with the `compose` helper and applies the specified mixins.

> [!IMPORTANT]
> This codemod expects the model file to exist with a default exported class that extends a base class.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addModelMixins('user.ts', [
    {
      name: 'SoftDeletes',
      importPath: '@adonisjs/lucid/orm/mixins/soft_deletes',
      importType: 'named'
    },
    {
      name: 'Sluggable',
      importPath: '#mixins/sluggable',
      importType: 'default',
      args: ['title', '{ strategy: "dbIncrement" }']
    }
  ])
} catch (error) {
  console.error('Unable to add mixins to model')
  console.error(error)
}
```

Input (app/models/user.ts)

```ts
import { BaseModel } from '@adonisjs/lucid/orm'

export default class User extends BaseModel {
  // ...
}
```

Output (app/models/user.ts)

```ts
import { BaseModel } from '@adonisjs/lucid/orm'
import { compose } from '@adonisjs/core/helpers'
import { SoftDeletes } from '@adonisjs/lucid/orm/mixins/soft_deletes'
import Sluggable from '#mixins/sluggable'

export default class User extends compose(BaseModel, SoftDeletes(), Sluggable(title, { strategy: "dbIncrement" })) {
  // ...
}
```

### addControllerMethod
Create a new controller file or add a method to an existing controller class. If the controller file does not exist, it will be created with the class and method. If it exists and the method is not already defined, the method will be added to the class.

> [!IMPORTANT]
> This codemod respects the `controllers` directory configured in `adonisrc.ts` and defaults to `app/controllers`.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.addControllerMethod({
    controllerFileName: 'users_controller.ts',
    className: 'UsersController',
    name: 'destroy',
    contents: `async destroy({ params, response }: HttpContext) {
  const user = await User.findOrFail(params.id)
  await user.delete()
  return response.noContent()
}`,
    imports: [
      { isType: false, isNamed: true, name: 'HttpContext', path: '@adonisjs/core/http' },
      { isType: false, isNamed: false, name: 'User', path: '#models/user' }
    ]
  })
} catch (error) {
  console.error('Unable to add controller method')
  console.error(error)
}
```

Output (app/controllers/users_controller.ts)

```ts
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'

export default class UsersController {
  async destroy({ params, response }: HttpContext) {
    const user = await User.findOrFail(params.id)
    await user.delete()
    return response.noContent()
  }
}
```

### RcFileTransformer additional methods

The `RcFileTransformer` class (accessible via `updateRcFile` callback) now supports additional methods for managing imports and hooks.

#### addNamedImport
Add a named import to the `adonisrc.ts` file.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.updateRcFile((rcFile) => {
    rcFile.addNamedImport('@adonisjs/core/types', ['Middleware', 'Provider'])
  })
} catch (error) {
  console.error('Unable to add named import')
  console.error(error)
}
```

Output

```ts
import { defineConfig } from '@adonisjs/core/app'
import { Middleware, Provider } from '@adonisjs/core/types'

export default defineConfig({
  // ...
})
```

#### addDefaultImport
Add a default import to the `adonisrc.ts` file.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.updateRcFile((rcFile) => {
    rcFile.addDefaultImport('#config/database', 'databaseConfig')
  })
} catch (error) {
  console.error('Unable to add default import')
  console.error(error)
}
```

Output

```ts
import { defineConfig } from '@adonisjs/core/app'
import databaseConfig from '#config/database'

export default defineConfig({
  // ...
})
```

#### addAssemblerHook
Add assembler hooks to the `adonisrc.ts` file. Hooks can be added as thunk imports (lazy loaded) or as raw values for direct import references.

```ts
const transformer = new CodeTransformer(appRoot)

try {
  await transformer.updateRcFile((rcFile) => {
    // Add a thunk-style hook (lazy import)
    rcFile.addAssemblerHook('onBuildStarting', './commands/build_hook.js')

    // Add a raw hook (direct import reference)
    rcFile.addAssemblerHook('onBuildCompleted', 'buildCompletedHook', true)
  })
} catch (error) {
  console.error('Unable to add assembler hook')
  console.error(error)
}
```

Output

```ts
import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  hooks: {
    onBuildStarting: [
      () => import('./commands/build_hook.js')
    ],
    onBuildCompleted: [
      buildCompletedHook
    ]
  }
})
```

## Index generator

The `IndexGenerator` is a core concept in Assembler that is used to watch the filesystem and create barrel files or types from a source directory.

For example, the core of the framework uses the following config to generate controllers, events, and listeners barrel file.

```ts
import hooks from '@adonisjs/assembler/hooks'

export default hooks.init((type, parent, indexGenerator) => {
  indexGenerator.add('controllers', {
    source: './app/controllers',
    importAlias: '#controllers',
    as: 'barrelFile',
    exportName: 'controllers',
    removeSuffix: 'controllers',
    output: './.adonisjs/server/controllers.ts',
  })

  indexGenerator.add('events', {
    source: './app/events',
    importAlias: '#events',
    as: 'barrelFile',
    exportName: 'events',
    output: './.adonisjs/server/events.ts',
  })

  indexGenerator.add('listeners', {
    source: './app/listeners',
    importAlias: '#listeners',
    as: 'barrelFile',
    exportName: 'listeners',
    removeSuffix: 'listener',
    output: './.adonisjs/server/listeners.ts',
  })
})
```

Once the configurations have been registered with the `IndexGenerator`, it will scan the needed directories and generate the output files. Additionally, the file watchers will re-trigger the index generation when a file is added or removed from the source directory.

### Barrel file generation

Barrel files provide a single entry point by exporting a collection of lazily imported entities, recursively gathered from a source directory. The `IndexGenerator` automates this process by scanning nested directories and generating import mappings that mirror the file structure.

For example, given the following `controllers` directory structure:

```sh
app/controllers/
├── auth/
│   ├── login_controller.ts
│   └── register_controller.ts
├── blog/
│   ├── posts_controller.ts
│   └── post_comments_controller.ts
└── users_controller.ts
```

When processed with the controllers configuration, the `IndexGenerator` produces a barrel file that reflects the directory hierarchy as nested objects, using capitalized file names as property keys.

```ts
export const controllers = {
  auth: {
    Login: () => import('#controllers/auth/login_controller'),
    Register: () => import('#controllers/auth/register_controller'),
  },
  blog: {
    Posts: () => import('#controllers/blog/posts_controller'),
    PostComments: () => import('#controllers/blog/post_comments_controller'),
  },
  Users: () => import('#controllers/users_controller'),
}
```

### Types generation

To generate a types file, register a custom callback that takes an instance of the `VirtualFileSystem` and updates the output string via the `buffer` object. 

The collection is represented as key–value pairs:

- **Key** — the relative path (without extension) from the root of the source directory.
- **Value** — an object containing the file's `importPath`, `relativePath`, and `absolutePath`.

```ts
import hooks from '@adonisjs/assembler/hooks'

export default hooks.init((type, parent, indexGenerator) => {
  indexGenerator.add('inertiaPages', {
    source: './inertia/pages',
    as: (vfs, buffer) => {
      buffer.write(`declare module '@adonisjs/inertia' {`).indent()
      buffer.write(`export interface Pages {`).indent()

      const files = vfs.asList()
      Object.keys(files).forEach((filePath) => {
        buffer.write(
          `'${filePath}': InferPageProps<typeof import('${file.importPath}').default>`
        )
      })

      buffer.dedent().write('}')
      buffer.dedent().write('}')
    },
    output: './.adonisjs/server/inertia_pages.d.ts',
  })
})
```

## Contributing
One of the primary goals of AdonisJS is to have a vibrant community of users and contributors who believe in the framework's principles.

We encourage you to read the [contribution guide](https://github.com/adonisjs/.github/blob/main/docs/CONTRIBUTING.md) before contributing to the framework.

## Code of Conduct
To ensure that the AdonisJS community is welcoming to all, please review and abide by the [Code of Conduct](https://github.com/adonisjs/.github/blob/main/docs/CODE_OF_CONDUCT.md).

## License
AdonisJS Assembler is open-sourced software licensed under the [MIT license](LICENSE.md).

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/adonisjs/assembler/checks.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/adonisjs/assembler/actions/workflows/checks.yml "Github action"

[npm-image]: https://img.shields.io/npm/v/@adonisjs/assembler/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@adonisjs/assembler/v/latest "npm"

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[license-url]: LICENSE.md
[license-image]: https://img.shields.io/github/license/adonisjs/ace?style=for-the-badge
