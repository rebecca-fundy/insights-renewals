import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {SubscriptionSandbox, SubscriptionSandboxRelations, CustomerSandbox} from '../models';
import {CustomerSandboxRepository} from './customer-sandbox.repository';

export class SubscriptionSandboxRepository extends DefaultCrudRepository<
  SubscriptionSandbox,
  typeof SubscriptionSandbox.prototype.id,
  SubscriptionSandboxRelations
> {

  public readonly customerSandboxId: BelongsToAccessor<CustomerSandbox, typeof SubscriptionSandbox.prototype.customer_id>;

  constructor(
    @inject('datasources.db') dataSource: DbDataSource, @repository.getter('CustomerSandboxRepository') protected customerSandboxRepositoryGetter: Getter<CustomerSandboxRepository>,
  ) {
    super(SubscriptionSandbox, dataSource);
    this.customerSandboxId = this.createBelongsToAccessorFor('customerSandboxId', customerSandboxRepositoryGetter,);
    this.registerInclusionResolver('customerSandboxId', this.customerSandboxId.inclusionResolver);
  }
}
