import {model, property} from '@loopback/repository';
import {Transaction} from '.';

@model()
export class TransactionSandbox extends Transaction {

  constructor(data?: Partial<TransactionSandbox>) {
    super(data);
  }
}

export interface TransactionSandboxRelations {
  // describe navigational properties here
}

export type TransactionSandboxWithRelations = TransactionSandbox & TransactionSandboxRelations;
