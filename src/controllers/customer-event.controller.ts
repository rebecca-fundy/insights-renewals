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
import {CustomerEventRepository, CustomerEventSandboxRepository, CustomerRepository, CustomerSandboxRepository, DropoffRow, DropoffTable, EventDbRepository, EventDbSandboxRepository, SubscriptionRepository, SubscriptionSandboxRepository} from '../repositories';

let isLive: boolean = process.env.CHARGIFY_ENV == "live";

function addMonths(date: Date, months: number, i?: number): Date {
  let date2 = new Date(date)
  let d = date2.getDate();

  date2.setMonth(date2.getMonth() + +months); //gets month from parameter, adds months param, then calls setMonth

  //if the day of the month is not equal to the original after adding the month then reset the day of the month to the last day of the previous month.
  if (date2.getDate() != d) {
    date2.setDate(0);
  }

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
    @repository(CustomerEventSandboxRepository)
    public customerEventSandboxRepository: CustomerEventSandboxRepository,
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @repository(CustomerSandboxRepository)
    public customerSandboxRepository: CustomerSandboxRepository,
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @repository(SubscriptionSandboxRepository)
    public subscriptionSandboxRepository: SubscriptionSandboxRepository,
    @repository(EventDbRepository)
    public eventDbRepository: EventDbRepository,
    @repository(EventDbSandboxRepository)
    public eventDbSandboxRepository: EventDbSandboxRepository,
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


  async generateTable(): Promise<void> {
    let customerEventCount = isLive ? (await this.customerEventRepository.count()).count : (await this.customerEventSandboxRepository.count()).count;

    if (customerEventCount == 0) {
      //Setting of historical PE event data by customer
      let today = new Date();
      //Grab array of customers and events; events ordered by ascending creation date.

      const subscriptionArray = await (isLive ? this.subscriptionRepository.find() : this.subscriptionSandboxRepository.find());
      const eventArray = await (isLive ? this.eventDbRepository.find({order: ["subscription_id ASC", "created_at ASC"]}) : this.eventDbSandboxRepository.find({order: ["subscription_id ASC", "created_at ASC"]}));

      await (isLive ? (this.customerRepository.find()) : (this.customerSandboxRepository.find()))
        .then(async customerArray => {
          for (let i = 0; i < customerArray.length; i++) {
            let customer = customerArray[i]; //For each customer in the customer array...
            let customerEvents = eventArray.filter(event => event.customer_id == customer.id) //Filter the events array to events for this customer
            let products = subscriptionArray.filter(subscription => subscription.customer_id === customer.id).sort() //List customer subscriptions oldest to newest
            let hasProduct = products.length
            const custCreationDate = products.length == 0 ? new Date(customer.created_at) : new Date(products[0].created_at); //Set the customer creation date to the creation date of the first subscription. This will be the date that all the timepoints will be measured from. (If no subscriptions, it will be the customer creation date.)

            //Set product type for this customer.
            let productType = setProductType(products);

            //Determine whether this customer's most recent subscription is active, trialing or neither
            let numSubscriptions = products.length;
            let currentSubscription = products[numSubscriptions - 1]

            //For non-lease customers, "active" or "trialing" means most recent subscription is in an active state *and* PE is turned on.
            let isActive = currentSubscription ? (currentSubscription.state == "active" && currentSubscription.peOn) : undefined;
            let isTrialing = currentSubscription ? (currentSubscription.state == "trialing" && currentSubscription.peOn) : undefined;

            //For lease customers, "active" means the current subscription is in an active state.
            //There is no trial period for lease customers.
            if (productType == "year lease" || productType == "month lease") {
              isActive = currentSubscription ? currentSubscription.state == "active" : undefined;
              isTrialing = undefined
            }

            //Set up the timepoints for this customer.
            let signupDate = new Date(custCreationDate);
            let signup = new Date(signupDate.setDate(signupDate.getDate() + 1));
            let signupPlus3wks = new Date(signupDate.setDate(signupDate.getDate() + 20)); //Already added one day for signup
            let oneMonth = addMonths(signupPlus3wks, 1)
            let twoMonths = addMonths(signupPlus3wks, 2)
            let threeMonths = addMonths(signupPlus3wks, 3)
            let fourMonths = addMonths(signupPlus3wks, 4)
            let fiveMonths = addMonths(signupPlus3wks, 5)
            let sixMonths = addMonths(signupPlus3wks, 6)
            let oneYear = addMonths(signupPlus3wks, 15)
            let twoYears = addMonths(signupPlus3wks, 27)
            let threeYears = addMonths(signupPlus3wks, 39)

            //Initialize data object for creating a customer-event item for this customer
            let data: Partial<CustomerEvent> = {
              customer_id: customer.id,
              customer_created: customer.created_at,
              productType: productType,
              isActive: isActive,
              isTrialing: isTrialing
            }

            type TimeKey = "peOffAtSignup" | "peOffAt3" | "peOffAt15" | "peOffAt27" | "peOffAt39"
            type TimeKeyMonthly = "peOffAtSignup" | "peOffAt1" | "peOffAt2" | "peOffAt3" | "peOffAt4" | "peOffAt5" | "peOffAt6" | "peOffAt15" | "peOffAt27" | "peOffAt39"

            let timepointsNonLease: Date[] = [signup, threeMonths, oneYear, twoYears, threeYears];

            let timepointsMonthly: Date[] = [signup, oneMonth, twoMonths, threeMonths, fourMonths, fiveMonths, sixMonths, oneYear, twoYears, threeYears];

            const timepointStrs: string[] = ['signup', 'threeMonths', 'oneYear', 'twoYears', 'threeYears'];
            const timepointStrsMonthly: string[] = ['signup', 'oneMonth', 'twoMonths', 'threeMonths', 'fourMonths', 'fiveMonths', 'sixMonths', 'oneYear', 'twoYears', 'threeYears'];

            const timepointKeys: TimeKey[] = ['peOffAtSignup', 'peOffAt3', 'peOffAt15', 'peOffAt27', 'peOffAt39']

            const timepointKeysMonthly: TimeKeyMonthly[] = ['peOffAtSignup', 'peOffAt1', 'peOffAt2', 'peOffAt3', 'peOffAt4', 'peOffAt5', 'peOffAt6', 'peOffAt15', 'peOffAt27', 'peOffAt39']

            function getTimepointKey(timePoint: string): TimeKey | TimeKeyMonthly {
              return productType == "month lease" ? timepointKeysMonthly[timepointStrsMonthly.indexOf(timePoint)] : timepointKeys[timepointStrs.indexOf(timePoint)]
            }


            function setTimepoint(event: EventDb, timePoint: string): void {

              let timePointKey: TimeKey | TimeKeyMonthly = getTimepointKey(timePoint)

              if (event.previous_allocation == 1 && event.new_allocation == 0 && !peAlreadyOff) {
                data[timePointKey] = true
                peStatus = "off";
                peAlreadyOff = true;
              } else if (event.previous_allocation == 0 && event.new_allocation == 1) {//Chargify generates this type of allocation event when a customer upgrades with PE on.
                data[timePointKey] = false;
                peStatus = "on"
                peAlreadyOff = false
              } else if (event.new_subscription_state == "canceled" && !peAlreadyOff) {
                if (productType == "month lease") {console.log(timePoint, timePointKey)}
                data[timePointKey] = true
                peAlreadyOff = true
              } else if (event.new_subscription_state == "active" && (peStatus == "on" || (data.productType !== "non-lease"))) {
                data[timePointKey] = false
                peAlreadyOff = false
              }
            }

            //Initialize valid timepoints. If there are no events for a valid timepoint for a non-lease product, then PE allocation is the same as the "current" subscription allocation, so I initialize that to the peOn value for the subscription model. Lease products have PE defaulted to false. Otherwise, I assume PE defaults to "off" and rely on the events to set it.
            //If there are no events for a valid timepoint for a lease product, then it was never canceled, so that should be false.

            let allocationEventsForInit = products.length !== 0 ? customerEvents.filter(events => events.subscription_id == products[0].id && events.previous_allocation != null) : []; //Check for first subscription for allocation events
            let allocationEvents = allocationEventsForInit.length //If there are no allocation events, returns 0 / false

            //Initialize signup timepoint. Disregard customers with no products.
            if (data.peOffAtSignup === undefined && products.length != 0) {
              if (data.productType != "non-lease") { //Lease products are turned on at signup by definition, so they will never be off at signup
                data.peOffAtSignup = false
                //For the year lease, initialize to an entire year on.
                if (data.productType == "year lease") {
                  data.peOffAt3 = false;
                  data.peOffAt15 = false;
                }
                //For the month lease, initialize to one month on.
                if (data.productType == "month lease") {
                  data.peOffAt1 = false;
                }
              } else if (!allocationEvents) { //No allocation events for this customer in their first subscription means signup allocation same as final allocation in first subscription
                data.peOffAtSignup = !products[0].peOn
              } else if (allocationEvents) { //If there are any allocation events in the first subscription, we can use the previous allocation of the first one to deduce the status at signup
                data.peOffAtSignup = allocationEventsForInit[0].previous_allocation == 0 ? true : false
              } else {
                data.peOffAtSignup = true //As a failsafe, initialize to no PE at signup because customers must opt in
              }
            }

            //Initialize other valid (relative to time elapsed since first signup) timepoints
            let timepoints = productType == "month lease" ? timepointsMonthly : timepointsNonLease
            for (let i = 1; i < timepoints.length; i++) { //Start at three months (index = 1 instead of 0) because we've already initialized signup timepoint.
              let timepointStr = productType == "month lease" ? timepointStrsMonthly[i] : timepointStrs[i];
              let timeKey = getTimepointKey(timepointStr);
              if (today > timepoints[i] && data[timeKey] === undefined) {
                data[timeKey] = false
              }
            }


            let peAlreadyOff = data.peOffAtSignup;
            let peStatus = data.peOffAtSignup ? "off" : "on";


            //Loop through event array and update the valid timepoints with the event data.
            customerEvents.forEach(event => {

              if (event.created_at <= signup && productType == "non-lease") {
                setTimepoint(event, 'signup')
              }
              else if (event.created_at <= oneMonth && productType == "month lease") {
                setTimepoint(event, 'oneMonth');
                console.log(event.id, data)
              }
              else if (event.created_at <= twoMonths && productType == "month lease") {
                setTimepoint(event, 'twoMonths')
              }
              else if (event.created_at <= threeMonths && (productType == "non-lease" || productType == "month lease")) {
                setTimepoint(event, 'threeMonths')
              }
              else if (event.created_at <= fourMonths && productType == "month lease") {
                setTimepoint(event, 'fourMonths')
              }
              else if (event.created_at <= fiveMonths && productType == "month lease") {
                setTimepoint(event, 'fiveMonths')
              }
              else if (event.created_at <= sixMonths && productType == "month lease") {
                setTimepoint(event, 'sixMonths')
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
            if (hasProduct) {
              if (isLive) {
                await this.customerEventRepository.create(data)
              } else {
                await this.customerEventSandboxRepository.create(data)
              }
            }
          }
        })
    }
  }
  //Truncate cust-event table and recalculate
  @get('/customer-events/refresh')
  @response(200, {
    description: 'CustomerEvent model count',
    // content: {'application/json': {schema: CountSchema}},
  })
  async refresh(
    @param.where(CustomerEvent) where?: Where<CustomerEvent>,
  ): Promise<DropoffTable[]> {
    let customerEventTable = isLive ? 'CustomerEvent' : 'CustomerEventSandbox'
    console.log('hit dropoff')
    await this.customerEventRepository.execute(`TRUNCATE TABLE ${customerEventTable}`)
      .then(() => this.generateTable())
    return this.findDropOffs();
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
    console.log('chargify env live: ' + isLive)
    await this.generateTable();
    return isLive ? this.customerEventRepository.find(filter) : this.customerEventSandboxRepository.find(filter);
  }

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
  ): Promise<DropoffTable[]> {
    let dropoffArray: DropoffTable[] = []
    //filter on product type = "non-lease", "month lease" or "year lease"
    //Pro Enhancement filters do not apply to lease products.
    //Need to make it more generic.
    const productTypes = ["non-lease", "year lease", "month lease"];
    const tableTitles = ["Pro Enhancements", "Year Lease", "Month Lease"]
    for (let i = 0; i < productTypes.length; i++) {
      let productType: string = productTypes[i]
      let productFilter: Filter<CustomerEvent> = {"where": {"productType": `${productTypes[i]}`}}

      let totalCust = (await this.find(productFilter));
      let totalCustomers = totalCust.length;
      console.log(productTypes[i], totalCustomers)

      let totalActive = totalCust.filter(cust => cust.isActive).length
      let totalTrialing = totalCust.filter(cust => cust.isTrialing).length

      let dropoffAtSignup = undefined;
      let dropoffAt3m = undefined;

      if (productType == "non-lease") {

        let signupDropCount = totalCust.filter(cust => cust.peOffAtSignup).length
        let signupFalseCount = totalCust.filter(cust => cust.peOffAtSignup === false).length
        dropoffAtSignup = Math.round((signupDropCount / (signupFalseCount + signupDropCount)) * 100)

        let threeMthDropCount = totalCust.filter(cust => cust.peOffAt3).length
        let threeMthFalseCount = totalCust.filter(cust => cust.peOffAt3 === false).length
        dropoffAt3m = Math.round((threeMthDropCount / (threeMthFalseCount + threeMthDropCount)) * 100);
      }

      let oneYrDropCount = totalCust.filter(cust => cust.peOffAt15).length
      let oneYrFalseCount = totalCust.filter(cust => cust.peOffAt15 === false).length
      let dropoffAt1y = Math.round((oneYrDropCount / (oneYrFalseCount + oneYrDropCount)) * 100);

      let twoYrDropCount = totalCust.filter(cust => cust.peOffAt27).length
      let twoYrFalseCount = totalCust.filter(cust => cust.peOffAt27 === false).length
      let dropoffAt2y = Math.round((twoYrDropCount / (twoYrFalseCount + twoYrDropCount)) * 100);

      let threeYrDropCount = totalCust.filter(cust => cust.peOffAt39).length
      let threeYrFalseCount = totalCust.filter(cust => cust.peOffAt39 === false).length
      let dropoffAt3y = Math.round((threeYrDropCount / (threeYrFalseCount + threeYrDropCount)) * 100);

      let totalCusts: DropoffRow = {
        name: "Total customers",
        userCount: totalCustomers,
        countOnly: true
      }

      let numActive: DropoffRow = {
        name: "Active",
        userCount: totalActive,
        countOnly: true
      }

      let numTrialing: DropoffRow = {
        name: "Trialing",
        userCount: totalTrialing,
        countOnly: true
      }

      let noOptIn: DropoffRow = {
        name: "No opt in",
        userCount: dropoffAtSignup,
        countOnly: false
      }

      let dropoff3m: DropoffRow = {
        name: "dropoff 3m",
        userCount: dropoffAt3m,
        countOnly: false,
      }

      let dropoff1y: DropoffRow = {
        name: "dropoff 1y",
        userCount: dropoffAt1y,
        countOnly: false
      }

      let dropoff2y: DropoffRow = {
        name: "dropoff 2y",
        userCount: dropoffAt2y,
        countOnly: false
      }

      let dropoff3y: DropoffRow = {
        name: "dropoff 3y",
        userCount: dropoffAt3y,
        countOnly: false
      }

      dropoffArray[i] = {
        title: tableTitles[i],
        totalCusts,
        numActive,
        // numTrialing,
        // noOptIn,
        // dropoff3m,
        dropoff1y,
        dropoff2y,
        dropoff3y,
      }

      if (productType == "non-lease") {
        dropoffArray[i].numTrialing = numTrialing;
        dropoffArray[i].noOptIn = noOptIn;
        dropoffArray[i].dropoff3m = dropoff3m;
      }


    }
    return dropoffArray;
    // return dropoffArray[0];
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
