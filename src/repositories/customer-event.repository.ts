import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {CustomerEvent, CustomerEventRelations} from '../models';

export class CustomerEventRepository extends DefaultCrudRepository<
  CustomerEvent,
  typeof CustomerEvent.prototype.idCustomerEvent,
  CustomerEventRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(CustomerEvent, dataSource);
  }
}
