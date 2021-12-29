import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Allocation, AllocationRelations} from '../models';

export class AllocationRepository extends DefaultCrudRepository<
  Allocation,
  typeof Allocation.prototype.allocation_id,
  AllocationRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(Allocation, dataSource);
  }
}
