import {model, property} from '@loopback/repository';
import {EventDb} from '.';

@model()
export class EventDbSandbox extends EventDb {

  constructor(data?: Partial<EventDbSandbox>) {
    super(data);
  }
}

export interface EventDbSandboxRelations {
  // describe navigational properties here
}

export type EventDbSandboxWithRelations = EventDbSandbox & EventDbSandboxRelations;
