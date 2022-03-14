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
  getModelSchemaRef, param, patch, post, put, requestBody, response
} from '@loopback/rest';
import {ChargifyEvent, Customer, EventDb, Subscription} from '../models';
import {ChargifyEventRepository, CustomerRepository, CustomerSandboxRepository, EventDbRepository, EventDbSandboxRepository, RefreshRepository, SubscriptionRepository, SubscriptionSandboxRepository} from '../repositories';
import {Event} from '../services';
import {CustomerEventController} from './customer-event.controller';
import {EventController} from './event.controller';

let isLive = process.env.CHARGIFY_ENV == "live";
const leaseProductIds = [5874830, 5601362, 5135042, 5081978]
const peCost = 179;

export class WebhookController {
  constructor(
    @repository(ChargifyEventRepository)
    public chargifyEventRepository: ChargifyEventRepository,
    @repository(EventDbRepository)
    public eventDbRepository: EventDbRepository,
    @repository(EventDbSandboxRepository)
    public eventDbSandboxRepository: EventDbSandboxRepository,
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @repository(SubscriptionSandboxRepository)
    public subscriptionSandboxRepository: SubscriptionSandboxRepository,
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @repository(CustomerSandboxRepository)
    public customerSandboxRepository: CustomerSandboxRepository,
    @repository(RefreshRepository)
    public refreshRepository: RefreshRepository,
    @inject('services.Event')
    protected eventService: Event,
    @inject('controllers.EventController')
    public eventController: EventController,
    @inject('controllers.CustomerEventController')
    public customerEventController: CustomerEventController,
  ) { }

  isLeaseProduct(product_id: number): boolean {
    return leaseProductIds.includes(product_id);
  }

  async isRefreshTime(webhookDate: Date): Promise<boolean> {
    let isNextDay = false
    // let previousEventId = await this.eventController.findMaxId();
    let previousRefreshDate = (await this.refreshRepository.find({"order": ["idRefresh DESC"], "limit": 1}))[0].refreshDate
    // let previousEventDate = previousEvent.created_at
    console.log('previousRefreshDate: ', previousRefreshDate)
    var nextDayDate = new Date(previousRefreshDate.getFullYear(), previousRefreshDate.getMonth(), previousRefreshDate.getDate() + 1);
    console.log('nextDayDate ', nextDayDate);
    console.log('webhookDate: ', webhookDate)
    if (nextDayDate.getFullYear() == webhookDate.getFullYear() && nextDayDate.getMonth() == webhookDate.getMonth() && nextDayDate.getDate() == webhookDate.getDate()) {
      isNextDay = true; // date2 is one day after date1.
    }
    console.log('isNextDay ', isNextDay)
    return isNextDay
  }

  async logRenewalSuccess(renewalEvent: any): Promise<Partial<Subscription>> {
    let payload = renewalEvent.payload;
    let subdomain = payload["site"]["subdomain"].trim();
    let subscription = payload["subscription"]
    let subscription_id = parseInt(subscription["id"], 10);
    let est_renew_amt = parseInt(subscription["product"]["price_in_cents"], 10) / 100

    let renewalData: Partial<Subscription> = {
      est_renew_amt: est_renew_amt,
      next_assessment_at: subscription["next_assessment_at"],
    }
    try {
      subdomain == "fundy-suite"
        ? await this.subscriptionRepository.updateById(subscription_id, renewalData)
        : await this.subscriptionSandboxRepository.updateById(subscription_id, renewalData)
    } catch (error) {
      console.log(error)
    } finally {
      return renewalData
    }
  }

  async logPaymentUpdate(paymentUpdate: any): Promise<Partial<Subscription>> {
    let payload = paymentUpdate.payload;
    let subdomain = payload["site"]["subdomain"].trim();
    let subscription = payload["subscription"]
    let subscription_id = parseInt(subscription["id"], 10);
    let profile = payload["updated_payment_profile"];
    let cc_exp_month = profile["expiration_month"] == undefined ? 0 : parseInt(profile["expiration_month"], 10)
    let cc_exp_year = profile["expiration_year"] == undefined ? 0 : parseInt(profile["expiration_year"], 10)
    let paymentData: Partial<Subscription> = {
      cc_exp_month: cc_exp_month,
      cc_exp_year: cc_exp_year,
    }
    try {
      subdomain == "fundy-suite"
        ? await this.subscriptionRepository.updateById(subscription_id, paymentData)
        : await this.subscriptionSandboxRepository.updateById(subscription_id, paymentData)
    } catch (error) {
      console.log(error)
    } finally {
      return paymentData
    }
  }

  async logSubscriptionStateChange(subscriptionStateUpdateEvent: any): Promise<Partial<EventDb>> {
    //need to update subscription and eventDb.
    let payload = subscriptionStateUpdateEvent.payload;
    let id = subscriptionStateUpdateEvent.id;
    let event = subscriptionStateUpdateEvent.event.trim()
    let subdomain = payload["site"]["subdomain"].trim();
    let subscription = payload["subscription"]
    let subscription_id = parseInt(subscription["id"], 10);
    let customer_id = parseInt(subscription["customer"]["id"], 10)
    let eventId = parseInt(payload["event_id"], 10)
    let eventCreationDate = new Date(subscription["updated_at"].trim())
    let previous_subscription_state = subscription["previous_state"].trim()
    let new_subscription_state = subscription["state"].trim()
    let product_id = parseInt(subscription["product"]["id"], 10)
    let est_renew_amt = parseInt(subscription["product"]["price_in_cents"], 10) / 100

    if (!this.isLeaseProduct(product_id) && !(new_subscription_state == "canceled")) {
      est_renew_amt = peCost
    }

    let subscriptionStateChangeData: Partial<Subscription> = {
      state: new_subscription_state,
      est_renew_amt: est_renew_amt
    }

    try {
      subdomain == "fundy-suite"
        ? await this.subscriptionRepository.updateById(subscription_id, subscriptionStateChangeData)
        : await this.subscriptionSandboxRepository.updateById(subscription_id, subscriptionStateChangeData)
    } catch (error) {
      console.log(error)
    }

    let eventDbData: Partial<EventDb> = {
      id: eventId,
      subscription_id: subscription_id,
      customer_id: customer_id,
      key: event,
      created_at: eventCreationDate,
      previous_subscription_state: previous_subscription_state,
      new_subscription_state: new_subscription_state
    }

    try {
      subdomain == "fundy-suite"
        ? await this.eventDbRepository.create(eventDbData)
        : await this.eventDbSandboxRepository.create(eventDbData)
    } catch (error) {
      console.log(error.message)
    } finally {
      return eventDbData;
    }
  }

  async logAllocationChange(allocationChangeEvent: any): Promise<Partial<EventDb>> {
    console.log("allocation change")
    let payload = allocationChangeEvent.payload
    let subscription = payload["subscription"]
    let subscription_id = parseInt(subscription["id"], 10);
    let customer_id = 0;
    let event = allocationChangeEvent.event.trim()
    let eventId = parseInt(payload["event_id"], 10)
    let eventCreationDate = new Date(payload["timestamp"].trim())
    let previous_allocation = parseInt(payload["previous_allocation"], 10)
    let new_allocation = parseInt(payload["new_allocation"], 10)
    let allocation_id = parseInt(payload["allocation"]["id"], 10)
    let subdomain = payload["site"]["subdomain"].trim();
    let product_id = parseInt(payload["product"]["id"], 10)

    customer_id = isLive ?
      (await this.subscriptionRepository.customerId(subscription_id)).id
      : (await this.subscriptionSandboxRepository.customerSandboxId(subscription_id)).id

    let eventDbData: Partial<EventDb> = {
      id: eventId,
      subscription_id: subscription_id,
      customer_id: customer_id,
      key: event,
      created_at: eventCreationDate,
      previous_allocation: previous_allocation,
      new_allocation: new_allocation,
      allocation_id: allocation_id,
    }

    let togglePeData: Partial<Subscription> = {
      peOn: new_allocation == 0 ? false : true
    }

    if (!this.isLeaseProduct(product_id)) {
      togglePeData.est_renew_amt = new_allocation == 0 ? 0 : peCost
    }

    try {
      subdomain == "fundy-suite"
        ? await this.subscriptionRepository.updateById(subscription_id, togglePeData)
        : await this.subscriptionSandboxRepository.updateById(subscription_id, togglePeData)
    } catch (error) {
      console.log(error)
    }

    try {
      subdomain == "fundy-suite"
        ? await this.eventDbRepository.create(eventDbData)
        : await this.eventDbSandboxRepository.create(eventDbData)
    } catch (error) {
      console.log(error.message)
    } finally {
      return eventDbData;
    }
  }

  async logSignupSuccess(signupEvent: any): Promise<Partial<Subscription>> {
    let payload = signupEvent.payload;
    let subscription = payload["subscription"]
    let subscription_id = parseInt(subscription["id"], 10);
    let subdomain = payload["site"]["subdomain"].trim();
    let customer_id = parseInt(subscription["customer"]["id"], 10);
    let state = subscription["state"].trim()
    let product_id = parseInt(subscription["product"]["id"], 10)
    let eventCreationDate = new Date(subscription["updated_at"].trim())
    let next_assessment_at = new Date(subscription["next_assessment_at"].trim())
    let payment_type = subscription["payment_type"].trim()
    let cc_exp_year = payment_type == "paypal_account"
      ? 0
      : parseInt(subscription["credit_card"]["expiration_year"], 10)
    let cc_exp_month = payment_type == "paypal_account"
      ? 0
      : parseInt(subscription["credit_card"]["expiration_month"], 10)
    let est_renew_amt = parseInt(subscription["product_price_in_cents"], 10) / 100

    let newSubscriptionData: Partial<Subscription> = {
      id: subscription_id,
      created_at: eventCreationDate,
      product_id: product_id,
      customer_id: customer_id,
      state: state,
      peOn: true, //For lease products, this will be synonymous with an active subscription. Non-lease products will be set by the routine below.
      next_assessment_at: next_assessment_at,
      est_renew_amt: est_renew_amt,
      cc_exp_month: cc_exp_month,
      cc_exp_year: cc_exp_year
    }

    if (!leaseProductIds.includes(product_id)) {
      console.log(`${product_id} is not a lease product`);
      newSubscriptionData.peOn = await this.eventService.listComponents(subscription_id)
        .then(components => {
          let peComponent = components.filter(component => component.component.name.includes("Fundy Pro Enhancements")); console.log(`peComponent.length: ${peComponent.length}`);
          return peComponent
        })
        .then(pEcomponent => pEcomponent[0].component.enabled)
      est_renew_amt = newSubscriptionData.peOn ? peCost : 0
    }

    let customerData: Partial<Customer> = {
      id: customer_id,
      created_at: new Date(eventCreationDate)
    }

    try { //If the customer id already exists in the customer repo this will throw an error
      console.log('signup_success')
      subdomain == "fundy-suite"
        ? await this.customerRepository.create(customerData)
        : await this.customerSandboxRepository.create(customerData)
    } catch (error) {
      console.log(error.message)
    } try {
      subdomain == "fundy-suite"
        ? await this.subscriptionRepository.create(newSubscriptionData)
        : await this.subscriptionSandboxRepository.create(newSubscriptionData)
    } catch (error) {
      console.log(error)
    } finally { //Regardless, the subscription repo must get the new subscription info
      return newSubscriptionData
    }
  }

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
  ): Promise<Partial<EventDb> | Partial<Subscription>> {
    // let payload = chargifyEvent.payload;
    // let id = chargifyEvent.id;
    // let eventId = payload["event_id"]
    let webhookDate = new Date();
    let event = chargifyEvent.event.trim()
    // let subdomain = payload["site"]["subdomain"].trim();
    // console.log('event ', event)
    // console.log('subdomain ' + subdomain)
    // console.log(event == "signup_success")
    let result: Partial<EventDb> | Partial<Subscription> = {}

    if (event == "subscription_card_update") {
      console.log(event);
      result = await this.logPaymentUpdate(chargifyEvent)
    }

    if (event == "renewal_success" || event == "billing_date_change") {
      result = await this.logRenewalSuccess(chargifyEvent)
    }

    if (event == "subscription_state_change") {
      result = await this.logSubscriptionStateChange(chargifyEvent)
    }

    if (event == "component_allocation_change") {
      result = await this.logAllocationChange(chargifyEvent);
    }

    if (event == "signup_success") {
      result = await this.logSignupSuccess(chargifyEvent)
    }

    // let previousEventId = await this.eventController.findMaxId();
    // console.log('maxId ', previousEventId)

    if ((await this.isRefreshTime(webhookDate)) == true) {
      this.customerEventController.refresh()
    }
    return result
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
