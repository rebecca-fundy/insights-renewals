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
import {CustomerEvent, EventDb} from '../models';
import {CustomerEventRepository, CustomerRepository, EventDbRepository, SubscriptionRepository} from '../repositories';
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
      console.log(`eventArrayFetch.length before allocations = ${eventArrayFetch.length}`)
      // Step 2: Fetch allocation data, format them into events and append them to the event array
      //Filter this subscription array according to which product we're seeking.
      //for sandbox:
      const monthLeaseProductId = 5601362;
      const yearLeaseProductId = 5081978;
      let subscriptionArray = await this.subscriptionRepository.find();
      let filteredSubscriptionArray = subscriptionArray.filter(subscription => subscription.product_id != monthLeaseProductId && subscription.product_id != yearLeaseProductId);
      let allocationEvents = filteredSubscriptionArray
        .forEach(async subscription => {
          const compId = 385544;
          const allocations = await this.eventService.getAllocations(subscription.id, compId);
          allocations.forEach(allocation => {
            let eventData: EventObject = {
              event: {
                id: allocation.allocation.allocation_id,
                customer_id: subscription.customer_id,
                subscription_id: subscription.id,
                key: 'component_allocation_change',
                created_at: allocation.allocation.timestamp,
                event_specific_data: {
                  allocation_id: allocation.allocation.allocation_id,
                  component_id: compId,
                  previous_allocation: allocation.allocation.previous_quantity,
                  new_allocation: allocation.allocation.quantity
                }
              }
            };
            let filterId = allocation.allocation.allocation_id;
            let existingEvent = eventArrayFetch.filter(event => event.event.event_specific_data.allocation_id == filterId);
            if (existingEvent.length == 0) {
              eventArrayFetch.push(eventData);
            }
          });

        });
      // })
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
        await this.eventDbRepository.create(eventData);
      }

      //Setting of historical PE event data by customer
      let today = new Date();

      //Grab array of customers and events; events ordered by ascending creation date.
      const customerArray = await this.customerRepository.find();
      const eventArray = await this.eventDbRepository.find({order: ["subscription_id ASC", "created_at ASC"]});
      const leaseProducts = {monthLease: 5601362, yearLease: 5081978}
      //For each customer, set the appropriate time points
      customerArray.forEach((customer) => {
        let custCreationDate = new Date(customer.created_at)
        let signup = new Date(custCreationDate.setMinutes(custCreationDate.getMinutes() + 1));
        let threeMonths = addMonths(custCreationDate, 3)
        let oneYear = addMonths(custCreationDate, 15)
        let twoYears = addMonths(custCreationDate, 27)
        let threeYears = addMonths(custCreationDate, 39)
        let products = subscriptionArray.filter(subscription => subscription.customer_id === customer.id).sort()
        console.log(`product: ${JSON.stringify(products)}`);
        let productType = "non-lease"
        if (products[products.length - 1].product_id == leaseProducts.monthLease) {
          productType = "month lease"
        } else if (products[products.length - 1].product_id == leaseProducts.yearLease) {
          productType = "year lease"
        }
        //For testing only. Comment out when not testing
        // threeMonths = addMinutes(custCreationDate, 5, index)
        // oneYear = addMinutes(custCreationDate, 6, index)
        // twoYears = addMinutes(custCreationDate, 7, index)
        // threeYears = addMinutes(custCreationDate, 8, index)

        //Initialize data object for creating a customer-event item for this customer
        let data: Partial<CustomerEvent> = {
          customer_id: customer.id,
          customer_created: customer.created_at,
          productType: productType
        }

        //initialize valid timepoints. If there are no events for a valid timepoint, then PE was never turned on, so I initialize that to true and the others to false.
        if (data.peOffAtSignup == undefined) {
          data.peOffAtSignup = true
        }
        if (today > threeMonths && data.peOffAt3 == undefined) {
          data.peOffAt3 = false
        }
        if (today > oneYear && data.peOffAt15 == undefined) {
          data.peOffAt15 = false
        }
        if (today > twoYears && data.peOffAt27 == undefined) {
          data.peOffAt27 = false
        }
        if (today > threeYears && data.peOffAt39 == undefined) {
          data.peOffAt39 = false
        }
        let peAlreadyOff: boolean = true
        //The event array is requested in ascending order so subsequent events for the same customer (such as upgrading and turning a component on) would happen later in time.
        eventArray.forEach(event => {
          if (event.customer_id == customer.id) {

            if (event.created_at <= signup && event.new_allocation == 1) {
              data.peOffAtSignup = false;
              peAlreadyOff = false;
            }
            else if (event.created_at <= threeMonths) {
              if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
                data.peOffAt3 = true;
                peAlreadyOff = true
              } else if (event.new_allocation == 1) {
                peAlreadyOff = false
                data.peOffAt3 = false
              }
            }
            else if (event.created_at <= oneYear) {
              if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
                data.peOffAt15 = true;
                peAlreadyOff = true
              } else if (event.new_allocation == 1) {
                peAlreadyOff = false
                data.peOffAt15 = false
              }
            }
            else if (event.created_at <= twoYears) {
              if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
                data.peOffAt27 = true;
                peAlreadyOff = true
              } else if (event.new_allocation == 1) {
                peAlreadyOff = false
                data.peOffAt27 = false
              }
            }
            else if (event.created_at <= threeYears) {
              if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
                data.peOffAt39 = true;
                peAlreadyOff = true
              } else if (event.new_allocation == 1) {
                peAlreadyOff = false
                data.peOffAt39 = false
              }
            }
            // if (customer.id == 31767483) {
            //   console.log('Shaindel')
            //   console.log(event.created_at)
            //   console.log(event.key)
            //   console.log(peAlreadyOff)
            // }
          }

        })

        this.customerEventRepository.create(data);
      })
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
