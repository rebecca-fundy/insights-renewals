import {model, property} from '@loopback/repository';
import {Subscription} from '.';

@model()
export class SubscriptionSandbox extends Subscription {

  @property({
    type: 'number',
    id: true,
    generated: false,
    required: true
  })
  customer_id: number;

  constructor(data?: Partial<SubscriptionSandbox>) {
    super(data);
  }
}

export interface SubscriptionSandboxRelations {
  // describe navigational properties here
}

export type SubscriptionSandboxWithRelations = SubscriptionSandbox & SubscriptionSandboxRelations;
