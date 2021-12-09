import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {EventDb} from '../models';
import {EventDbRepository} from '../repositories';

export class EventController {
  constructor(
    @repository(EventDbRepository)
    public eventDbRepository : EventDbRepository,
  ) {}

  @post('/event-dbs')
  @response(200, {
    description: 'EventDb model instance',
    content: {'application/json': {schema: getModelSchemaRef(EventDb)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EventDb, {
            title: 'NewEventDb',
            exclude: ['id'],
          }),
        },
      },
    })
    eventDb: Omit<EventDb, 'id'>,
  ): Promise<EventDb> {
    return this.eventDbRepository.create(eventDb);
  }

  @get('/event-dbs/count')
  @response(200, {
    description: 'EventDb model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(EventDb) where?: Where<EventDb>,
  ): Promise<Count> {
    return this.eventDbRepository.count(where);
  }

  @get('/event-dbs')
  @response(200, {
    description: 'Array of EventDb model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(EventDb, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(EventDb) filter?: Filter<EventDb>,
  ): Promise<EventDb[]> {
    return this.eventDbRepository.find(filter);
  }

  @patch('/event-dbs')
  @response(200, {
    description: 'EventDb PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EventDb, {partial: true}),
        },
      },
    })
    eventDb: EventDb,
    @param.where(EventDb) where?: Where<EventDb>,
  ): Promise<Count> {
    return this.eventDbRepository.updateAll(eventDb, where);
  }

  @get('/event-dbs/{id}')
  @response(200, {
    description: 'EventDb model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(EventDb, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(EventDb, {exclude: 'where'}) filter?: FilterExcludingWhere<EventDb>
  ): Promise<EventDb> {
    return this.eventDbRepository.findById(id, filter);
  }

  @patch('/event-dbs/{id}')
  @response(204, {
    description: 'EventDb PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(EventDb, {partial: true}),
        },
      },
    })
    eventDb: EventDb,
  ): Promise<void> {
    await this.eventDbRepository.updateById(id, eventDb);
  }

  @put('/event-dbs/{id}')
  @response(204, {
    description: 'EventDb PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() eventDb: EventDb,
  ): Promise<void> {
    await this.eventDbRepository.replaceById(id, eventDb);
  }

  @del('/event-dbs/{id}')
  @response(204, {
    description: 'EventDb DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.eventDbRepository.deleteById(id);
  }
}
