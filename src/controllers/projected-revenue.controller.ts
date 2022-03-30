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
  getModelSchemaRef, param, patch, post, put, requestBody,
  response
} from '@loopback/rest';
import {Subscription, SubscriptionRelations} from '../models';
import {ProjectionReport, SubscriptionRepository} from '../repositories';
import {DateService} from '../services/date.service';

// class SubscriptionArray extends <Subscription>[] {
//   sum(key: any) : number {
//     return this.reduce((a,b) => a + (b[key] || 0),0)
//   }
// }

export class ProjectedRevenueController {
  constructor(
    @repository(SubscriptionRepository)
    public subscriptionRepository: SubscriptionRepository,
    @inject('services.DateService')
    public dateService: DateService
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
  ): Promise<ProjectionReport> {

    //General approach: Query the database for subscriptions with next_assessment_at
    //within the timeframe of the query. Filter on product type and "active" vs. "trialing",
    //then add up the estimated_renewal_amount

    let today = new Date();
    let firstDay = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
    let monthRenewAmt = 0
    let yearRenewAmt = 0
    let peRenewAmt = 0
    let peActiveAmt = 0
    let peTrialAmt = 0
    let monthActiveAmt = 0
    let monthTrialAmt = 0
    let yearActiveAmt = 0
    let yearTrialAmt = 0
    let totalTrialAmt = 0
    let totalActiveAmt = 0

    let subCount = (await (this.subscriptionRepository.count())).count

    if (!since) {
      since = firstDay;
    }

    if (!until) {
      until = new Date(since.getUTCFullYear(), since.getUTCMonth() + 1, 0);
    }

    let sinceYear = since.getUTCFullYear();
    let sinceMonth = since.getUTCMonth() + 1;

    console.log('param.since: ', since)
    console.log('param.until: ', until)

    let monthGap = this.dateService.checkMonthGap(since, until);
    let weekGap = this.dateService.checkWeekGap(since, until);
    let weekGapTodayUntil = this.dateService.checkWeekGap(today, until)
    console.log('week gap since until', weekGap)
    console.log('week gap today until', weekGapTodayUntil)
    //For month leases, the next_assessment_at is aways within one month of the current date.
    //This means that:
    //(1) Any queries for farther in the future will return nothing for month leases.
    //(2) Projections spanning multiple months will not include repeated revenue.
    //To address (2), for any time spans > 30 days (4.3 weeks), multiply the est. renewal amount for all active subscriptions by a factor to adjust.
    //To address (1), if start date is after current date and week gap > 4.3
    let monthLeaseSubs: (Subscription & SubscriptionRelations)[] = []
    if (weekGapTodayUntil < 4.3) {
      monthLeaseSubs = await this.subscriptionRepository.find({
        where: {
          and: [
            {next_assessment_at: {between: [since, until]}},
            {state: "active"},
            {product_id: 5874830},
          ]
        }
      })
        .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));
    } else if (weekGap < 4.3) {
      let sinceDay = since.getUTCDate()
      let currentDay = today.getUTCDate()
      let adjustedSince = new Date();
      // let adjustedUntil = new Date();
      let monthGap = this.dateService.checkMonthGap(since, until)
      adjustedSince.setUTCFullYear(today.getUTCFullYear())

      if (sinceDay >= currentDay) {
        console.log('debug1');

        adjustedSince.setUTCMonth(today.getUTCMonth())
      } else {
        console.log('debug2');
        adjustedSince.setUTCMonth(today.getUTCMonth() + 1)
      }
      adjustedSince.setUTCDate(since.getUTCDate())
      let adjustedUntil = new Date(
        adjustedSince.getUTCFullYear(),
        adjustedSince.getUTCMonth() + monthGap,
        until.getUTCDate()
      )
      // adjustedUntil = this.dateService.addUTCMonths(adjustedSince, monthGap)
      console.log('adjustedSince: ' + adjustedSince);
      console.log('adjustedUntil: ' + adjustedUntil);

      monthLeaseSubs = await this.subscriptionRepository.find({
        where: {
          and: [
            {next_assessment_at: {between: [adjustedSince, adjustedUntil]}},
            {state: "active"},
            {product_id: 5874830},
          ]
        }
      })
        .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));
    } else {
      console.log('debug3');

      monthLeaseSubs = await this.subscriptionRepository.find({
        where: {
          and: [
            {state: "active"},
            {product_id: 5874830},
          ]
        }
      })
        .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));
    }


    for (let sub of monthLeaseSubs) {
      // if (sub.cc_exp_year == sinceYear) {
      //   console.log(sinceMonth, sinceYear);
      //   console.log(sub.id, sub.cc_exp_month, sub.cc_exp_year)
      // }
      monthRenewAmt += sub.est_renew_amt
    }

    //4.43 is num of weeks in a 31-day month.
    //Any time gap between 4 and 4.43 is likely looking for a calendar month.
    //If we are looking at a period of time greater than a month, we want to scale up the projected amount the proportional number.
    //More accurate would be to add on the number of subscriptions that are due in that part of the month that is over the single month.
    if (weekGap > 4.43) {
      console.log('debug4');

      monthRenewAmt = monthRenewAmt * (weekGap / 4.3)
    }

    monthActiveAmt = monthRenewAmt



    let yearLeaseSubs = await this.subscriptionRepository.find({
      where: {
        and: [
          {next_assessment_at: {between: [since, until]}},
          {state: "active"},
          {product_id: 5135042},
        ]
      }
    })
      .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));

    for (let sub of yearLeaseSubs) {
      yearRenewAmt += sub.est_renew_amt
    }

    yearActiveAmt = yearRenewAmt

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
      .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));

    for (let sub of peSubs) {
      peRenewAmt += sub.est_renew_amt
      if (sub.state == "active") {
        peActiveAmt += sub.est_renew_amt
      }
      if (sub.state == "trialing") {
        peTrialAmt += sub.est_renew_amt
      }
    }
    console.log('total sub count: ' + subCount)
    console.log('monthLeaseSubs.length: ' + monthLeaseSubs.length)
    console.log('monthLeaseSubs.total: ' + monthRenewAmt)
    console.log('yearLeaseSubs.length: ' + yearLeaseSubs.length)
    console.log('yearLeaseSubs.total: ' + yearRenewAmt)
    console.log('peSubs.length: ' + peSubs.length)
    console.log('peSubs.total: ' + peRenewAmt)

    let totalRenewAmt = monthRenewAmt + yearRenewAmt + peRenewAmt;
    totalTrialAmt = peTrialAmt + monthTrialAmt + yearTrialAmt;
    totalActiveAmt = peActiveAmt + monthActiveAmt + yearActiveAmt

    let renewalRevenueProjection: ProjectionReport = {
      proEnhancementsProjection: {
        name: "Pro Enhancements",
        trialAmount: peTrialAmt,
        activeAmount: peActiveAmt,
        totalAmount: peRenewAmt
      },
      monthLeaseProjection: {
        name: "Pro Suite Month Lease",
        // trialAmount: monthTrialAmt,
        activeAmount: monthActiveAmt,
        totalAmount: monthRenewAmt,
      },
      yearLeaseProjection: {
        name: "Pro Suite Year Lease",
        // trialAmount: yearTrialAmt,
        activeAmount: yearActiveAmt,
        totalAmount: yearRenewAmt
      },
      totalProjection: {
        name: "Total",
        trialAmount: totalTrialAmt,
        activeAmount: totalActiveAmt,
        totalAmount: totalRenewAmt
      }
    }
    // return monthLeaseSubs
    return renewalRevenueProjection
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
