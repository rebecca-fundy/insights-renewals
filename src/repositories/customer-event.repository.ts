import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {CustomerEvent, CustomerEventRelations} from '../models';

export interface DropoffRow {
  name: string,
  amount?: number,
  userCount?: number,
  countOnly?: boolean
}

export interface DropoffTable {
  title: string,
  noOptIn?: DropoffRow,
  dropoff3m?: DropoffRow,
  dropoff1y: DropoffRow,
  dropoff2y: DropoffRow,
  dropoff3y: DropoffRow
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
