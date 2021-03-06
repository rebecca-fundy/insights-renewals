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
    protected eventService: Event
  ) { }

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
    let event = chargifyEvent.event
    let subdomain = payload["site"]["subdomain"]
    let subscription = payload["subscription"]
    let subscription_id = subscription["id"];
    let customer_id = 0;
    if (event == "component_allocation_change") {
      customer_id = isLive ?
        (await this.subscriptionRepository.customerId(subscription_id)).id
        : (await this.subscriptionSandboxRepository.customerSandboxId(subscription_id)).id
    } else {
      customer_id = subscription["customer"]["id"]
    }
    let product_id = subscription["product"]["id"]

    let eventDbData: Partial<EventDb> = {
      id: payload["event_id"],
      subscription_id: subscription["id"],
      customer_id: customer_id,
      key: chargifyEvent.event,
      created_at: payload["timestamp"] || subscription["updated_at"],
      previous_allocation: payload["previous_allocation"],
      new_allocation: payload["new_allocation"],
      allocation_id: chargifyEvent.event == "component_allocation_change" ? payload["allocation"]["id"] : null,
      previous_subscription_state: subscription["previous_state"],
      new_subscription_state: subscription["state"]
    }

    let newSubscriptionData: Partial<Subscription> = {
      id: subscription["id"],
      created_at: subscription["created_at"],
      product_id: product_id,
      customer_id: customer_id,
      state: subscription["state"],
      peOn: true //For lease products, this will be synonymous with an active subscription. Non-lease products will be set by the routine below.
    }

    //[month lease live, month lease sandbox, year lease live, year lease sandbox]
    const leaseProductIds = [5874830, 5601362, 5135042, 5081978]

    //If it's not a lease product, query the Chargify API to find out if is on for the new subscription.
    if (!leaseProductIds.includes(product_id) && event == "signup_success") {
      newSubscriptionData.peOn = await this.eventService.listComponents(subscription_id)
        .then(components => components.filter(component => component.component.name == "Fundy Pro Enhancements"))
        .then(pEcomponent => pEcomponent[0].component.enabled)
    }

    let subscriptionStateChangeData: Partial<Subscription> = {
      state: subscription["state"]
    }

    let togglePeData: Partial<Subscription> = {
      peOn: payload["new_allocation"]
    }

    let customerData: Partial<Customer> = {
      id: customer_id,
      created_at: event == "signup_success" ? new Date(subscription["customer"]["created_at"]) : undefined
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
          await this.customerRepository.create(customerData)
        } catch (error) {
          console.log(error.message)
        } finally { //Regardless, the subscription repo must get the new subscription info
          return this.subscriptionRepository.create(newSubscriptionData)
        }
      } else { //Allocation and subscription state changes go in the event table.
        return this.eventDbRepository.create(eventDbData)
      }
    } else {
      if (event == "signup_success") {
        try {
          await this.customerSandboxRepository.create(customerData)
        } catch (error) {
          console.log(error.message)
        } finally {
          return this.subscriptionSandboxRepository.create(newSubscriptionData)
        }
      } else {
        return this.eventDbSandboxRepository.create(eventDbData)
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
