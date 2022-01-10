// import {Subscription} from '@loopback/core';
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
import {CustomerEvent, EventDb, Subscription, SubscriptionRelations} from '../models';
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

function setProductType(products: (Subscription & SubscriptionRelations)[]): string {
  const monthLeaseProductId = process.env.CHARGIFY_ENV == "live" ? 5874530 : 5601362;
  const yearLeaseProductId = process.env.CHARGIFY_ENV == "live" ? 5135042 : 5081978;
  let productType = ""
  if (products.length != 0 && products[products.length - 1].product_id == monthLeaseProductId) {
    productType = "month lease"
  } else if (products.length != 0 && products[products.length - 1].product_id == yearLeaseProductId) {
    productType = "year lease"
  } else if (products.length != 0) {
    productType = "non-lease"
  } else {
    productType = ""
  }
  return productType;
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
    let customerEventCount = (await this.customerEventRepository.count()).count;
    if (customerEventCount == 0) {
      //Setting of historical PE event data by customer
      let today = new Date();

      //Grab array of customers and events; events ordered by ascending creation date.

      let subscriptionArray = await this.subscriptionRepository.find();
      const eventArray = await this.eventDbRepository.find({order: ["subscription_id ASC", "created_at ASC"]});
      await this.customerRepository.find()
        .then(async customerArray => {
          for (let i = 0; i < customerArray.length; i++) {
            let customer = customerArray[i]; //For each customer in the customer array...
            let customerEvents = eventArray.filter(event => event.customer_id == customer.id) //Filter the events array to events for this customer
            let products = subscriptionArray.filter(subscription => subscription.customer_id === customer.id).sort() //Make sure they have at least one subscription
            const custCreationDate = products.length == 0 ? new Date(customer.created_at) : new Date(products[0].created_at); //Set the customer creation date to the creation date of the first subscription. This will be the date that all the timepoints will be measured from. (If no subscriptions, it will be the customer creation date.)
            //Initialize data object for creating a customer-event item for this customer
            //Set up the timepoints for this customer.
            let signupDate = new Date(custCreationDate);
            let signup = new Date(signupDate.setDate(signupDate.getDate() + 1));
            let signupPlus3wks = new Date(signupDate.setDate(signupDate.getDate() + 20)); //Already added one day for signup
            let threeMonths = addMonths(signupPlus3wks, 3)
            let oneYear = addMonths(signupPlus3wks, 15)
            let twoYears = addMonths(signupPlus3wks, 27)
            let threeYears = addMonths(signupPlus3wks, 39)
            //Set product type for this customer.
            if (customer.id == 33259723) {console.log(`product array: ${JSON.stringify(products)}`)}
            let productType = setProductType(products);
            if (customer.id == 33259723) {console.log(`product type: ${JSON.stringify(productType)}`)}

            let data: Partial<CustomerEvent> = {
              customer_id: customer.id,
              customer_created: customer.created_at,
              productType: productType,
            }

            //Initialize valid timepoints. If there are no events for a valid timepoint for a non-lease product, then PE allocation is the same as the "current" subscription allocation, so I initialize that to the peOn value for the subscription model. Lease products have PE defaulted to false. Otherwise, I assume PE defaults to "off" and rely on the events to set it.
            //If there are no events for a valid timepoint for a lease product, then it was never canceled, so that should be false.

            let allocationEventsForInit = products.length !== 0 ? customerEvents.filter(events => events.subscription_id == products[0].id && events.previous_allocation != null) : []; //Check for first subscription for allocation events
            let allocationEvents = allocationEventsForInit.length //If there are no allocation events, returns 0 / false

            //Initialize signup timepoint. Disregard customers with no products.
            if (data.peOffAtSignup === undefined && products.length != 0) {
              if (data.productType != "non-lease") { //Lease products are turn on at signup by definition, so they will never be off at signup
                data.peOffAtSignup = false
              } else if (!allocationEvents) { //No allocation events for this customer in their first subscription means signup allocation same as final allocation in first subscription
                data.peOffAtSignup = !products[0].peOn
              } else if (allocationEvents) { //If there are any allocation events in the first subscription, we can use the previous allocation of the first one to deduce the status at signup
                data.peOffAtSignup = allocationEventsForInit[0].previous_allocation == 0 ? true : false
              } else {
                data.peOffAtSignup = true
              }
            }
            //Initialize other valid (relative to time elapsed since first signup) timepoints
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
            let peAlreadyOff = data.peOffAtSignup;
            let peStatus = data.peOffAtSignup ? "off" : "on";

            type TimeKey = keyof CustomerEvent;

            function getTimepointKey(timePoint: string) {
              let timePointKey: TimeKey
              let time = timePoint
              switch (time) {
                case "signup": {
                  timePointKey = 'peOffAtSignup'
                  break;
                }
                case "threeMonths": {
                  timePointKey = 'peOffAt3'
                  break;
                }
                case "oneYear": {
                  timePointKey = 'peOffAt15'
                  break;
                }
                case "twoYears": {
                  timePointKey = 'peOffAt27'
                  break;
                }
                case "threeYears": {
                  timePointKey = 'peOffAt39'
                  break;
                }
                default: {
                  timePointKey = 'peOffAtSignup'
                  break;
                }
              }

              return timePointKey
            }


            function setTimepoint(event: EventDb, timePoint: string): void {

              let timePointKey: TimeKey = getTimepointKey(timePoint)

              if (event.previous_allocation == 1 && event.new_allocation == 0 && !peAlreadyOff) {
                data[timePointKey] = true
                peStatus = "off";
                peAlreadyOff = true;
              } else if (event.previous_allocation == 0 && event.new_allocation == 1) {//Chargify generates this type of allocation event when a customer upgrades with PE on.
                data[timePointKey] = false;
                peStatus = "on"
                peAlreadyOff = false
              } else if (event.new_subscription_state == "canceled" && !peAlreadyOff) {
                data[timePointKey] = true
                peAlreadyOff = true
              } else if (event.new_subscription_state == "active" && (peStatus == "on" || (data.productType !== "non-lease"))) {
                data[timePointKey] = false
                peAlreadyOff = false
              }
            }

            //Loop through event array and update the valid timepoints with the event data.

            customerEvents.forEach(event => {

              if (event.created_at <= signup) {
                setTimepoint(event, 'signup')
              }
              else if (event.created_at <= threeMonths) {
                setTimepoint(event, 'threeMonths')
              }
              else if (event.created_at <= oneYear) {
                setTimepoint(event, 'oneYear')
              }
              else if (event.created_at <= twoYears) {
                setTimepoint(event, 'twoYears')
              }
              else if (event.created_at <= threeYears) {
                setTimepoint(event, 'threeYears')
              }
            })
            await this.customerEventRepository.create(data)
          }
        })
    }
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
    let dropoffAt3y = threeYrDropCount / (threeYrFalseCount + threeYrDropCount);

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
