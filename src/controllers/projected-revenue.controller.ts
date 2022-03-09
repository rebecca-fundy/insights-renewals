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
import {Subscription} from '../models';
import {SubscriptionRepository} from '../repositories';

// class SubscriptionArray extends <Subscription>[] {
//   sum(key: any) : number {
//     return this.reduce((a,b) => a + (b[key] || 0),0)
//   }
// }

export class ProjectedRevenueController {
  constructor(
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
  ) { }

  @post('/projected-revenue')
  @response(200, {
    description: 'Subscription model instance',
    content: {'application/json': {schema: getModelSchemaRef(Subscription)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Subscription, {
            title: 'NewSubscription',
            exclude: ['id'],
          }),
        },
      },
    })
    subscription: Omit<Subscription, 'id'>,
  ): Promise<Subscription> {
    return this.subscriptionRepository.create(subscription);
  }

  @get('/projected-revenue/count')
  @response(200, {
    description: 'Subscription model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Subscription) where?: Where<Subscription>,
  ): Promise<Count> {
    return this.subscriptionRepository.count(where);
  }

  @get('/projected-revenue')
  @response(200, {
    description: 'Array of Subscription model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Subscription, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.query.date('since') since?: Date,
    @param.query.date('until') until?: Date,
    @param.filter(Subscription) filter?: Filter<Subscription>,
  ): Promise<Subscription[]> {
    let today = new Date();
    let firstDay = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
    let monthRenewAmt: number = 0
    let yearRenewAmt = 0
    let peRenewAmt = 0
    let subCount = (await (this.subscriptionRepository.count())).count

    if (!since) {
      since = firstDay;
    }
    console.log('since month: ' + since.getUTCMonth())
    if (!until) {
      until = new Date(since.getUTCFullYear(), since.getUTCMonth() + 1, 0);
      // if (until < since) {
      //   until = new Date(since.getFullYear(), since.getMonth() + 2, 0)
      // }
    }

    let sinceYear = since.getUTCFullYear();
    let sinceMonth = since.getUTCMonth() + 1;

    console.log('param.since: ', since)
    console.log('param.until: ', until)
    let monthLeaseSubs = await this.subscriptionRepository.find({
      where: {
        and: [
          {next_assessment_at: {between: [since, until]}},
          {state: "active"},
          {product_id: 5874830},
        ]
      }
    })
      .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth)));

    for (let sub of monthLeaseSubs) {
      if (sub.cc_exp_year == sinceYear) {
        console.log(sinceMonth, sinceYear);
        console.log(sub.id, sub.cc_exp_month, sub.cc_exp_year)
      }
      monthRenewAmt += sub.est_renew_amt
    }


    let yearLeaseSubs = await this.subscriptionRepository.find({
      where: {
        and: [
          {next_assessment_at: {between: [since, until]}},
          {state: "active"},
          {product_id: 5135042},
        ]
      }
    })
      .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth)));

    for (let sub of yearLeaseSubs) {
      yearRenewAmt += sub.est_renew_amt
    }

    let peSubs = await this.subscriptionRepository.find({
      where: {
        and: [
          {next_assessment_at: {between: [since, until]}},
          {or: [{state: "active"}, {state: "trialing"}]},
          {product_id: {nin: [5874830, 5135042]}},
          {peOn: true}
        ]
      }
    })
      .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth)));

    for (let sub of peSubs) {
      peRenewAmt += sub.est_renew_amt
    }
    console.log('total sub count: ' + subCount)
    console.log('monthLeaseSubs.length: ' + monthLeaseSubs.length)
    console.log('monthLeaseSubs.total: ' + monthRenewAmt)
    console.log('yearLeaseSubs.length: ' + yearLeaseSubs.length)
    console.log('yearLeaseSubs.total: ' + yearRenewAmt)
    console.log('peSubs.length: ' + peSubs.length)
    console.log('peSubs.total: ' + peRenewAmt)

    return monthLeaseSubs
  }

  @patch('/projected-revenue')
  @response(200, {
    description: 'Subscription PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Subscription, {partial: true}),
        },
      },
    })
    subscription: Subscription,
    @param.where(Subscription) where?: Where<Subscription>,
  ): Promise<Count> {
    return this.subscriptionRepository.updateAll(subscription, where);
  }

  @get('/projected-revenue/{id}')
  @response(200, {
    description: 'Subscription model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Subscription, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(Subscription, {exclude: 'where'}) filter?: FilterExcludingWhere<Subscription>
  ): Promise<Subscription> {
    return this.subscriptionRepository.findById(id, filter);
  }

  @patch('/projected-revenue/{id}')
  @response(204, {
    description: 'Subscription PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Subscription, {partial: true}),
        },
      },
    })
    subscription: Subscription,
  ): Promise<void> {
    await this.subscriptionRepository.updateById(id, subscription);
  }

  @put('/projected-revenue/{id}')
  @response(204, {
    description: 'Subscription PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() subscription: Subscription,
  ): Promise<void> {
    await this.subscriptionRepository.replaceById(id, subscription);
  }

  @del('/projected-revenue/{id}')
  @response(204, {
    description: 'Subscription DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.subscriptionRepository.deleteById(id);
  }
}
