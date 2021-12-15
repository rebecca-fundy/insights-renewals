import {inject} from '@loopback/context';
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
import {Customer, CustomerEvent} from '../models';
import {CustomerEventRepository, CustomerRepository, EventDbRepository} from '../repositories';
import {Event, EventObject} from '../services';

function addMonths(date: Date, months: number, i?: number): Date {
  // console.log('date= ' + date)
  let date2 = new Date(date)
  let d = date2.getDate();
  // getDate gets day of the month (1 - 31)
  // if (i == 0) {console.log('d in addMonths fcn: ' + d)}
  date2.setMonth(date2.getMonth() + +months);
  //gets month from parameter, adds months param, then calls setMonth
  // if (i == 0) {console.log('date after call to setMonth before if: ' + date2.getDate())}
  if (date2.getDate() != d) {
    date2.setDate(0);
  }
  //if the day of the month is not equal to the original after adding the month then reset the day of the month to the last day of the previous month.
  // if (i == 0) {console.log('date after call to setMonth after if: ' + date2.getDate())}
  return date2;
}
//Use this for testing
function addMinutes(date: Date, minutes: number, i?: number): Date {
  let date2 = new Date(date)
  date2.setMinutes(date2.getMinutes() + +minutes);
  return date2;
}

export class CustomerController {
  constructor(
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @repository(EventDbRepository)
    protected eventDbRepository: EventDbRepository,
    @repository(CustomerEventRepository)
    protected customerEventRepository: CustomerEventRepository,
    @inject('services.Event')
    protected eventService: Event
  ) { }

  @post('/customers')
  @response(200, {
    description: 'Customer model instance',
    content: {'application/json': {schema: getModelSchemaRef(Customer)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Customer, {
            title: 'NewCustomer',
            // exclude: ['id'],
          }),
        },
      },
    })
    // customer: Omit<Customer, 'id'>,
    customer: Customer,

  ): Promise<Customer> {
    return this.customerRepository.create(customer);
  }

  @get('/customers/count')
  @response(200, {
    description: 'Customer model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Customer) where?: Where<Customer>,
  ): Promise<Count> {
    return this.customerRepository.count(where);
  }

  /*
  We can simply include the relation in queries via find(), findOne(), and findById() methods.
  For example, these queries return all customers with their Subscriptions:

  if you process data at the repository level:
  customerRepo.find({include: ['subscriptions']});

  this is the same as the url:
    GET http://localhost:3000/customers?filter[include][]=subscriptions

    This is how to structure the filter/query through the /explorer API to get an array of customers, each with an array of subscriptions:
      {
        "include": [
            {
              "relation": "subscriptions"
            }
        ]
      }
  Formatted for cut/paste:
{"include": [{"relation": "subscriptions"}]}
{"include": [{"relation": "eventDbs"}]}
  */

  @get('/customers')
  @response(200, {
    description: 'Array of Customer model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Customer, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Customer) filter?: Filter<Customer>,
  ): Promise<Customer[]> {
    /* Storing historical event data */
    let eventArrayFetch: EventObject[] = [];
    let j: number = 1;
    while (j > 0) {
      console.log(j);
      await this.eventService.getEvents(j)
        .then(tempArray => {
          eventArrayFetch = eventArrayFetch.concat(tempArray);
          return tempArray
        })
        .then(tempArray => {
          console.log(`tempArray.length= ${tempArray.length}`);
          console.log(`eventArrayFetch.length= ${eventArrayFetch.length}`);
          if (tempArray.length < 200) {
            j = -1
          } else {
            j++
          }
        });
    }
    const customerArray = await this.customerRepository.find(filter);
    console.log(`eventArrayFetch.length = ${eventArrayFetch.length}`)
    for (let i = 0; i < eventArrayFetch.length; i++) {
      let eventItem = eventArrayFetch[i].event;
      console.log(eventItem.id);

      let eventData = {
        id: eventItem.id,
        subscription_id: eventItem.subscription_id,
        customer_id: eventItem.customer_id,
        created_at: new Date(eventItem.created_at),
        previous_allocation: eventItem.event_specific_data.previous_allocation,
        new_allocation: eventItem.event_specific_data.new_allocation
      }
      await this.eventDbRepository.create(eventData);
    }
    // writeFile('output.json', JSON.stringify(eventArray), () => { });
    //  */

    //Setting of historical PE event data by customer
    let today = new Date();
    const eventArray = await this.eventDbRepository.find();
    // const customerArray = await this.customerRepository.find()

    // if (index == 0) {
    console.log('today date: ' + today);
    console.log('today + 3m: ' + addMonths(today, 3))
    console.log('today + 1y: ' + addMonths(today, 15));
    console.log('today + 2y: ' + addMonths(today, 27));
    console.log('today + 3y: ' + addMonths(today, 39));

    // }

    customerArray.forEach((customer, index) => {
      let custCreationDate = customer.created_at
      let threeMonths = addMonths(custCreationDate, 3, index)
      let oneYear = addMonths(custCreationDate, 15, index)
      let twoYears = addMonths(custCreationDate, 27, index)
      let threeYears = addMonths(custCreationDate, 39, index)

      //For testing only. Comment out when not testing
      // threeMonths = addMinutes(custCreationDate, 5, index)
      // oneYear = addMinutes(custCreationDate, 6, index)
      // twoYears = addMinutes(custCreationDate, 7, index)
      // threeYears = addMinutes(custCreationDate, 8, index)


      let data: Partial<CustomerEvent> = {
        customer_id: customer.id,
        customer_created: customer.created_at
      }
      //Assume PE is on by default when customer is created. The first component_allocation_event would only exist if the component is turned off at some point.
      //The event array is requested in ascending order so subsequent events for the same customer (such as upgrading and turning a component on) would happen later in time.
      eventArray.forEach(event => {
        if (event.customer_id == customer.id) {
          if (event.created_at <= threeMonths) {
            event.new_allocation == 0
              ? data.peOffAt3 = true
              : data.peOffAt3 = false
          }
          else if (threeMonths < event.created_at && event.created_at <= oneYear) {
            event.new_allocation == 0
              ? data.peOffAt15 = true
              : data.peOffAt15 = false
          }
          else if (oneYear < event.created_at && event.created_at <= twoYears) {
            event.new_allocation == 0
              ? data.peOffAt27 = true
              : data.peOffAt27 = false
          }
          else if (twoYears < event.created_at && event.created_at <= threeYears) {
            event.new_allocation == 0
              ? data.peOffAt39 = true
              : data.peOffAt39 = false
          }
        }
      })

      //If the customer has no component allocation events at the relevant time points since they became a customer, then we assume they have not dropped off.
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
      this.customerEventRepository.create(data);
    });


    return this.customerRepository.find(filter);
  }

  @patch('/customers')
  @response(200, {
    description: 'Customer PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Customer, {partial: true}),
        },
      },
    })
    customer: Customer,
    @param.where(Customer) where?: Where<Customer>,
  ): Promise<Count> {
    return this.customerRepository.updateAll(customer, where);
  }

  @get('/customers/{id}')
  @response(200, {
    description: 'Customer model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Customer, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(Customer, {exclude: 'where'}) filter?: FilterExcludingWhere<Customer>
  ): Promise<Customer> {
    return this.customerRepository.findById(id, filter);
  }

  @patch('/customers/{id}')
  @response(204, {
    description: 'Customer PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Customer, {partial: true}),
        },
      },
    })
    customer: Customer,
  ): Promise<void> {
    await this.customerRepository.updateById(id, customer);
  }

  @put('/customers/{id}')
  @response(204, {
    description: 'Customer PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() customer: Customer,
  ): Promise<void> {
    await this.customerRepository.replaceById(id, customer);
  }

  @del('/customers/{id}')
  @response(204, {
    description: 'Customer DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.customerRepository.deleteById(id);
  }
}
