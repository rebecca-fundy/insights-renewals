import {inject} from '@loopback/core';
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
import {Allocation} from '../models';
import {AllocationRepository, SubscriptionRepository} from '../repositories';
import {Event} from '../services';

export class AllocationController {
  constructor(
    @repository(AllocationRepository)
    public allocationRepository: AllocationRepository,
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @inject('services.Event')
    protected eventService: Event
  ) { }

  @post('/allocations')
  @response(200, {
    description: 'Allocation model instance',
    content: {'application/json': {schema: getModelSchemaRef(Allocation)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Allocation, {
            title: 'NewAllocation',

          }),
        },
      },
    })
    allocation: Allocation,
  ): Promise<Allocation> {
    return this.allocationRepository.create(allocation);
  }

  @get('/allocations/count')
  @response(200, {
    description: 'Allocation model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Allocation) where?: Where<Allocation>,
  ): Promise<Count> {
    return this.allocationRepository.count(where);
  }

  @get('/allocations')
  @response(200, {
    description: 'Array of Allocation model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Allocation, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Allocation) filter?: Filter<Allocation>,
  ): Promise<Allocation[]> {
    // try {
    return this.subscriptionRepository.find()
      .then(subscriptionArray => {
        let monthLeaseProductId = process.env.CHARGIFY_ENV == "live" ? 5874530 : 5601362;
        let yearLeaseProductId = process.env.CHARGIFY_ENV == "live" ? 5135042 : 5081978;
        let filteredSubscriptionArray = subscriptionArray.filter(subscription => subscription.product_id != monthLeaseProductId && subscription.product_id != yearLeaseProductId);
        filteredSubscriptionArray.forEach(async subscription => {
          let compId = process.env.CHARGIFY_ENV == "live" ? 333725 : 385544;
          await this.eventService.getAllocations(subscription.id, compId)
            .then(allocationArray => {
              allocationArray.forEach(allocation => {
                let allocationItem = {
                  allocation_id: allocation.allocation.allocation_id,
                  subscription_id: allocation.allocation.subscription_id,
                  component_id: allocation.allocation.component_id,
                  quantity: allocation.allocation.quantity,
                  previous_quantity: allocation.allocation.previous_quantity,
                  timestamp: allocation.allocation.timestamp,
                };
                return this.allocationRepository.create(allocationItem);
              });
            });
        })
      })
      .then(() => this.allocationRepository.find(filter));




    // return this.allocationRepository.find(filter);

    // } catch (error) {
    //   console.log(error)
    // }
    // finally {
    //   console.log('debug3')
    //   return this.allocationRepository.find(filter);
    // }
  }

  @patch('/allocations')
  @response(200, {
    description: 'Allocation PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Allocation, {partial: true}),
        },
      },
    })
    allocation: Allocation,
    @param.where(Allocation) where?: Where<Allocation>,
  ): Promise<Count> {
    return this.allocationRepository.updateAll(allocation, where);
  }

  @get('/allocations/{id}')
  @response(200, {
    description: 'Allocation model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Allocation, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(Allocation, {exclude: 'where'}) filter?: FilterExcludingWhere<Allocation>
  ): Promise<Allocation> {
    return this.allocationRepository.findById(id, filter);
  }

  @patch('/allocations/{id}')
  @response(204, {
    description: 'Allocation PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Allocation, {partial: true}),
        },
      },
    })
    allocation: Allocation,
  ): Promise<void> {
    await this.allocationRepository.updateById(id, allocation);
  }

  @put('/allocations/{id}')
  @response(204, {
    description: 'Allocation PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() allocation: Allocation,
  ): Promise<void> {
    await this.allocationRepository.replaceById(id, allocation);
  }

  @del('/allocations/{id}')
  @response(204, {
    description: 'Allocation DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.allocationRepository.deleteById(id);
  }
}
