import {Getter, inject} from '@loopback/core';
import {DefaultCrudRepository, HasManyRepositoryFactory, repository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Customer, CustomerRelations, Subscription} from '../models';
import {SubscriptionRepository} from './subscription.repository';

export class CustomerRepository extends DefaultCrudRepository<
  Customer,
  typeof Customer.prototype.id,
  CustomerRelations
> {

  public readonly subscriptions: HasManyRepositoryFactory<Subscription, typeof Customer.prototype.id>;

  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('SubscriptionRepository')
    protected subscriptionRepositoryGetter: Getter<SubscriptionRepository>,
  ) {
    super(Customer, dataSource);
    this.subscriptions = this.createHasManyRepositoryFactoryFor('subscriptions', subscriptionRepositoryGetter,);
    this.registerInclusionResolver('subscriptions', this.subscriptions.inclusionResolver);
  }
}
