import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {TransactionSandbox, TransactionSandboxRelations} from '../models';

export class TransactionSandboxRepository extends DefaultCrudRepository<
  TransactionSandbox,
  typeof TransactionSandbox.prototype.id,
  TransactionSandboxRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(TransactionSandbox, dataSource);
  }
}
