import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {EventDb, EventDbRelations} from '../models';

export class EventDbRepository extends DefaultCrudRepository<
  EventDb,
  typeof EventDb.prototype.id,
  EventDbRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(EventDb, dataSource);
  }
}
