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
import {CustomerEventRepository, DropoffTable} from '../repositories';

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
    // @param.filter(CustomerEvent) filter?: Filter<CustomerEvent>,
  ): Promise<DropoffTable> {
    let today = new Date();
    console.log('today date: ' + today);
    console.log('today + 3m: ' + addMonths(today, -39))
    console.log('today + 1y: ' + addMonths(today, -27));
    console.log('today + 2y: ' + addMonths(today, -15));
    console.log('today + 3y: ' + addMonths(today, -3));
    // let totalCust = (await this.count()).count
    let threeMthDropCount = (await this.count({peOffAt3: true})).count
    let threeMthFalseCount = (await this.count({peOffAt3: false})).count
    let totalAt3m = threeMthFalseCount + threeMthDropCount;
    let dropoffAt3m = threeMthDropCount / totalAt3m;

    let oneYrDropCount = (await this.count({peOffAt15: true})).count
    let oneYrFalseCount = (await this.count({peOffAt15: false})).count
    let totalAt1yr = oneYrFalseCount + oneYrDropCount;
    let dropoffAt1y = oneYrDropCount / totalAt1yr;

    let twoYrDropCount = (await this.count({peOffAt27: true})).count
    let twoYrFalseCount = (await this.count({peOffAt27: false})).count
    let totalAt2yr = twoYrFalseCount + twoYrDropCount;
    let dropoffAt2y = twoYrDropCount / totalAt2yr;

    let threeYrDropCount = (await this.count({peOffAt39: true})).count
    let threeYrFalseCount = (await this.count({peOffAt39: false})).count
    let totalAt3yr = threeYrFalseCount + threeYrDropCount;
    let dropoffAt3y = threeYrDropCount / totalAt3yr;

    let dropOffs: DropoffTable = {dropoffAt3m, dropoffAt1y, dropoffAt2y, dropoffAt3y}
    // let dropOffs: DropoffTable = {
    //   dropoffAt3m: 0,
    //   dropoffAt1y: 0,
    //   dropoffAt2y: 0,
    //   dropoffAt3y: 0
    // }
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
