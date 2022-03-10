import {Getter, inject} from '@loopback/core';
import {BelongsToAccessor, DefaultCrudRepository, repository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Customer, Subscription, SubscriptionRelations} from '../models';
import {CustomerRepository} from './customer.repository';

export interface DateFilter {
  since: Date,
  until: Date
}

export interface ProjectionReport {
  proEnhancementsProjection: {
    name: string,
    totalAmount: number
  },
  monthLeaseProjection: {
    name: string,
    totalAmount: number,
  },
  yearLeaseProjection: {
    name: string,
    totalAmount: number
  }
  totalProjection: {
    name: string,
    totalAmount: number
  }
}


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
