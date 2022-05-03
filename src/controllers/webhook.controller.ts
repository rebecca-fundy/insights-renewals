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
import mailchimp from '@mailchimp/mailchimp_marketing';
import {ChargifyEvent, Customer, EventDb, Subscription, Transaction} from '../models';
import {ChargifyEventRepository, CustomerRepository, CustomerSandboxRepository, EventDbRepository, EventDbSandboxRepository, RefreshRepository, SubscriptionRepository, SubscriptionSandboxRepository, TransactionRepository, TransactionSandboxRepository} from '../repositories';
import {Event, ProductTypeService, RenewalPreview} from '../services';
import {CustomerEventController} from './customer-event.controller';
import {EventController} from './event.controller';


let isLive = process.env.CHARGIFY_ENV == "live";
// const leaseProductIds = [5874830, 5601362, 5135042, 5081978]
const peCost = 179;
const reOptInCostInCents = 9900
const newReOptInCostInCents = 12900
const inactiveStates = ["canceled", "unpaid", "past_due"]
const unpaidStates = ["unpaid", "past_due"]
const mailchimpAudienceId = "c08320c799"
const mailchimpTagName = "Expired Cards"

mailchimp.setConfig({
  apiKey: process.env.FUNDYDESIGNER_MAILCHIMP_APIKEY,
  server: "us14"
})

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
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @repository(TransactionSandboxRepository)
    public transactionSandboxRepository: TransactionSandboxRepository,
    @inject('services.Event')
    protected eventService: Event,
    @inject('services.ProductTypeService')
    public productTypeService: ProductTypeService,
    @inject('controllers.EventController')
    public eventController: EventController,
    @inject('controllers.CustomerEventController')
    public customerEventController: CustomerEventController,
  ) { }

  // isLeaseProduct(product_id: number): boolean {
  //   return leaseProductIds.includes(product_id);
  // }

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
    let product_id = parseInt(subscription["product"]["id"], 10)
    let productType = this.productTypeService.getProductType(product_id);
    let isLeaseProduct = this.productTypeService.isLeaseProduct(productType)

    if (!isLeaseProduct) {
      try {
        let renewalPreview: RenewalPreview = await this.eventService.renewalPreview(subscription_id);
        est_renew_amt = renewalPreview.renewal_preview.total_amount_due_in_cents / 100
      } catch (error) {
        est_renew_amt = peCost
        console.log(error);
      }
    }

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

  async logPaymentSuccess(paymentEvent: any): Promise<Partial<Transaction>> {
    let payload = paymentEvent.payload;
    let subdomain = payload["site"]["subdomain"].trim();
    let subscription = payload["subscription"]
    let product_id = parseInt(subscription["product"]["id"], 10)
    let txn = payload["transaction"]
    let txn_id = parseInt(txn["id"], 10);
    let kind = txn["kind"] ? txn.kind : undefined
    let source = subdomain == "fundy"
      ? "authorize"
      : "chargify"
    let paymentData: Partial<Transaction> = {
      id: txn_id,
      type: "payment",
      created_at: txn["created_at"],
      memo: txn["memo"],
      amount_in_cents: txn["amount_in_cents"],
      product_id,
      kind,
      source
    }
    try {
      (subdomain == "fundy-suite" || subdomain == "fundy")
        ? await this.transactionRepository.create(paymentData)
        : await this.transactionSandboxRepository.create(paymentData)
    } catch (error) {
      console.log(error)
    } finally {
      return paymentData
    }
  }

  async logRefund(refundEvent: any): Promise<Partial<Transaction>> {
    let payload = refundEvent.payload;

    let subdomain = payload["site"]["subdomain"].trim();
    let subscription_id = payload["subscription_id"]
    let amount_in_cents = payload["payment_amount_in_cents"]

    let product_id: number = 0;
    //Proofer Chargify site has subdomain "fundy, so any hooks from there apply to old proofer.
    //refund_success webhook does not have a product payload so we must figure out the product by querying the subscription db
    if (subdomain == "fundy") {
      product_id = 27089 //One of the Old Proofer product_ids, because we don't store subscription information on Old Proofer
    } else if (subdomain == "fundy-suite") {
      product_id = (await this.subscriptionRepository.findById(subscription_id)).product_id
    } else {
      product_id = (await this.subscriptionSandboxRepository.findById(subscription_id)).product_id
    }

    let kind

    //refund_success webhook does not have a transaction payload, so this id is the webhook id, not the transaction id.
    let id = parseInt(refundEvent.id, 10);
    if (amount_in_cents == reOptInCostInCents || amount_in_cents == newReOptInCostInCents) {
      kind = "component_proration"
    }

    let source = subdomain == "fundy"
      ? "authorize"
      : "chargify"

    let refundData: Partial<Transaction> = {
      id,
      type: "refund",
      created_at: payload["timestamp"],
      memo: payload["memo"],
      amount_in_cents,
      product_id,
      kind,
      source
    }
    try {
      (subdomain == "fundy-suite" || subdomain == "fundy")
        ? await this.transactionRepository.create(refundData)
        : await this.transactionSandboxRepository.create(refundData)
    } catch (error) {
      console.log(error)
    } finally {
      return refundData
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
    let productType = this.productTypeService.getProductType(product_id)
    let est_renew_amt = parseInt(subscription["product"]["price_in_cents"], 10) / 100
    let cc_info = subscription["credit_card"]
    let card_type = cc_info["card_type"];
    let email = subscription["customer"]["email"].trim()
    let expiration_month = card_type == "paypal"
      ? 0
      : cc_info["expiration_month"]
    let expiration_year = card_type == "paypal"
      ? 0
      : cc_info["expiration_year"]

    let currentYear = eventCreationDate.getUTCFullYear()
    let currentMonth = eventCreationDate.getUTCMonth() + 1;
    console.log("currentMonth: " + currentMonth);
    console.log("expiration_month: " + expiration_month);
    console.log("currentYear: " + currentYear);
    console.log("expiration_year: " + expiration_year);

    console.log("unpaidStates.includes(new_subscription_state): " + unpaidStates.includes(new_subscription_state));
    console.log("expiration_year < currentYear: " + (expiration_year < currentYear));
    console.log("(expiration_year == currentYear && expiration_month < currentMonth)): " + (expiration_year == currentYear && expiration_month < currentMonth));
    console.log((expiration_year < currentYear) || (expiration_year == currentYear && expiration_month < currentMonth));



    //If customer is in "unpaid" or "past_due" state and the credit card is expired, add the "Expired Card" tag in MailChimp
    if (
      unpaidStates.includes(new_subscription_state)
      && ((expiration_year < currentYear) || (expiration_year == currentYear && expiration_month < currentMonth))
    ) {
      try {
        console.log(email);

        const response = await mailchimp.lists.updateListMemberTags(
          mailchimpAudienceId,
          email,
          {tags: [{name: mailchimpTagName, status: "active"}]}
        )
      } catch (error) {
        console.log(error)
      }
    }
    //If customer transitions from "unpaid" or "past_due" to "active" they must have updated their credit card and paid so remove the "Expired Card" tag.
    if (
      unpaidStates.includes(previous_subscription_state)
      && new_subscription_state == "active"
    ) {
      try {
        const response = await mailchimp.lists.updateListMemberTags(
          mailchimpAudienceId,
          email,
          {tags: [{name: mailchimpTagName, status: "inactive"}]}
        )
      } catch (error) {
        console.log(error)
      }
    }
    // const mailchimp_response = await mailchimp.ping.get();
    // console.log(mailchimp_response)
    let next_assessment_at = new Date(subscription["current_period_ends_at"].trim())
    let balance = parseInt(subscription["balance_in_cents"], 10) / 100
    console.log("balance " + balance);


    if (previous_subscription_state == "trialing" && new_subscription_state == "active") {
      try {
        let renewalPreview: RenewalPreview = await this.eventService.renewalPreview(subscription_id);
        est_renew_amt = renewalPreview.renewal_preview.total_amount_due_in_cents / 100
      } catch (error) {
        est_renew_amt = peCost
        console.log(error);
      }
    }

    let subscriptionStateChangeData: Partial<Subscription> = {
      state: new_subscription_state,
      est_renew_amt,
      next_assessment_at
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
    let productType = this.productTypeService.getProductType(product_id)

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

    // if (!this.productTypeService.isLeaseProduct(productType)) {
    //   togglePeData.est_renew_amt = new_allocation == 0 ? 0 : peCost
    // }

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
    let productType = this.productTypeService.getProductType(product_id)
    let eventCreationDate = new Date(subscription["updated_at"].trim())
    let next_assessment_at = new Date(subscription["next_assessment_at"].trim())
    let payment_type = subscription["payment_type"].trim()
    let cc_exp_year = payment_type == "paypal_account"
      ? 0
      : parseInt(subscription["credit_card"]["expiration_year"], 10)
    let cc_exp_month = payment_type == "paypal_account"
      ? 0
      : parseInt(subscription["credit_card"]["expiration_month"], 10)
    let est_renew_amt = this.productTypeService.isLeaseProduct(productType)
      ? parseInt(subscription["product_price_in_cents"], 10) / 100
      : peCost

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

    if (!this.productTypeService.isLeaseProduct(productType)) {
      console.log(`${product_id} is not a lease product`);
      try {
        newSubscriptionData.peOn = await this.eventService.listComponents(subscription_id)
          .then(components => {
            let peComponent = components.filter(component => component.component.name.includes("Fundy Pro Enhancements")); console.log(`peComponent.length: ${peComponent.length}`);
            return peComponent
          })
          .then(pEcomponent => pEcomponent[0].component.enabled)
      } catch (error) {
        console.log(error)
      }
    }

    let customerData: Partial<Customer> = {
      id: customer_id,
      created_at: new Date(eventCreationDate)
    }

    let eventData: Partial<EventDb> = {
      id: parseInt(payload["event_id"], 10),
      new_subscription_state: "active",
      subscription_id,
      customer_id,
      key: "subscription_state_change",
      created_at: eventCreationDate
    }

    try { //If the customer id already exists in the customer repo this will throw an error
      console.log('signup_success')
      subdomain == "fundy-suite"
        ? await this.customerRepository.create(customerData)
        : await this.customerSandboxRepository.create(customerData)
    } catch (error) {//If there's already a customer, we need to create an subscription state change event to toggle subscription state back to "active" for the dropoff calculation.
      console.log(error.message)
      subdomain == "fundy-suite"
        ? await this.eventDbRepository.create(eventData)
        : await this.eventDbSandboxRepository.create(eventCreationDate)
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

    let webhookDate = new Date();
    let event = chargifyEvent.event.trim()

    let result: Partial<EventDb> | Partial<Subscription> | Partial<Transaction> = {}

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

    if (event == "payment_success") {
      result = await this.logPaymentSuccess(chargifyEvent)
    }

    if (event == "refund_success") {
      result = await this.logRefund(chargifyEvent)
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
