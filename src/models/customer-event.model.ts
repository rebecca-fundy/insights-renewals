import {Entity, model, property} from '@loopback/repository';

@model()
export class CustomerEvent extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  idCustomerEvent?: number;

  @property({
    type: 'number',
    required: true,
  })
  customer_id: number;

  @property({
    type: 'string',
  })
  event_id?: string;

  @property({
    type: 'date',
    required: true,
  })
  customer_created: Date;

  @property({
    type: 'boolean',
  })
  peOffAt3?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt15?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt27?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt39?: boolean;


  constructor(data?: Partial<CustomerEvent>) {
    super(data);
  }
}

export interface CustomerEventRelations {
  // describe navigational properties here
}

export type CustomerEventWithRelations = CustomerEvent & CustomerEventRelations;
