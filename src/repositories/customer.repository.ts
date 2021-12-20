import {Getter, inject} from '@loopback/core';
import {DefaultCrudRepository, HasManyRepositoryFactory, repository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Customer, CustomerRelations, Subscription, EventDb} from '../models';
import {SubscriptionRepository} from './subscription.repository';
import {EventDbRepository} from './event-db.repository';

export class CustomerRepository extends DefaultCrudRepository<
  Customer,
  typeof Customer.prototype.id,
  CustomerRelations
> {

  public readonly subscriptions: HasManyRepositoryFactory<Subscription, typeof Customer.prototype.id>;

  public readonly eventDbs: HasManyRepositoryFactory<EventDb, typeof Customer.prototype.id>;

  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
    @repository.getter('SubscriptionRepository')
    protected subscriptionRepositoryGetter: Getter<SubscriptionRepository>, @repository.getter('EventDbRepository') protected eventDbRepositoryGetter: Getter<EventDbRepository>,
  ) {
    super(Customer, dataSource);
    this.eventDbs = this.createHasManyRepositoryFactoryFor('eventDbs', eventDbRepositoryGetter,);
    this.registerInclusionResolver('eventDbs', this.eventDbs.inclusionResolver);
    this.subscriptions = this.createHasManyRepositoryFactoryFor('subscriptions', subscriptionRepositoryGetter,);
    this.registerInclusionResolver('subscriptions', this.subscriptions.inclusionResolver);
  }
}
