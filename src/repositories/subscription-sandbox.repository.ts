import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {SubscriptionSandbox, SubscriptionSandboxRelations} from '../models';

export class SubscriptionSandboxRepository extends DefaultCrudRepository<
  SubscriptionSandbox,
  typeof SubscriptionSandbox.prototype.id,
  SubscriptionSandboxRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(SubscriptionSandbox, dataSource);
  }
}
