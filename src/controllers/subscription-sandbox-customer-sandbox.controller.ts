import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  SubscriptionSandbox,
  CustomerSandbox,
} from '../models';
import {SubscriptionSandboxRepository} from '../repositories';

export class SubscriptionSandboxCustomerSandboxController {
  constructor(
    @repository(SubscriptionSandboxRepository)
    public subscriptionSandboxRepository: SubscriptionSandboxRepository,
  ) { }

  @get('/subscription-sandboxes/{id}/customer-sandbox', {
    responses: {
      '200': {
        description: 'CustomerSandbox belonging to SubscriptionSandbox',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(CustomerSandbox)},
          },
        },
      },
    },
  })
  async getCustomerSandbox(
    @param.path.number('id') id: typeof SubscriptionSandbox.prototype.customer_id,
  ): Promise<CustomerSandbox> {
    return this.subscriptionSandboxRepository.customerSandboxId(id);
  }
}
