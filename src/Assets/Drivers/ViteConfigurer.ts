import { ApplicationContract } from '@ioc:Adonis/Core/Application'
import { files, logger } from '@adonisjs/sink'
import { join } from 'path'
import { getPackageManager } from '../../utils'

export class ViteConfigurer {
  constructor(private application: ApplicationContract) {}

  public async invoke() {
    /**
     * Create the vite config file
     */
    const viteConfigFile = new files.MustacheFile(
      this.application.appRoot,
      'vite.config.ts',
      join(__dirname, '../../../templates/vite.config.txt')
    )

    if (!viteConfigFile.exists()) {
      viteConfigFile.apply({}).commit()
      logger.action('create').succeeded('vite.config.ts')
    }

    /**
     * Create app.ts entrypoint
     */
    const entryPointFile = new files.NewLineFile(this.application.appRoot, 'resources/js/app.ts')
    if (!entryPointFile.exists()) {
      entryPointFile.add('// app entrypoint').commit()
      logger.action('create').succeeded('resources/js/app.ts')
    }

    /**
     * Install vite
     */
    const pkgFile = new files.PackageJsonFile(this.application.appRoot)
    pkgFile.install('vite')
    pkgFile.install('@adonisjs/vite-plugin-adonis')
    pkgFile.useClient(getPackageManager(this.application))

    const spinner = logger.await(logger.colors.gray('configure vite'))

    try {
      await pkgFile.commitAsync()
      spinner.update('Configured')
      spinner.stop()
    } catch (error) {
      spinner.update('Unable to install the package')
      spinner.stop()
      logger.fatal(error)
    }
  }
}
