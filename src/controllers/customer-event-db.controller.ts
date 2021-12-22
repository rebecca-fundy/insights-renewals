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
  Customer,
  EventDb,
} from '../models';
import {CustomerRepository} from '../repositories';

export class CustomerEventDbController {
  constructor(
    @repository(CustomerRepository) protected customerRepository: CustomerRepository,
  ) { }

  @get('/customers/{id}/event-dbs', {
    responses: {
      '200': {
        description: 'Array of Customer has many EventDb',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(EventDb)},
          },
        },
      },
    },
  })
  async find(
    @param.path.number('id') id: number,
    @param.query.object('filter') filter?: Filter<EventDb>,
  ): Promise<EventDb[]> {
    return this.customerRepository.eventDbs(id).find(filter);
  }

  @post('/customers/{id}/event-dbs', {
    responses: {
      '200': {
        description: 'Customer model instance',
        content: {'application/json': {schema: getModelSchemaRef(EventDb)}},
      },
    },
  })
  async create(
    @param.path.number('id') id: typeof Customer.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EventDb, {
            title: 'NewEventDbInCustomer',
            exclude: ['id'],
            optional: ['customer_id']
          }),
        },
      },
    }) eventDb: Omit<EventDb, 'id'>,
  ): Promise<EventDb> {
    return this.customerRepository.eventDbs(id).create(eventDb);
  }

  @patch('/customers/{id}/event-dbs', {
    responses: {
      '200': {
        description: 'Customer.EventDb PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EventDb, {partial: true}),
        },
      },
    })
    eventDb: Partial<EventDb>,
    @param.query.object('where', getWhereSchemaFor(EventDb)) where?: Where<EventDb>,
  ): Promise<Count> {
    return this.customerRepository.eventDbs(id).patch(eventDb, where);
  }

  @del('/customers/{id}/event-dbs', {
    responses: {
      '200': {
        description: 'Customer.EventDb DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.number('id') id: number,
    @param.query.object('where', getWhereSchemaFor(EventDb)) where?: Where<EventDb>,
  ): Promise<Count> {
    return this.customerRepository.eventDbs(id).delete(where);
  }
}
