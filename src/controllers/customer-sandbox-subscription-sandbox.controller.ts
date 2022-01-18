import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  CustomerSandbox,
  SubscriptionSandbox,
} from '../models';
import {CustomerSandboxRepository} from '../repositories';

export class CustomerSandboxSubscriptionSandboxController {
  constructor(
    @repository(CustomerSandboxRepository) protected customerSandboxRepository: CustomerSandboxRepository,
  ) { }

  @get('/customer-sandboxes/{id}/subscription-sandboxes', {
    responses: {
      '200': {
        description: 'Array of CustomerSandbox has many SubscriptionSandbox',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(SubscriptionSandbox)},
          },
        },
      },
    },
  })
  async find(
    @param.path.number('id') id: number,
    @param.query.object('filter') filter?: Filter<SubscriptionSandbox>,
  ): Promise<SubscriptionSandbox[]> {
    return this.customerSandboxRepository.subscriptionSandboxes(id).find(filter);
  }

  @post('/customer-sandboxes/{id}/subscription-sandboxes', {
    responses: {
      '200': {
        description: 'CustomerSandbox model instance',
        content: {'application/json': {schema: getModelSchemaRef(SubscriptionSandbox)}},
      },
    },
  })
  async create(
    @param.path.number('id') id: typeof CustomerSandbox.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SubscriptionSandbox, {
            title: 'NewSubscriptionSandboxInCustomerSandbox',
            exclude: ['id'],
            optional: ['customer_id']
          }),
        },
      },
    }) subscriptionSandbox: Omit<SubscriptionSandbox, 'id'>,
  ): Promise<SubscriptionSandbox> {
    return this.customerSandboxRepository.subscriptionSandboxes(id).create(subscriptionSandbox);
  }

  @patch('/customer-sandboxes/{id}/subscription-sandboxes', {
    responses: {
      '200': {
        description: 'CustomerSandbox.SubscriptionSandbox PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(SubscriptionSandbox, {partial: true}),
        },
      },
    })
    subscriptionSandbox: Partial<SubscriptionSandbox>,
    @param.query.object('where', getWhereSchemaFor(SubscriptionSandbox)) where?: Where<SubscriptionSandbox>,
  ): Promise<Count> {
    return this.customerSandboxRepository.subscriptionSandboxes(id).patch(subscriptionSandbox, where);
  }

  @del('/customer-sandboxes/{id}/subscription-sandboxes', {
    responses: {
      '200': {
        description: 'CustomerSandbox.SubscriptionSandbox DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.number('id') id: number,
    @param.query.object('where', getWhereSchemaFor(SubscriptionSandbox)) where?: Where<SubscriptionSandbox>,
  ): Promise<Count> {
    return this.customerSandboxRepository.subscriptionSandboxes(id).delete(where);
  }
}
