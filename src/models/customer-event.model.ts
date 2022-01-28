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
  peOffAtSignup?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt1?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt2?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt3?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt4?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt5?: boolean;

  @property({
    type: 'boolean',
  })
  peOffAt6?: boolean;

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

  @property({
    type: 'string',
  })
  productType: string;

  @property({
    type: 'boolean',
  })
  isActive?: boolean;

  @property({
    type: 'boolean',
  })
  isTrialing?: boolean;


  constructor(data?: Partial<CustomerEvent>) {
    super(data);
  }
}

export interface CustomerEventRelations {
  // describe navigational properties here
}

export type CustomerEventWithRelations = CustomerEvent & CustomerEventRelations;
