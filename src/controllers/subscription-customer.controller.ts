import {
  repository
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef, param
} from '@loopback/rest';
import {Customer, Subscription} from '../models';
import {SubscriptionRepository} from '../repositories';

export class SubscriptionCustomerController {
  constructor(
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
  ) { }

  @get('/subscriptions/{id}/customer', {
    responses: {
      '200': {
        description: 'Customer belonging to Subscription',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Customer)},
          },
        },
      },
    },
  })
  async getCustomer(
    @param.path.number('id') id: typeof Subscription.prototype.id,
  ): Promise<Customer> {
    return this.subscriptionRepository.customerId(id);
  }
}
