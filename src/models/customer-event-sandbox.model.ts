import {model, property} from '@loopback/repository';
import {CustomerEvent} from '.';

@model()
export class CustomerEventSandbox extends CustomerEvent {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  idCustomerEvent?: number;

  constructor(data?: Partial<CustomerEventSandbox>) {
    super(data);
  }
}

export interface CustomerEventSandboxRelations {
  // describe navigational properties here
}

export type CustomerEventSandboxWithRelations = CustomerEventSandbox & CustomerEventSandboxRelations;
