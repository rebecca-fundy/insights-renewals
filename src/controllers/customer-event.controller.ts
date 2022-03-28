import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter, repository,
  Where
} from '@loopback/repository';
import {
  get,
  getModelSchemaRef, param, post, requestBody,
  response
} from '@loopback/rest';
import {CustomerEvent, EventDb, Subscription, SubscriptionRelations} from '../models';
import {CustomerEventRepository, CustomerEventSandboxRepository, CustomerRepository, CustomerSandboxRepository, DropoffRow, DropoffTable, EventDbRepository, EventDbSandboxRepository, RefreshRepository, SubscriptionRepository, SubscriptionSandboxRepository} from '../repositories';
import {EventController} from './event.controller';

let isLive: boolean = process.env.CHARGIFY_ENV == "live";

function addMonths(date: Date, months: number, i?: number): Date {
  let date2 = new Date(date) //Prevent overwrite of date parameter
  let d = date2.getDate();
  date2.setMonth(date2.getMonth() + +months); //gets month from parameter, adds months param, then calls setMonth
  //if the day of the month is not equal to the original after adding the month then reset the day of the month to the last day of the previous month.
  if (date2.getDate() != d) {
    date2.setDate(0);
  }
  return date2;
}

function setProductType(products: (Subscription & SubscriptionRelations)[]): string {
  const monthLeaseProductId = process.env.CHARGIFY_ENV == "live" ? 5874830 : 5601362;
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

type TimeKey = "peOffAtSignup" | "peOffAt3" | "peOffAt15" | "peOffAt27" | "peOffAt39"
type TimeKeyYearly = "peOffAt15" | "peOffAt27" | "peOffAt39"
type TimeKeyMonthly = "peOffAt1" | "peOffAt2" | "peOffAt3" | "peOffAt4" | "peOffAt5" | "peOffAt6" | 'peOffAt15' | 'peOffAt27' | 'peOffAt39'

const timepointStrs: string[] = ['signup', 'threeMonths', 'oneYear', 'twoYears', 'threeYears'];
const timepointStrsYearly: string[] = ['oneYear', 'twoYears', 'threeYears'];
const timepointStrsMonthly: string[] = ['oneMonth', 'twoMonths', 'threeMonths', 'fourMonths', 'fiveMonths', 'sixMonths', 'oneYear', 'twoYears', 'threeYears'];

const timepointKeys: TimeKey[] = ['peOffAtSignup', 'peOffAt3', 'peOffAt15', 'peOffAt27', 'peOffAt39']
const timepointKeysYearly: TimeKey[] = ['peOffAt15', 'peOffAt27', 'peOffAt39']
const timepointKeysMonthly: TimeKeyMonthly[] = ['peOffAt1', 'peOffAt2', 'peOffAt3', 'peOffAt4', 'peOffAt5', 'peOffAt6', 'peOffAt15', 'peOffAt27', 'peOffAt39']

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
    @repository(RefreshRepository)
    public refreshRepository: RefreshRepository,
    // @inject(EventController)
    @inject('controllers.EventController')
    public eventController: EventController,
    // @inject(RestBindings.Http.RESPONSE)
    // private response: Response
  ) {
  }

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
    console.log('customerEventCount: ' + customerEventCount)
    if (customerEventCount == 0) {
      //Setting of historical PE event data by customer
      let today = new Date();
      console.log('debug generateTable')
      //Grab array of customers and events; events ordered by ascending creation date.
      const subscriptionArray = await (isLive ? this.subscriptionRepository.find() : this.subscriptionSandboxRepository.find());
      const eventArray = await this.eventController.find({order: ["subscription_id ASC", "created_at ASC"]})
      // const eventArray = await (isLive ? this.eventController.find({order: ["subscription_id ASC", "created_at ASC"]}) : this.eventDbSandboxRepository.find({order: ["subscription_id ASC", "created_at ASC"]}));
      // const eventArray = await (isLive ? this.eventDbRepository.find({order: ["subscription_id ASC", "created_at ASC"]}) : this.eventDbSandboxRepository.find({order: ["subscription_id ASC", "created_at ASC"]}));

      await (isLive ? (this.customerRepository.find()) : (this.customerSandboxRepository.find()))
        .then(async customerArray => {
          for (let i = 0; i < customerArray.length; i++) {
            let customer = customerArray[i]; //For each customer in the customer array...
            let indicesToSplice: number[] = [];
            let customerEvents = eventArray.filter((event, index) => {if (event.customer_id == customer.id) {indicesToSplice.push(index); return event} }) //Filter the events array to events for this customer
            indicesToSplice.reverse().forEach(index => eventArray.splice(index, 1)) //remove processed events from events array so we don't have to process them again.
            let products = subscriptionArray.filter(subscription => subscription.customer_id === customer.id).sort() //List customer subscriptions oldest to newest
            let hasProduct = products.length //Filter condition for customers with no subscriptions
            const custCreationDate = !hasProduct ? new Date(customer.created_at) : new Date(products[0].created_at); //Set the customer creation date to the creation date of the first subscription. This will be the date that all the timepoints will be measured from. (If no subscriptions, it will be the customer creation date.)

            //Set product type for this customer.
            let productType = setProductType(products);

            //Determine whether this customer's most recent subscription is active, trialing or neither
            let numSubscriptions = products.length;
            let currentSubscription = products[numSubscriptions - 1]

            //For non-lease customers, "active" or "trialing" means most recent subscription is in an active/trialing state *and* PE is turned on.
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

            let timepointsNonLease: Date[] = [signup, threeMonths, oneYear, twoYears, threeYears];
            let timepointsMonthly: Date[] = [signup, oneMonth, twoMonths, threeMonths, fourMonths, fiveMonths, sixMonths, oneYear, twoYears, threeYears];

            function getTimepointKey(timePoint: string): TimeKey | TimeKeyMonthly {
              return productType == "month lease" ? timepointKeysMonthly[timepointStrsMonthly.indexOf(timePoint)] : timepointKeys[timepointStrs.indexOf(timePoint)]
            }


            function setTimepoint(event: EventDb, timePoint: string): void {

              let timePointKey: TimeKey | TimeKeyMonthly = getTimepointKey(timePoint)

              if (event.previous_allocation == 1 && event.new_allocation == 0 && !peAlreadyOff) {
                data[timePointKey] = true
                peStatus = "off";
                peAlreadyOff = true;
                data.isActive = false
                data.isTrialing = false
              } else if (event.previous_allocation == 0 && event.new_allocation == 1) {//Chargify generates this type of allocation event when a customer upgrades with PE on.
                data[timePointKey] = false;
                peStatus = "on"
                peAlreadyOff = false
                data.isActive = true
                data.isTrialing = false
              } else if (event.new_subscription_state == "canceled" && !peAlreadyOff) {
                data[timePointKey] = true
                peAlreadyOff = true
                data.isActive = false
                data.isTrialing = false
              } else if (event.new_subscription_state == "active" && (peStatus == "on" || (data.productType !== "non-lease"))) {
                data[timePointKey] = false
                peAlreadyOff = false
                data.isActive = true
                data.isTrialing = false
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
  ): Promise<DropoffTable[] | Date[]> {
    let customerEventTable = isLive ? 'CustomerEvent' : 'CustomerEventSandbox'
    console.log('hit refresh')
    await this.refreshRepository.create({refreshDate: new Date()});
    await this.customerEventRepository.execute(`TRUNCATE TABLE ${customerEventTable}`)
      .then(() => this.generateTable())
    return this.findDropOffs();
  }

  //Experimental
  @get('/customer-events/cust-event-table')
  @response(200, {
    description: 'CustomerEvent model count',
    // content: {'application/json': {schema: CountSchema}},
  })
  async custEventTable(
    @param.where(CustomerEvent) where?: Where<CustomerEvent>,
  ): Promise<CustomerEvent[]> {
    let customerEventTable = isLive ? 'CustomerEvent' : 'CustomerEventSandbox'

    // let result = await this.customerEventRepository.execute(`
    // select cust.id id, cust.created_at created_at, sub.id subscription_id, sub.peOn peOn, sub.product_id product_id, EventDb.created_at event_date, EventDb.key eventKey, EventDb.previous_allocation previous_allocation, EventDb.new_allocation new_allocation, EventDb.previous_subscription_state previous_subscription_state, EventDb.new_subscription_state new_subscription_state
    // from Customer cust
    // inner join Subscription sub
    // on cust.id = sub.customer_id
    // left join EventDb
    // on cust.id = EventDb.customer_id
    // order by subscription_id asc, event_date asc
    // `)
    let result = await this.customerRepository.find({include: ['subscriptions', 'eventDbs']})
    console.log(result)
    // .then(() => this.generateTable())
    return this.find({limit: 100});
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
    // const tableJoinQuery = "select Customer.id id, Customer.created_at created_at, Subscription.id subscription_id, Subscription.peOn peOn, EventDb.created_at event_date, EventDb.previous_allocation previous_allocation, EventDb.new_allocation new_allocation, EventDb.previous_subscription_state previous_subscription_state, EventDb.new_subscription_state new_subscription_state from Customer inner join Subscription on Customer.id = Subscription.customer_id inner join EventDb on EventDb.customer_id = Customer.id"
    // let result = await this.customerEventRepository.execute(tableJoinQuery);
    // console.log('result')
    // console.log(result);
    console.log('debug before generate table')
    await this.generateTable();
    console.log('debug after generate table')
    return isLive ? this.customerEventRepository.find(filter) : this.customerEventSandboxRepository.find(filter);
  }


  generateDropoffRow(rowType: string, productType: string, custEventArray: CustomerEvent[]): DropoffRow {
    const monthlyTimepointNames = ['dropoff 1m', 'dropoff 2m', 'dropoff 3m', 'dropoff 4m', 'dropoff 5m', 'dropoff 6m', 'dropoff 1y', 'dropoff 2y', 'dropoff 3y',]
    const yearlyTimepointNames = ['dropoff 1y', 'dropoff 2y', 'dropoff 3y']
    const peTimepointNames = ['No opt in', 'dropoff 3m', 'dropoff 1y', 'dropoff 2y', 'dropoff 3y']

    let name = "";
    let rowKey: TimeKey | TimeKeyMonthly | TimeKeyYearly;
    if (productType == "non lease") {console.log(rowType)}
    if (productType == "month lease") {
      name = monthlyTimepointNames[timepointStrsMonthly.indexOf(rowType)]
      rowKey = timepointKeysMonthly[timepointStrsMonthly.indexOf(rowType)];
    } else if (productType == "year lease") {
      name = yearlyTimepointNames[timepointStrsYearly.indexOf(rowType)]
      rowKey = timepointKeysYearly[timepointStrsYearly.indexOf(rowType)];
    } else {
      name = peTimepointNames[timepointStrs.indexOf(rowType)]
      rowKey = timepointKeys[timepointStrs.indexOf(rowType)];
    }
    let dropoffRow: DropoffRow = {
      name: name
    };
    let dropCount = (custEventArray.filter(cust => cust[rowKey])).length
    let falseCount = (custEventArray.filter(cust => cust[rowKey] === false)).length
    let userCount = Math.round((dropCount / (dropCount + falseCount)) * 100)
    dropoffRow.userCount = userCount
    dropoffRow.countOnly = false
    return dropoffRow
  }

  generateSubscriptionCountRow(state: string, custArray: CustomerEvent[]): DropoffRow {
    let rowOfCount: DropoffRow = {
      name: state,
      countOnly: true
    }
    switch (state) {
      case 'total': rowOfCount.userCount = custArray.length;
        rowOfCount.name = "Total Customers";
        break;
      case 'active': rowOfCount.userCount = custArray.filter(cust => cust.isActive).length;
        rowOfCount.name = "Active"
        break;
      case 'trialing': rowOfCount.userCount = custArray.filter(cust => cust.isTrialing).length;
        rowOfCount.name = "Trialing";
        break;
      default: rowOfCount.userCount = 0;
    }
    return rowOfCount
  }

  generateMonthlyDropoffTable(monthlyCust: CustomerEvent[]): DropoffTable {
    let monthlyDropoffs: DropoffTable = {
      title: "Month Lease",
    }
    const productType = "month lease"
    monthlyDropoffs.totalCusts = this.generateSubscriptionCountRow('total', monthlyCust)
    monthlyDropoffs.numActive = this.generateSubscriptionCountRow('active', monthlyCust)
    monthlyDropoffs.dropoff1m = this.generateDropoffRow('oneMonth', productType, monthlyCust)
    monthlyDropoffs.dropoff2m = this.generateDropoffRow('twoMonths', productType, monthlyCust)
    monthlyDropoffs.dropoff3m = this.generateDropoffRow('threeMonths', productType, monthlyCust)
    monthlyDropoffs.dropoff4m = this.generateDropoffRow('fourMonths', productType, monthlyCust)
    monthlyDropoffs.dropoff5m = this.generateDropoffRow('fiveMonths', productType, monthlyCust)
    monthlyDropoffs.dropoff6m = this.generateDropoffRow('sixMonths', productType, monthlyCust)
    monthlyDropoffs.dropoff1y = this.generateDropoffRow('oneYear', productType, monthlyCust)
    monthlyDropoffs.dropoff2y = this.generateDropoffRow('twoYears', productType, monthlyCust)
    monthlyDropoffs.dropoff3y = this.generateDropoffRow('threeYears', productType, monthlyCust)

    return monthlyDropoffs
  }

  generateYearlyDropoffTable(yearlyCust: CustomerEvent[]): DropoffTable {
    let yearlyDropoffs: DropoffTable = {
      title: "Year Lease"
    }
    const productType = "year lease"
    yearlyDropoffs.totalCusts = this.generateSubscriptionCountRow('total', yearlyCust)
    yearlyDropoffs.numActive = this.generateSubscriptionCountRow('active', yearlyCust)
    yearlyDropoffs.dropoff1y = this.generateDropoffRow('oneYear', productType, yearlyCust)
    yearlyDropoffs.dropoff2y = this.generateDropoffRow('twoYears', productType, yearlyCust)
    yearlyDropoffs.dropoff3y = this.generateDropoffRow('threeYears', productType, yearlyCust)

    return yearlyDropoffs
  }

  generateProDropoffTable(peCust: CustomerEvent[]): DropoffTable {
    let peDropoffs: DropoffTable = {
      title: "Pro Enhancements"
    }
    const productType = "non lease"
    peDropoffs.totalCusts = this.generateSubscriptionCountRow('total', peCust)
    peDropoffs.numActive = this.generateSubscriptionCountRow('active', peCust)
    peDropoffs.numTrialing = this.generateSubscriptionCountRow('trialing', peCust)
    peDropoffs.noOptIn = this.generateDropoffRow('signup', productType, peCust)
    peDropoffs.dropoff3m = this.generateDropoffRow('threeMonths', productType, peCust)
    peDropoffs.dropoff1y = this.generateDropoffRow('oneYear', productType, peCust)
    peDropoffs.dropoff2y = this.generateDropoffRow('twoYears', productType, peCust)
    peDropoffs.dropoff3y = this.generateDropoffRow('threeYears', productType, peCust)

    return peDropoffs
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
  ): Promise<DropoffTable[] | Date[]> {
    let dropoffArray: DropoffTable[] | Date[] = []
    const productTypes = ["non-lease", "year lease", "month lease"];

    for (let i = 0; i < productTypes.length; i++) {
      let productType: string = productTypes[i]
      let productFilter: Filter<CustomerEvent> = {
        "where": {"productType": `${productTypes[i]}`}
      }

      let totalCust = (await this.find(productFilter));
      console.log(productType, totalCust.length)
      if (productType == "non-lease") {
        dropoffArray[i] = this.generateProDropoffTable(totalCust)
      }

      if (productType == "year lease") {
        dropoffArray[i] = this.generateYearlyDropoffTable(totalCust)
      }

      if (productType == "month lease") {
        dropoffArray[i] = this.generateMonthlyDropoffTable(totalCust)
      }
    }
    let lastRefreshDate = new Date();
    try {
      lastRefreshDate = (await this.refreshRepository.find({"order": ["idRefresh DESC"], "limit": 1}))[0].refreshDate
    } catch (error) {
      console.log(error)
    } finally {
      dropoffArray[productTypes.length] = lastRefreshDate
    }
    return dropoffArray;
  }


  // @patch('/customer-events')
  // @response(200, {
  //   description: 'CustomerEvent PATCH success count',
  //   content: {'application/json': {schema: CountSchema}},
  // })
  // async updateAll(
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(CustomerEvent, {partial: true}),
  //       },
  //     },
  //   })
  //   customerEvent: CustomerEvent,
  //   @param.where(CustomerEvent) where?: Where<CustomerEvent>,
  // ): Promise<Count> {
  //   return this.customerEventRepository.updateAll(customerEvent, where);
  // }

  // @get('/customer-events/{id}')
  // @response(200, {
  //   description: 'CustomerEvent model instance',
  //   content: {
  //     'application/json': {
  //       schema: getModelSchemaRef(CustomerEvent, {includeRelations: true}),
  //     },
  //   },
  // })
  // async findById(
  //   @param.path.number('id') id: number,
  //   @param.filter(CustomerEvent, {exclude: 'where'}) filter?: FilterExcludingWhere<CustomerEvent>
  // ): Promise<CustomerEvent> {
  //   return this.customerEventRepository.findById(id, filter);
  // }

  // @patch('/customer-events/{id}')
  // @response(204, {
  //   description: 'CustomerEvent PATCH success',
  // })
  // async updateById(
  //   @param.path.number('id') id: number,
  //   @requestBody({
  //     content: {
  //       'application/json': {
  //         schema: getModelSchemaRef(CustomerEvent, {partial: true}),
  //       },
  //     },
  //   })
  //   customerEvent: CustomerEvent,
  // ): Promise<void> {
  //   await this.customerEventRepository.updateById(id, customerEvent);
  // }

  // @put('/customer-events/{id}')
  // @response(204, {
  //   description: 'CustomerEvent PUT success',
  // })
  // async replaceById(
  //   @param.path.number('id') id: number,
  //   @requestBody() customerEvent: CustomerEvent,
  // ): Promise<void> {
  //   await this.customerEventRepository.replaceById(id, customerEvent);
  // }

  // @del('/customer-events/{id}')
  // @response(204, {
  //   description: 'CustomerEvent DELETE success',
  // })
  // async deleteById(@param.path.number('id') id: number): Promise<void> {
  //   await this.customerEventRepository.deleteById(id);
  // }
}
