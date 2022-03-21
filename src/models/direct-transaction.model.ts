import {model} from '@loopback/repository';
import {Transaction} from './transaction.model';

@model({settings: {strict: false}})
export class DirectTransaction extends Transaction {
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<DirectTransaction>) {
    super(data);
  }
}

export interface DirectTransactionRelations {
  // describe navigational properties here
}

export type DirectTransactionWithRelations = DirectTransaction & DirectTransactionRelations;
