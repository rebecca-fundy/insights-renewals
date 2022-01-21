import {belongsTo, Entity, model, property} from '@loopback/repository';
import {Customer} from './customer.model';

@model()
export class Subscription extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: false,
  })
  id: number;

  @property({
    type: 'number',
    generated: false,
  })
  product_id: number;

  @property({
    type: 'date',
    generated: false,
  })
  created_at: Date;

  @property({
    type: 'number',
    generated: false,
  })
  peOn: boolean;

  @belongsTo(() => Customer, {name: 'customerId'})
  customer_id: number;

  constructor(data?: Partial<Subscription>) {
    super(data);
  }
}

export interface SubscriptionRelations {
  // describe navigational properties here
}

export type SubscriptionWithRelations = Subscription & SubscriptionRelations;
