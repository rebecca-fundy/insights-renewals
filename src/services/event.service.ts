import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {EventDataSource} from '../datasources';

export interface EventObject {
  'event': any
}

export interface Event {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getEvents(): Promise<EventObject[]>
}

export class EventProvider implements Provider<Event> {
  constructor(
    // event must match the name property in the datasource json file
    @inject('datasources.event')
    protected dataSource: EventDataSource = new EventDataSource(),
  ) { }

  value(): Promise<Event> {
    return getService(this.dataSource);
  }
}
