import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {EventDbSandbox, EventDbSandboxRelations} from '../models';

export class EventDbSandboxRepository extends DefaultCrudRepository<
  EventDbSandbox,
  typeof EventDbSandbox.prototype.id,
  EventDbSandboxRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(EventDbSandbox, dataSource);
  }
}
