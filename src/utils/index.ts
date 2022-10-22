import { utils } from '@adonisjs/sink'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

/**
 * Returns package manager for installing dependencies
 */
export const getPackageManager = (application: ApplicationContract) => {
  if (process.env['ADONIS_CREATE_APP_CLIENT']) {
    return process.env['ADONIS_CREATE_APP_CLIENT'] as 'yarn' | 'npm' | 'pnpm'
  }

  return utils.getPackageManager(application.appRoot)
}
