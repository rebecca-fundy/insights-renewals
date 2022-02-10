import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Refresh, RefreshRelations} from '../models';

export class RefreshRepository extends DefaultCrudRepository<
  Refresh,
  typeof Refresh.prototype.idRefresh,
  RefreshRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(Refresh, dataSource);
  }
}
