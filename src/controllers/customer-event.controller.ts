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
import {CustomerEvent} from '../models';
import {CustomerEventRepository, CustomerRepository, DropoffTable, EventDbRepository, SubscriptionRepository} from '../repositories';

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

export class CustomerEventController {
  constructor(
    @repository(CustomerEventRepository)
    public customerEventRepository: CustomerEventRepository,
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @repository(EventDbRepository)
    public eventDbRepository: EventDbRepository,
    // public dropoffTable: DropoffTable
  ) { }

  @post('/customer-events')
  @response(200, {
    description: 'CustomerEvent model instance',
    content: {'application/json': {schema: getModelSchemaRef(CustomerEvent)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CustomerEvent, {
            title: 'NewCustomerEvent',
            exclude: ['idCustomerEvent'],
          }),
        },
      },
    })
    customerEvent: Omit<CustomerEvent, 'idCustomerEvent'>,
  ): Promise<CustomerEvent> {
    return this.customerEventRepository.create(customerEvent);
  }

  @get('/customer-events/count')
  @response(200, {
    description: 'CustomerEvent model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(CustomerEvent) where?: Where<CustomerEvent>,
  ): Promise<Count> {
    return this.customerEventRepository.count(where);
  }

  @get('/customer-events')
  @response(200, {
    description: 'Array of CustomerEvent model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(CustomerEvent, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(CustomerEvent) filter?: Filter<CustomerEvent>,
  ): Promise<CustomerEvent[]> {
    return this.customerEventRepository.find(filter);
  }

  //Add drop-off type (PE, month lease, year lease) to model, service, params
  @get('/customer-events/drop-offs')
  @response(200, {
    description: 'Object with drop-off perentages',
    content: {
      'application/json': {
        schema: {
          // type:
        },
      },
    },
  })
  async findDropOffs(
    @param.filter(CustomerEvent) filter?: Filter<CustomerEvent>,
  ): Promise<DropoffTable> {
    //Setting of historical PE event data by customer
    let today = new Date();

    //Grab array of customers and events; events ordered by ascending creation date.
    const customerArray = await this.customerRepository.find();
    const monthLeaseProductId = 5601362;
    const yearLeaseProductId = 5081978;
    let subscriptionArray = await this.subscriptionRepository.find();
    const eventArray = await this.eventDbRepository.find({order: ["subscription_id ASC", "created_at ASC"]});
    //For each customer, set the appropriate time points.
    //PE allocation could happen a little bit after cust creation date, esp. in sandbox, so set signup timepoint as 1 minute past customer creation date.
    //TO DO: add three weeks to timepoints
    customerArray.forEach((customer) => {
      let products = subscriptionArray.filter(subscription => subscription.customer_id === customer.id).sort()
      // If a customer has no subscription, set the beginning date to the customer creation date. Otherwise, set the beginning date to the creation date of their first subscription. This is more accurate, as it is not affected by the potential lag between signing up in Chargify and initiating the purchase.
      let custCreationDate = products.length == 0 ? new Date(customer.created_at) : new Date(products[0].created_at);

      let customerEvents = eventArray.filter(event => event.customer_id == customer.id)

      let signup = new Date(custCreationDate.setMinutes(custCreationDate.getMinutes() + 1));
      let threeMonths = addMonths(custCreationDate, 3)
      let oneYear = addMonths(custCreationDate, 15)
      let twoYears = addMonths(custCreationDate, 27)
      let threeYears = addMonths(custCreationDate, 39)

      let productType = ""
      if (products.length != 0 && products[products.length - 1].product_id == monthLeaseProductId) {
        productType = "month lease"
      } else if (products.length != 0 && products[products.length - 1].product_id == yearLeaseProductId) {
        productType = "year lease"
      } else if (products.length != 0) {
        productType = "non-lease"
      }


      //Initialize data object for creating a customer-event item for this customer
      let data: Partial<CustomerEvent> = {
        customer_id: customer.id,
        customer_created: customer.created_at,
        productType: productType
      }

      //Initialize valid timepoints. If there are no events for a valid timepoint for a non-lease product, then PE allocation is the same as the "current" subscription allocation, so I initialize that to the peOn value for the subscription model. Lease products have PE defaulted to false. Otherwise, I assume PE defaults to "off" and rely on the events to set it.
      //If there are no events for a valid timepoint for a lease product, then it was never canceled, so that should be false.
      if (data.peOffAtSignup === undefined) {
        if ((data.productType == "non-lease" || customerEvents.length == 0) && products.length != 0) {
          data.peOffAtSignup = !products[0].peOn
        } else {
          data.peOffAtSignup = true
        }
      }
      if (today > threeMonths && data.peOffAt3 === undefined) {
        data.peOffAt3 = false
      }
      if (today > oneYear && data.peOffAt15 === undefined) {
        data.peOffAt15 = false
      }
      if (today > twoYears && data.peOffAt27 === undefined) {
        data.peOffAt27 = false
      }
      if (today > threeYears && data.peOffAt39 === undefined) {
        data.peOffAt39 = false
      }
      // let peAlreadyOff: boolean = data.productType == "non-lease" ? true : false
      let peAlreadyOff = data.peOffAtSignup;
      // console.log(`product type: ${data.productType}' peAlreadyOff: ${peAlreadyOff}`);

      //The event array is requested in ascending order so subsequent events for the same customer (such as upgrading and turning a component on) would happen later in time.
      customerEvents.forEach(event => {
        if (event.customer_id == customer.id) {
          //allocation endpoint will generate a new allocation == 1 if PE activated at signup
          if (event.created_at <= signup && event.new_allocation == 1) {
            data.peOffAtSignup = false;
            peAlreadyOff = false;
          }
          else if (event.created_at <= threeMonths) {
            //If there's an allocation event turning PE off, or a subscription cancellation, and PE hasn't been turned off already, turn it off.
            //Lease products are initialized to peOff = false, so a canceled subscription will change dropoff to true.
            if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
              data.peOffAt3 = true;
              peAlreadyOff = true
              //Alternatively, if an allocation event shows PE was turned on, or a subcription state was changed to "active" then we do not regard this as a dropoff. This is for the case that a customer upgrades, the first subscription will generate a cancellation event, but the new subscription will generate an "active" event.
              //TODO: test/analyze for upgrades where PE was never on.
              //Test by adding condition for data.peOffAtSignup = false
            } else if (event.new_allocation == 1 || (data.productType != "non-lease" && event.new_subscription_state == "active")) {
              peAlreadyOff = false
              data.peOffAt3 = false
            }
          }
          else if (event.created_at <= oneYear) {
            if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
              data.peOffAt15 = true;
              peAlreadyOff = true
            } else if (event.new_allocation == 1 || (data.productType != "non-lease" && event.new_subscription_state == "active")) {
              peAlreadyOff = false
              data.peOffAt15 = false
            }
          }
          else if (event.created_at <= twoYears) {
            if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
              data.peOffAt27 = true;
              peAlreadyOff = true
            } else if (event.new_allocation == 1 || (data.productType != "non-lease" && event.new_subscription_state == "active")) {
              peAlreadyOff = false
              data.peOffAt27 = false
            }
          }
          else if (event.created_at <= threeYears) {
            if ((event.new_allocation == 0 || event.new_subscription_state == 'canceled') && !peAlreadyOff) {
              data.peOffAt39 = true;
              peAlreadyOff = true
            } else if (event.new_allocation == 1 || (data.productType != "non-lease" && event.new_subscription_state == "active")) {
              peAlreadyOff = false
              data.peOffAt39 = false
            }
          }
        }
      })
      this.customerEventRepository.create(data);
    })

    //filter on product type = "non-lease", "month lease" or "year lease"
    //Pro Enhancement filters do not apply to lease products.
    //Need to make it more generic.
    let totalCust = (await this.find(filter));
    let signupDropCount = totalCust.filter(cust => cust.peOffAtSignup).length
    let signupFalseCount = totalCust.filter(cust => cust.peOffAtSignup === false).length
    let dropoffAtSignup = signupDropCount / (signupFalseCount + signupDropCount)

    let threeMthDropCount = totalCust.filter(cust => cust.peOffAt3).length
    //null values indicate that the time point filter does not apply to this customer (e.g. it is less than 3 months since the customer creation date) so we need to distinguish between null values and false values.
    let threeMthFalseCount = totalCust.filter(cust => cust.peOffAt3 === false).length
    let dropoffAt3m = threeMthDropCount / (threeMthFalseCount + threeMthDropCount);

    let oneYrDropCount = totalCust.filter(cust => cust.peOffAt15).length
    let oneYrFalseCount = totalCust.filter(cust => cust.peOffAt15 === false).length
    let dropoffAt1y = oneYrDropCount / (oneYrFalseCount + oneYrDropCount);

    let twoYrDropCount = totalCust.filter(cust => cust.peOffAt27).length
    let twoYrFalseCount = totalCust.filter(cust => cust.peOffAt27 === false).length
    let dropoffAt2y = twoYrDropCount / (twoYrFalseCount + twoYrDropCount);

    let threeYrDropCount = totalCust.filter(cust => cust.peOffAt39).length
    let threeYrFalseCount = totalCust.filter(cust => cust.peOffAt39 === false).length
    let dropoffAt3y = threeYrDropCount / threeYrFalseCount + threeYrDropCount;

    let dropOffs: DropoffTable = {dropoffAtSignup, dropoffAt3m, dropoffAt1y, dropoffAt2y, dropoffAt3y}

    return dropOffs;
  }


  @patch('/customer-events')
  @response(200, {
    description: 'CustomerEvent PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CustomerEvent, {partial: true}),
        },
      },
    })
    customerEvent: CustomerEvent,
    @param.where(CustomerEvent) where?: Where<CustomerEvent>,
  ): Promise<Count> {
    return this.customerEventRepository.updateAll(customerEvent, where);
  }

  @get('/customer-events/{id}')
  @response(200, {
    description: 'CustomerEvent model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(CustomerEvent, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(CustomerEvent, {exclude: 'where'}) filter?: FilterExcludingWhere<CustomerEvent>
  ): Promise<CustomerEvent> {
    return this.customerEventRepository.findById(id, filter);
  }

  @patch('/customer-events/{id}')
  @response(204, {
    description: 'CustomerEvent PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(CustomerEvent, {partial: true}),
        },
      },
    })
    customerEvent: CustomerEvent,
  ): Promise<void> {
    await this.customerEventRepository.updateById(id, customerEvent);
  }

  @put('/customer-events/{id}')
  @response(204, {
    description: 'CustomerEvent PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() customerEvent: CustomerEvent,
  ): Promise<void> {
    await this.customerEventRepository.replaceById(id, customerEvent);
  }

  @del('/customer-events/{id}')
  @response(204, {
    description: 'CustomerEvent DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.customerEventRepository.deleteById(id);
  }
}
