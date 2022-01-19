import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {ChargifyEvent, ChargifyEventRelations} from '../models';

export class ChargifyEventRepository extends DefaultCrudRepository<
  ChargifyEvent,
  typeof ChargifyEvent.prototype.eventId,
  ChargifyEventRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(ChargifyEvent, dataSource);
  }
}
