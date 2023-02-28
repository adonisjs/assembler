import { assert } from '@japa/assert'
import { fileSystem } from '@japa/file-system'
import { specReporter } from '@japa/spec-reporter'
import { runFailedTests } from '@japa/run-failed-tests'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { processCliArgs, configure, run } from '@japa/runner'

const TEST_TMP_DIR_PATH = fileURLToPath(new URL('../tmp', import.meta.url))

/*
|--------------------------------------------------------------------------
| Configure tests
|--------------------------------------------------------------------------
|
| The configure method accepts the configuration to configure the Japa
| tests runner.
|
| The first method call "processCliArgs" process the command line arguments
| and turns them into a config object. Using this method is not mandatory.
|
| Please consult japa.dev/runner-config for the config docs.
*/
configure({
  ...processCliArgs(process.argv.slice(2)),
  ...{
    files: ['tests/**/*.spec.ts'],
    plugins: [assert(), runFailedTests(), fileSystem({ basePath: TEST_TMP_DIR_PATH })],
    reporters: [specReporter()],
    importer: (filePath: string) => import(pathToFileURL(filePath).href),
  },
})

/*
|--------------------------------------------------------------------------
| Run tests
|--------------------------------------------------------------------------
|
| The following "run" method is required to execute all the tests.
|
*/
run()
