import {Entity, hasMany, model, property} from '@loopback/repository';
import {EventDb} from './event-db.model';
import {Subscription, SubscriptionWithRelations} from './subscription.model';

@model()
export class Customer extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: false,
  })
  id: number;

  @property({
    type: 'string',
  })
  first_name?: string;

  @property({
    type: 'string',
  })
  last_name?: string;

  @property({
    type: 'date',
  })
  created_at: Date;

  @hasMany(() => Subscription, {keyTo: 'customer_id'})
  subscriptions?: Subscription[];

  @hasMany(() => EventDb, {keyTo: 'customer_id'})
  eventDbs: EventDb[];

  constructor(data?: Partial<Customer>) {
    super(data);
  }
}

export interface CustomerRelations {
  subscriptions?: SubscriptionWithRelations[];
  // describe navigational properties here
}

export type CustomerWithRelations = Customer & CustomerRelations;
