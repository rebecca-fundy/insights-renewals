import {Entity, model, property} from '@loopback/repository';

@model()
export class Transaction extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: false,
  })
  id: number;

  //'payment' or 'refund'
  @property({
    type: 'string',
  })
  type: string;

  @property({
    type: 'date',
  })
  created_at: Date;

  @property({
    type: 'string',
  })
  memo: string;

  @property({
    type: 'number',
  })
  amount_in_cents: number;

  @property({
    type: 'number',
  })
  product_id: number;

  @property({
    type: 'string',
  })
  kind?: string;

  //'chargify', 'authorize' or 'undetermined'
  @property({
    type: 'string',
    default: 'chargify',
    required: true
  })
  source: string;


  constructor(data?: Partial<Transaction>) {
    super(data);
  }
}

export interface TransactionRelations {
  // describe navigational properties here
}

export type TransactionWithRelations = Transaction & TransactionRelations;
