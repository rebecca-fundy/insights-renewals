import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {CustomerSandbox, CustomerSandboxRelations, SubscriptionSandbox} from '../models';
import {SubscriptionSandboxRepository} from './subscription-sandbox.repository';

export class CustomerSandboxRepository extends DefaultCrudRepository<
  CustomerSandbox,
  typeof CustomerSandbox.prototype.id,
  CustomerSandboxRelations
> {

  public readonly subscriptionSandboxes: HasManyRepositoryFactory<SubscriptionSandbox, typeof CustomerSandbox.prototype.id>;

  constructor(
    @inject('datasources.db') dataSource: DbDataSource, @repository.getter('SubscriptionSandboxRepository') protected subscriptionSandboxRepositoryGetter: Getter<SubscriptionSandboxRepository>,
  ) {
    super(CustomerSandbox, dataSource);
    this.subscriptionSandboxes = this.createHasManyRepositoryFactoryFor('subscriptionSandboxes', subscriptionSandboxRepositoryGetter,);
    this.registerInclusionResolver('subscriptionSandboxes', this.subscriptionSandboxes.inclusionResolver);
  }
}
