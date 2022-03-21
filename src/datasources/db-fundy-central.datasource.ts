import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

const config = {
  name: 'dbFundyCentral',
  connector: 'mysql',
  url: '',
  // host: 'localhost',
  host: process.env.LEGACY_DB_HOST,
  port: process.env.LEGACY_DB_PORT,
  user: process.env.LEGACY_DB_USER,
  password: process.env.LEGACY_DB_PASSWORD,
  database: process.env.LEGACY_DB_FUNDYCENTRAL,
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class DbFundyCentralDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'dbFundyCentral';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.dbFundyCentral', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}