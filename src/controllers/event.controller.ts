import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter, FilterExcludingWhere, repository,
  Where
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef, param, post, requestBody,
  response
} from '@loopback/rest';
import {EventDb} from '../models';
import {AllocationRepository, CustomerEventRepository, CustomerRepository, EventDbRepository, EventDbSandboxRepository, SubscriptionRepository} from '../repositories';
import {Event, EventObject} from '../services';

export class EventController {
  constructor(
    @repository(EventDbRepository)
    public eventDbRepository: EventDbRepository,
    @repository(EventDbSandboxRepository)
    public eventDbSandboxRepository: EventDbSandboxRepository,
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @repository(CustomerEventRepository)
    public customerEventRepository: CustomerEventRepository,
    @repository(AllocationRepository)
    public allocationRepository: AllocationRepository,
    @inject('services.Event')
    protected eventService: Event
  ) { }

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
            // exclude: ['id'],
          }),
        },
      },
    })
    // eventDb: Omit<EventDb, 'id'>,
    eventDb: EventDb
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
    // return this.eventDbRepository.count(where);
    return process.env.CHARGIFY_ENV == "live" ? this.eventDbRepository.count(where) : this.eventDbSandboxRepository.count(where);
  }

  //Using /event GET endpint to load historical events
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
  ): Promise<EventDb[]> {    /* Storing historical event data */

    //Step 1: Fetch event data
    try {
      let eventCount = process.env.CHARGIFY_ENV == "live" ? (await this.eventDbRepository.count()).count : (await this.eventDbSandboxRepository.count()).count;
      let since_id: number = 0;
      if (eventCount != 0) {
        since_id = (await this.findMaxId()) + 1
      }
      // {throw Error("historical events loaded")}
      let eventArrayFetch: EventObject[] = []; //initialize eventArray to empty array
      let j: number = 1; //Index for fetching and storing multiple pages of events
      while (j > 0) { //While the length of the fetched array is 200
        await this.eventService.getEvents(j, since_id) //Grab a page of events from Chargify
          .then(tempArray => { //Add it to the array of already-fetched events
            eventArrayFetch = eventArrayFetch.concat(tempArray);
            return tempArray
          })
          .then(tempArray => { //If the length of the fetched array is less than 200, there are no more pages to collect so stop the loop.
            if (tempArray.length < 200) {
              j = -1
            } else {
              j++
            }
          });
      }

      //Step 2: Store event data in eventDb repository
      for (let i = 0; i < eventArrayFetch.length; i++) {
        let eventItem = eventArrayFetch[i].event;

        let eventData = {
          id: eventItem.id,
          subscription_id: eventItem.subscription_id,
          customer_id: eventItem.customer_id,
          created_at: new Date(eventItem.created_at),
          key: eventItem.key,
          previous_allocation: eventItem.event_specific_data.previous_allocation,
          new_allocation: eventItem.event_specific_data.new_allocation,
          allocation_id: eventItem.event_specific_data.allocation_id,
          previous_subscription_state: eventItem.event_specific_data.previous_subscription_state,
          new_subscription_state: eventItem.event_specific_data.new_subscription_state
        }
        if (process.env.CHARGIFY_ENV == "live") {
          await this.eventDbRepository.create(eventData)
        } else {
          await this.eventDbSandboxRepository.create(eventData)
        };
      }

    }
    catch (err) {console.log(err.message)}
    finally {
      return process.env.CHARGIFY_ENV == "live" ? this.eventDbRepository.find(filter) : this.eventDbSandboxRepository.find(filter);
    }
  }

  // @patch('/event-dbs')
  // @response(200, {
  //   description: 'EventDb PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(EventDb, {partial: true}),
  //       },
  //     },
  //   })
  //   eventDb: EventDb,
  //   @param.where(EventDb) where?: Where<EventDb>,
  // ): Promise<Count> {
  //   return this.eventDbRepository.updateAll(eventDb, where);
  // }

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

  @get('/event-dbs/maxId')
  @response(200, {
    description: 'EventDb model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(EventDb, {includeRelations: true}),
      },
    },
  })
  async findMaxId(
    // @param.path.number('id') id: number,
    // @param.filter(EventDb, {exclude: 'where'}) filter?: FilterExcludingWhere<EventDb>
  ): Promise<number> {
    const filter: Filter<EventDb> = {"order": ["id DESC"], "limit": 1}
    let maxEventItem = await this.eventDbRepository.find(filter)
    return maxEventItem[0].id || 0;
  }

  // @patch('/event-dbs/{id}')
  // @response(204, {
  //   description: 'EventDb PATCH success',
  // })
  // async updateById(
  //   @param.path.number('id') id: number,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(EventDb, {partial: true}),
  //       },
  //     },
  //   })
  //   eventDb: EventDb,
  // ): Promise<void> {
  //   await this.eventDbRepository.updateById(id, eventDb);
  // }

  // @put('/event-dbs/{id}')
  // @response(204, {
  //   description: 'EventDb PUT success',
  // })
  // async replaceById(
  //   @param.path.number('id') id: number,
  //   @requestBody() eventDb: EventDb,
  // ): Promise<void> {
  //   await this.eventDbRepository.replaceById(id, eventDb);
  // }

  // @del('/event-dbs/{id}')
  // @response(204, {
  //   description: 'EventDb DELETE success',
  // })
  // async deleteById(@param.path.number('id') id: number): Promise<void> {
  //   await this.eventDbRepository.deleteById(id);
  // }
}
