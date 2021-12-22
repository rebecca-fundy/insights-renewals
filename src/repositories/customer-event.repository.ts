import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {CustomerEvent, CustomerEventRelations} from '../models';

export interface DropoffTable {
  dropoffAtSignup: number,
  dropoffAt3m: number,
  dropoffAt1y: number,
  dropoffAt2y: number,
  dropoffAt3y: number
}

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
