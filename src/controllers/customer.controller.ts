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
import {writeFile} from 'fs';
import {Customer} from '../models';
import {CustomerRepository, EventDbRepository} from '../repositories';
import {Event} from '../services';


export class CustomerController {
  constructor(
    @repository(CustomerRepository)
    public customerRepository: CustomerRepository,
    @repository(EventDbRepository)
    protected eventDbRepository: EventDbRepository,
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
            exclude: ['id'],
          }),
        },
      },
    })
    customer: Omit<Customer, 'id'>,
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



    const eventArray = await this.eventService.getEvents();
    console.log(typeof eventArray);
    console.log(typeof eventArray[0]);
    console.log(Object.keys(eventArray[0]));



    for (let i = 0; i < eventArray.length; i++) {
      let eventItem = eventArray[i].event;
      console.log(eventItem.id);
      // let eventItem = JSON.parse(eventArray[i]);
      // let eventItem = eventArray[i];
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
    writeFile('output.json', JSON.stringify(eventArray), () => { });
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
