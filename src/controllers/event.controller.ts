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
import {EventDb} from '../models';
import {AllocationRepository, CustomerEventRepository, CustomerRepository, EventDbRepository, SubscriptionRepository} from '../repositories';
import {Event, EventObject} from '../services';

function addMonths(date: Date, months: number): Date {
  let date2 = new Date(date)
  // getDate gets day of the month (1 - 31)
  let d = date2.getDate();

  //gets month from parameter, adds months param, then calls setMonth
  date2.setMonth(date2.getMonth() + +months);

  //if the day of the month is not equal to the original after adding the month then reset the day of the month to the last day of the previous month.
  if (date2.getDate() != d) {
    date2.setDate(0);
  }

  return date2;
}
//Use this for testing
function addMinutes(date: Date, minutes: number, i?: number): Date {
  let date2 = new Date(date)
  date2.setMinutes(date2.getMinutes() + +minutes);
  return date2;
}

export class EventController {
  constructor(
    @repository(EventDbRepository)
    public eventDbRepository: EventDbRepository,
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
      let eventArrayFetch: EventObject[] = []; //initialize eventArray to empty array
      let j: number = 1; //Index for fetching and storing multiple pages of events
      while (j > 0) { //While the length of the fetched array is 200
        await this.eventService.getEvents(j) //Grab a page of events from Chargify
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
      // console.log(`eventArrayFetch.length before allocations = ${eventArrayFetch.length}`)
      // Step 2: Fetch allocation data, format them into events and append them to the event array

      let subscriptionArray = await this.subscriptionRepository.find();
      // let filteredSubscriptionArray = subscriptionArray.filter(subscription => subscription.product_id != monthLeaseProductId && subscription.product_id != yearLeaseProductId);
      // let allocationArray = await this.allocationRepository.find();
      // allocationArray.forEach(allocation => {
      //   let eventData: EventObject = {
      //     event: {
      //       id: allocation.allocation_id,
      //       customer_id: subscriptionArray.filter(sub => sub.id == allocation.subscription_id)[0].customer_id,
      //       subscription_id: allocation.subscription_id,
      //       key: 'component_allocation_change',
      //       created_at: allocation.timestamp,
      //       event_specific_data: {
      //         allocation_id: allocation.allocation_id,
      //         component_id: allocation.component_id,
      //         previous_allocation: allocation.previous_quantity,
      //         new_allocation: allocation.quantity
      //       }
      //     }
      //   }
      //   let filterId = allocation.allocation_id;
      //   let existingEvent = eventArrayFetch.filter(event => event.event.event_specific_data.allocation_id == filterId);
      //   if (existingEvent.length == 0) {
      //     eventArrayFetch.push(eventData);
      //   }
      // })

      //Step 3: Store event data in eventDb repository
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
        await this.eventDbRepository.create(eventData);
      }

    }
    catch (err) {console.log(err.message)}
    finally {
      return this.eventDbRepository.find(filter);
    }
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
