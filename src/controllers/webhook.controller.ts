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
import {ChargifyEventRepository, CustomerRepository, CustomerSandboxRepository, EventDbRepository, EventDbSandboxRepository, SubscriptionRepository, SubscriptionSandboxRepository} from '../repositories';
import {Event} from '../services';
import {CustomerEventController} from './customer-event.controller';
import {EventController} from './event.controller';

let isLive = process.env.CHARGIFY_ENV == "live";

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
    @inject('services.Event')
    protected eventService: Event,
    @inject('controllers.EventController')
    public eventController: EventController,
    @inject('controllers.CustomerEventController')
    public customerEventController: CustomerEventController,
  ) { }

  async isRefreshTime(webhookDate: Date): Promise<boolean> {
    let isNextDay = false
    let previousEventId = await this.eventController.findMaxId();
    let previousEvent = await this.eventController.findById(previousEventId);
    let previousEventDate = previousEvent.created_at
    var nextDayDate = new Date(previousEventDate.getFullYear(), previousEventDate.getMonth(), previousEventDate.getDate() + 1);
    if (nextDayDate.getFullYear() == webhookDate.getFullYear() && nextDayDate.getMonth() == webhookDate.getMonth() && nextDayDate.getDate() == webhookDate.getDate()) {
      isNextDay = true; // date2 is one day after date1.
    }
    return isNextDay
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
  ): Promise<EventDb | Subscription> {
    let payload = chargifyEvent.payload;
    let id = chargifyEvent.id;
    let event = chargifyEvent.event.trim()
    let subdomain = payload["site"]["subdomain"].trim();
    console.log('event ', event)
    console.log('subdomain ' + subdomain)
    console.log(event == "signup_success")
    let subscription = payload["subscription"]
    let subscription_id = parseInt(subscription["id"], 10);
    let customer_id = 0;
    let webhookDate = new Date(payload["timestamp"].trim()) || new Date(subscription["updated_at"].trim())
    let product_id = parseInt(subscription["product"]["id"], 10)
    let eventId = parseInt(payload["event_id"], 10)
    let eventCreationDate = event == "component_allocation_change" ? new Date(payload["timestamp"].trim()) : new Date(subscription["updated_at"].trim())
    let previous_allocation = event == "component_allocation_change" ? parseInt(payload["previous_allocation"], 10) : undefined
    let new_allocation = event == "component_allocation_change" ? parseInt(payload["new_allocation"], 10) : undefined
    let allocation_id = event == "component_allocation_change" ? parseInt(payload["allocation"]["id"], 10) : undefined
    let previous_subscription_state = event == "component_allocation_change" ? undefined : subscription["previous_state"].trim()
    let new_subscription_state = event == "component_allocation_change" ? undefined : subscription["state"].trim()

    if (event == "component_allocation_change") {
      customer_id = isLive ?
        (await this.subscriptionRepository.customerId(subscription_id)).id
        : (await this.subscriptionSandboxRepository.customerSandboxId(subscription_id)).id
    } else {
      customer_id = parseInt(subscription["customer"]["id"], 10)
    }

    let eventDbData: Partial<EventDb> = {
      id: eventId,
      subscription_id: subscription_id,
      customer_id: customer_id,
      key: event,
      created_at: eventCreationDate,
      previous_allocation: previous_allocation,
      new_allocation: new_allocation,
      allocation_id: allocation_id,
      previous_subscription_state: previous_subscription_state,
      new_subscription_state: new_subscription_state
    }

    console.log(eventDbData)

    let newSubscriptionData: Partial<Subscription> = {
      id: subscription_id,
      created_at: eventCreationDate,
      product_id: product_id,
      customer_id: customer_id,
      state: new_subscription_state,
      peOn: true //For lease products, this will be synonymous with an active subscription. Non-lease products will be set by the routine below.
    }

    //[month lease live, month lease sandbox, year lease live, year lease sandbox]
    const leaseProductIds = [5874830, 5601362, 5135042, 5081978]
    console.log('productId ' + product_id)
    //If it's not a lease product, query the Chargify API to find out if is on for the new subscription.
    if (!leaseProductIds.includes(product_id) && event == "signup_success") {
      console.log(`${product_id} is not a lease product`);
      newSubscriptionData.peOn = await this.eventService.listComponents(subscription_id)
        .then(components => {
          let peComponent = components.filter(component => component.component.name == "Fundy Pro Enhancements"); console.log(`peComponent.length: ${peComponent.length}`);
          return peComponent
        })
        .then(pEcomponent => pEcomponent[0].component.enabled)
    }

    let subscriptionStateChangeData: Partial<Subscription> = {
      state: new_subscription_state
    }

    let togglePeData: Partial<Subscription> = {
      peOn: new_allocation == 0 ? false : true
    }

    let customerData: Partial<Customer> = {
      id: customer_id,
      created_at: event == "signup_success" ? new Date(eventCreationDate) : undefined
    }

    //For subscription state changes, there will already be a subscription, so it will be updated.
    if (event == "subscription_state_change") {
      try {
        subdomain == "fundy-suite"
          ? await this.subscriptionRepository.updateById(subscription_id, subscriptionStateChangeData)
          : await this.subscriptionSandboxRepository.updateById(subscription_id, subscriptionStateChangeData)
      } catch (error) {
        console.log(error)
      }
    }
    //For allocation changes, the peOn field in the subscription repo needs to be updated.
    if (event == "component_allocation_change") {
      try {
        subdomain == "fundy-suite"
          ? await this.subscriptionRepository.updateById(subscription_id, togglePeData)
          : await this.subscriptionSandboxRepository.updateById(subscription_id, togglePeData)
      } catch (error) {
        console.log(error)
      }
    }

    if (subdomain == "fundy-suite") {
      if (event == "signup_success") { //A signup success may be a new customer, or an upgrade for an existing customer.
        try { //If the customer id already exists in the customer repo this will throw an error
          console.log('signup_success')
          await this.customerRepository.create(customerData)
        } catch (error) {
          console.log(error.message)
        } finally { //Regardless, the subscription repo must get the new subscription info
          return this.subscriptionRepository.create(newSubscriptionData)
            .then(async response => {
              if ((await this.isRefreshTime(webhookDate)) == true) {
                await this.customerEventController.refresh()
              }
              return response
            }
            )
        }
      } else { //Allocation and subscription state changes go in the event table.
        return this.eventDbRepository.create(eventDbData)
          .then(async response => {
            if ((await this.isRefreshTime(webhookDate)) == true) {
              await this.customerEventController.refresh()
            }
            return response
          }
          )
      }
    } else {
      if (event == "signup_success") {
        try {
          await this.customerSandboxRepository.create(customerData)
        } catch (error) {
          console.log(error.message)
        } finally {
          return this.subscriptionSandboxRepository.create(newSubscriptionData)
            .then(async response => {
              if ((await this.isRefreshTime(webhookDate)) == true) {
                await this.customerEventController.refresh()
              }
              return response
            }
            )
        }
      } else {
        return this.eventDbSandboxRepository.create(eventDbData)
          .then(async response => {
            if ((await this.isRefreshTime(webhookDate)) == true) {
              await this.customerEventController.refresh()
            }
            return response
          }
          )
      }
    }
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
