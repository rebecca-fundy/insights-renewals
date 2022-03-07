import {
  repository
} from '@loopback/repository';
import {CustomerRepository} from '../repositories';

export class CustomerSubscriptionController {
  constructor(
    @repository(CustomerRepository) protected customerRepository: CustomerRepository,
  ) { }

  // @get('/customers/{id}/subscriptions', {
  //   responses: {
  //     '200': {
  //       description: 'Array of Customer has many Subscription',
  //       content: {
  //         'application/json': {
  //           schema: {type: 'array', items: getModelSchemaRef(Subscription)},
  //         },
  //       },
  //     },
  //   },
  // })
  // async find(
  //   @param.path.number('id') id: number,
  //   @param.query.object('filter') filter?: Filter<Subscription>,
  // ): Promise<Subscription[]> {
  //   return this.customerRepository.subscriptions(id).find(filter);
  // }

  // @post('/customers/{id}/subscriptions', {
  //   responses: {
  //     '200': {
  //       description: 'Customer model instance',
  //       content: {'application/json': {schema: getModelSchemaRef(Subscription)}},
  //     },
  //   },
  // })
  // async create(
  //   @param.path.number('id') id: typeof Customer.prototype.id,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Subscription, {
  //           title: 'NewSubscriptionInCustomer',
  //           exclude: ['id'],
  //           optional: ['customer_id']
  //         }),
  //       },
  //     },
  //   }) subscription: Omit<Subscription, 'id'>,
  // ): Promise<Subscription> {
  //   return this.customerRepository.subscriptions(id).create(subscription);
  // }

  // @patch('/customers/{id}/subscriptions', {
  //   responses: {
  //     '200': {
  //       description: 'Customer.Subscription PATCH success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async patch(
  //   @param.path.number('id') id: number,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(Subscription, {partial: true}),
  //       },
  //     },
  //   })
  //   subscription: Partial<Subscription>,
  //   @param.query.object('where', getWhereSchemaFor(Subscription)) where?: Where<Subscription>,
  // ): Promise<Count> {
  //   return this.customerRepository.subscriptions(id).patch(subscription, where);
  // }

  // @del('/customers/{id}/subscriptions', {
  //   responses: {
  //     '200': {
  //       description: 'Customer.Subscription DELETE success count',
  //       content: {'application/json': {schema: CountSchema}},
  //     },
  //   },
  // })
  // async delete(
  //   @param.path.number('id') id: number,
  //   @param.query.object('where', getWhereSchemaFor(Subscription)) where?: Where<Subscription>,
  // ): Promise<Count> {
  //   return this.customerRepository.subscriptions(id).delete(where);
  // }
}
