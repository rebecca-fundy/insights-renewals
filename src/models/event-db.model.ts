import {Entity, model, property} from '@loopback/repository';

@model()
export class EventDb extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: false,
  })
  id?: number;

  @property({
    type: 'number',
  })
  subscription_id?: number;

  @property({
    type: 'number',
  })
  customer_id?: number;

  @property({
    type: 'date',
  })
  created_at: Date;

  @property({
    type: 'string',
  })
  key?: string;

  @property({
    type: 'number',
  })
  previous_allocation?: number;

  @property({
    type: 'number',
  })
  new_allocation?: number;

  @property({
    type: 'number',
  })
  allocation_id?: number;

  @property({
    type: 'string',
  })
  previous_subscription_state?: string;

  @property({
    type: 'string',
  })
  new_subscription_state?: string;


  constructor(data?: Partial<EventDb>) {
    super(data);
  }
}

export interface EventDbRelations {
  // describe navigational properties here
}

export type EventDbWithRelations = EventDb & EventDbRelations;
