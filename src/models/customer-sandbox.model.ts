import {hasMany, model} from '@loopback/repository';
import {Customer} from '.';
import {SubscriptionSandbox} from './subscription-sandbox.model';

@model()
export class CustomerSandbox extends Customer {


  @hasMany(() => SubscriptionSandbox, {keyTo: 'customer_id'})
  subscriptionSandboxes: SubscriptionSandbox[];

  constructor(data?: Partial<CustomerSandbox>) {
    super(data);
  }
}

export interface CustomerSandboxRelations {
  // describe navigational properties here
}

export type CustomerSandboxWithRelations = CustomerSandbox & CustomerSandboxRelations;
