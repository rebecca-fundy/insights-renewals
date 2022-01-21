import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Subscription, SubscriptionRelations, Customer} from '../models';
import {CustomerRepository} from './customer.repository';

export class SubscriptionRepository extends DefaultCrudRepository<
  Subscription,
  typeof Subscription.prototype.id,
  SubscriptionRelations
> {

  public readonly customerId: BelongsToAccessor<Customer, typeof Subscription.prototype.id>;

  constructor(
    @inject('datasources.db') dataSource: DbDataSource, @repository.getter('CustomerRepository') protected customerRepositoryGetter: Getter<CustomerRepository>,
  ) {
    super(Subscription, dataSource);
    this.customerId = this.createBelongsToAccessorFor('customerId', customerRepositoryGetter,);
    this.registerInclusionResolver('customerId', this.customerId.inclusionResolver);
  }
}
