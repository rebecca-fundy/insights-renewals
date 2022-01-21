import {model, property, belongsTo} from '@loopback/repository';
import {Subscription} from '.';
import {CustomerSandbox} from './customer-sandbox.model';

@model()
export class SubscriptionSandbox extends Subscription {

  @belongsTo(() => CustomerSandbox, {name: 'customerSandboxId'})
  customer_id: number;

  constructor(data?: Partial<SubscriptionSandbox>) {
    super(data);
  }
}

export interface SubscriptionSandboxRelations {
  // describe navigational properties here
}

export type SubscriptionSandboxWithRelations = SubscriptionSandbox & SubscriptionSandboxRelations;
