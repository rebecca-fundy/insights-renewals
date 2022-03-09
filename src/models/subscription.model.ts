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
    type: 'string',
    generated: false,
  })
  state: string;

  @property({
    type: 'number',
    generated: false,
  })
  peOn: boolean;

  @property({
    type: 'date',
    generated: false,
  })
  next_assessment_at: Date;

  @property({
    type: 'number',
    generated: false,
  })
  est_renew_amt: number;

  @property({
    type: 'number',
    generated: false,
  })
  cc_exp_month: number;

  @property({
    type: 'number',
    generated: false,
  })
  cc_exp_year: number;

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

