import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {CustomerEventSandbox, CustomerEventSandboxRelations} from '../models';

export class CustomerEventSandboxRepository extends DefaultCrudRepository<
  CustomerEventSandbox,
  typeof CustomerEventSandbox.prototype.idCustomerEvent,
  CustomerEventSandboxRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(CustomerEventSandbox, dataSource);
  }
}
