import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef, param, patch, post, put, requestBody,
  response
} from '@loopback/rest';
import {Subscription} from '../models';
import {SubscriptionRepository} from '../repositories';

export class ProjectedRevenueController {
  constructor(
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
  ) { }

  @post('/projected-revenue')
  @response(200, {
    description: 'Subscription model instance',
    content: {'application/json': {schema: getModelSchemaRef(Subscription)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Subscription, {
            title: 'NewSubscription',
            exclude: ['id'],
          }),
        },
      },
    })
    subscription: Omit<Subscription, 'id'>,
  ): Promise<Subscription> {
    return this.subscriptionRepository.create(subscription);
  }

  @get('/projected-revenue/count')
  @response(200, {
    description: 'Subscription model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Subscription) where?: Where<Subscription>,
  ): Promise<Count> {
    return this.subscriptionRepository.count(where);
  }

  @get('/projected-revenue/{since}/{until}')
  @response(200, {
    description: 'Array of Subscription model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Subscription, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.path.date('since') since?: Date,
    @param.path.date('until') until?: Date,
    @param.filter(Subscription) filter?: Filter<Subscription>,
  ): Promise<Subscription[]> {
    let today = new Date();
    let firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    let lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)

    console.log('param.where.since: ', since)

    // let since = new Date(filter?.where?.since)
    return this.subscriptionRepository.find(filter);
  }

  @patch('/projected-revenue')
  @response(200, {
    description: 'Subscription PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Subscription, {partial: true}),
        },
      },
    })
    subscription: Subscription,
    @param.where(Subscription) where?: Where<Subscription>,
  ): Promise<Count> {
    return this.subscriptionRepository.updateAll(subscription, where);
  }

  @get('/projected-revenue/{id}')
  @response(200, {
    description: 'Subscription model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Subscription, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(Subscription, {exclude: 'where'}) filter?: FilterExcludingWhere<Subscription>
  ): Promise<Subscription> {
    return this.subscriptionRepository.findById(id, filter);
  }

  @patch('/projected-revenue/{id}')
  @response(204, {
    description: 'Subscription PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Subscription, {partial: true}),
        },
      },
    })
    subscription: Subscription,
  ): Promise<void> {
    await this.subscriptionRepository.updateById(id, subscription);
  }

  @put('/projected-revenue/{id}')
  @response(204, {
    description: 'Subscription PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() subscription: Subscription,
  ): Promise<void> {
    await this.subscriptionRepository.replaceById(id, subscription);
  }

  @del('/projected-revenue/{id}')
  @response(204, {
    description: 'Subscription DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.subscriptionRepository.deleteById(id);
  }
}
