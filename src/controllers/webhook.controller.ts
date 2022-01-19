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
  getModelSchemaRef, param, patch, post, put, requestBody, response
} from '@loopback/rest';
import {ChargifyEvent, EventDb} from '../models';
import {ChargifyEventRepository, EventDbRepository, EventDbSandboxRepository} from '../repositories';

export class WebhookController {
  constructor(
    @repository(ChargifyEventRepository)
    public chargifyEventRepository: ChargifyEventRepository,
    @repository(EventDbRepository)
    public eventDbRepository: EventDbRepository,
    @repository(EventDbSandboxRepository)
    public eventDbSandboxRepository: EventDbSandboxRepository,
  ) { }

  @post('/webhook')
  @response(200, {
    description: 'ChargifyEvent model instance',
    content: {'application/json': {schema: getModelSchemaRef(EventDb)}},
  })
  async create(
    @requestBody({
      content: {
        'application/x-www-form-urlencoded': {
          // schema: getModelSchemaRef(EventDb, {
          //   title: 'NewChargifyEvent',
          // }),
        },
      },
    })
    chargifyEvent: any,
  ): Promise<EventDb> {
    let payload = chargifyEvent.payload;
    let id = chargifyEvent.id;
    let event = chargifyEvent.event
    let subdomain = payload["site"]["subdomain"]
    let subscription = payload["subscription"]
    let customer_id = subscription["customer"]["id"]
    console.log(id)
    console.log(event);
    console.log(payload["previous_allocation"])
    console.log(payload["new_allocation"])
    console.log(subscription["id"])
    console.log(subdomain)
    console.log(subscription["updated_at"])
    console.log(subscription["previous_state"])
    console.log(subscription["state"])
    console.log(subdomain == "fundy-suite-sandbox")

    let data: Partial<EventDb> = {
      id: chargifyEvent.id,
      subscription_id: subscription["id"],
      customer_id: customer_id,
      key: chargifyEvent.event,
      created_at: payload["timestamp"] || subscription["updated_at"],
      previous_allocation: payload["previous_allocation"],
      new_allocation: payload["new_allocation"],
      allocation_id: chargifyEvent.event == "component_allocation_change" ? chargifyEvent.id : null,
      previous_subscription_state: subscription["previous_state"],
      new_subscription_state: subscription["state"]

    }

    if (subdomain == "fundy-suite") {
      return this.eventDbRepository.create(data)
    } else {
      return this.eventDbSandboxRepository.create(data);
    }
  }

  @get('/webhook/count')
  @response(200, {
    description: 'ChargifyEvent model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(ChargifyEvent) where?: Where<ChargifyEvent>,
  ): Promise<Count> {
    return this.chargifyEventRepository.count(where);
  }

  @get('/webhook')
  @response(200, {
    description: 'Array of ChargifyEvent model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(ChargifyEvent, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(ChargifyEvent) filter?: Filter<ChargifyEvent>,
  ): Promise<ChargifyEvent[]> {
    return this.chargifyEventRepository.find(filter);
  }

  @patch('/webhook')
  @response(200, {
    description: 'ChargifyEvent PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ChargifyEvent, {partial: true}),
        },
      },
    })
    chargifyEvent: ChargifyEvent,
    @param.where(ChargifyEvent) where?: Where<ChargifyEvent>,
  ): Promise<Count> {
    return this.chargifyEventRepository.updateAll(chargifyEvent, where);
  }

  @get('/webhook/{id}')
  @response(200, {
    description: 'ChargifyEvent model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ChargifyEvent, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(ChargifyEvent, {exclude: 'where'}) filter?: FilterExcludingWhere<ChargifyEvent>
  ): Promise<ChargifyEvent> {
    return this.chargifyEventRepository.findById(id, filter);
  }

  @patch('/webhook/{id}')
  @response(204, {
    description: 'ChargifyEvent PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ChargifyEvent, {partial: true}),
        },
      },
    })
    chargifyEvent: ChargifyEvent,
  ): Promise<void> {
    await this.chargifyEventRepository.updateById(id, chargifyEvent);
  }

  @put('/webhook/{id}')
  @response(204, {
    description: 'ChargifyEvent PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() chargifyEvent: ChargifyEvent,
  ): Promise<void> {
    await this.chargifyEventRepository.replaceById(id, chargifyEvent);
  }

  @del('/webhook/{id}')
  @response(204, {
    description: 'ChargifyEvent DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.chargifyEventRepository.deleteById(id);
  }
}
