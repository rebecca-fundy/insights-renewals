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
  totalCusts?: DropoffRow,
  numTrialing?: DropoffRow,
  numActive?: DropoffRow,
  noOptIn?: DropoffRow,
  dropoff1m?: DropoffRow,
  dropoff2m?: DropoffRow,
  dropoff3m?: DropoffRow,
  dropoff4m?: DropoffRow,
  dropoff5m?: DropoffRow,
  dropoff6m?: DropoffRow,
  dropoff1y?: DropoffRow,
  dropoff2y?: DropoffRow,
  dropoff3y?: DropoffRow
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
