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
You can start the HTTP server of an AdonisJS application using the `node --loader=ts-node/esm bin/server.ts` file. However, this approach has some limitations and may not provide the best DX.

### Using a file watcher
You might be tempted to use the Node.js built-in file watcher with the `--watch` flag. However, the Node.js file watcher does not integrate with TypeScript. As a result, you will be tweaking its configuration options to get an ideal experience.

On the other hand, the Assembler file watcher takes the following approach.

- Parses the `tsconfig.json` file to collect the list of files that are part of your TypeScript project. As a result, if you ever want to ignore any file, you do it directly within the `tsconfig.json` file, and the watcher will pick it up.
- It uses the `metaFiles` array defined inside the `adonisrc.ts` file to watch additional files that are not `.js` or `.ts`. It may be the Edge templates, markdown files, YAML files, etc.

### Starting the asset bundler server
If you create a full-stack application, the chances of using Webpack or Vite are high. Instead of starting your assets bundler inside a separate process, you can also rely on Assembler to start a parallel process for the assets bundler.

The [`node ace serve` command](https://github.com/adonisjs/core/blob/next/commands/serve.ts#L88) detects the assets bundler used by your AdonisJS project and passes it to Assembler.

Therefore, if you run the `serve` command with a `vite.config.js` file, you will notice that the Assembler will start both Vite and the AdonisJS HTTP server.

### Picking a random port
The PORT on which an AdonisJS application should run is configured inside the `.env` file of your AdonisJS application. However, you will often start multiple projects together and have to edit the `.env` file to ensure both projects run on different ports.

With Assembler, you do not have to edit the `.env` files since Assembler will pick a random port of your application if the configured one is already in use.

### Usage
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
  ],

  /**
   * The assets bundler process to start
   */
  assets: {
    enabled: true,
    name: 'vite',
    cmd: 'vite',
    args: []
  }
})

devServer.onError((error) => {
  process.exitCode = 1
})
devServer.onClose((exitCode) => {
  process.exitCode = exitCode
})

await devServer.runAndWatch(ts)
```

You may start the dev server and assets bundler dev server using the `start` method.

```ts
await devServer.start()
```

## Test runner
The `TestRunner` is used to execute the `bin/test.ts` file of your AdonisJS application. Like the `DevServer`, the `TestRunner` allows you to watch for file changes and re-run the tests. The following steps are taken to re-run tests in watch mode.

> [!NOTE]  
> Read [Using a file watcher](#using-a-file-watcher) section to understand which files are watched by the file watcher.

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
- Compile frontend assets (if an assets bundler is configured).
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

  /**
   * The assets bundler to use to bundle the frontend
   * assets
   */
  assets: {
    enabled: true,
    name: 'vite',
    cmd: 'vite',
    args: ['build']
  }
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
