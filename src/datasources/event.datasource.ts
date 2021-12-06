import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

var options = {
  "method": "GET",
  "port": null,
  "path": "/events.json?date_field=created_at&filter=component_allocation_change&direction=desc&per_page=200",
  headers: {
    "content-type": "application/json",
    "authorization": "Basic NG02MzRPMUVTcTQyVG9NMmdZUzJ2ckpyaXhOSnZNc1JrZHBRNEtrek5XRTo="
  },
  "baseURL": 'https://fundy-suite-sandbox.chargify.com',
}

const config = {
  name: 'event',
  connector: 'rest',
  crud: false,
  options: {
    headers: options['headers']
  },
  operations: [
    {
      template: {
        method: options['method'],
        url: `${options['baseURL']}${options['path']}`
      },

      functions:
      {
        getEvents: [],
      }
    }
  ]
};

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class EventDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'event';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.event', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
