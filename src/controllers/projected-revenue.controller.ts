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

    // let subCount = (await (this.subscriptionRepository.count())).count

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

    //Adjust the 'until' parameter to the end of the day so that projections include all the expected revenue for that day.

    let adjustedUntilParam = new Date(until)
    adjustedUntilParam.setUTCHours(23, 59, 59, 999)

    // let monthGap = this.dateService.checkMonthGap(since, until);
    let weekGap = this.dateService.checkWeekGap(since, until);
    let weekGapTodayUntil = this.dateService.checkWeekGap(today, until)
    console.log('week gap since until', weekGap)
    console.log('week gap today until', weekGapTodayUntil)

    //For month leases, the next_assessment_at is aways within one month of the current date.
    //This means that:
    //(1) Any projections with a simple date filter for further in the future will return nothing for month leases.
    //(2) Projections spanning multiple months will not include repeated revenue.
    //The routine below adjusts for these conditions.

    let monthLeaseSubs: (Subscription & SubscriptionRelations)[] = []
    if (weekGapTodayUntil < 4.43) { //If the period we are projecting for ends less than a month from the current date, simply apply the date filter with the adjusted 'until' param.

      monthLeaseSubs = await this.subscriptionRepository.find({
        where: {
          and: [
            {next_assessment_at: {between: [since, adjustedUntilParam]}},
            {state: "active"},
            {product_id: 5874830},
          ]
        }
      })
        .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));
    } else if (weekGap < 4.43) { //If the end date of the projected period is more than a month out from the current date, but the projected period is still less than a month, then adjust the dates to get a projection for the current period that includes those dates. For example, a two-week projection several months from now will give the expected revenue for those same two weeks in the month extending from the current date.
      let sinceDay = since.getUTCDate()
      let currentDay = today.getUTCDate()
      let adjustedSince = new Date();
      let monthGap = this.dateService.checkMonthGap(since, until)
      adjustedSince.setUTCFullYear(today.getUTCFullYear())

      if (sinceDay >= currentDay) {
        console.log('debug1');
        adjustedSince.setUTCMonth(today.getUTCMonth())
      } else {
        console.log('debug2');
        adjustedSince.setUTCMonth(today.getUTCMonth() + 1)
        console.log(adjustedSince)
      }
      adjustedSince.setUTCDate(since.getUTCDate())
      adjustedSince.setUTCHours(0, 0, 0, 0)

      let adjustedUntil = new Date(
        adjustedSince.getUTCFullYear(),
        adjustedSince.getUTCMonth() + monthGap,
        until.getUTCDate()
      )
      adjustedUntil.setUTCHours(0, 0, 0, 0)

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
    } else { //If the date range we are projecting for is longer than a month (for example, projecting for next quarter), we just sum the total renewal amount for all the active monthly subscriptions (which would be a month's revenue), then scale it by the number of months.
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
      monthRenewAmt += sub.est_renew_amt
    }

    //4.43 is num of weeks in a 31-day month.
    //Any time gap between 4 weeks and 4.43 weeks is likely looking for a calendar month.
    //If we are looking at a period of time greater than a month, we want to scale up the projected amount the proportional number.
    //More accurate would be to add on the number of subscriptions that are due in that part of the month that is over the single month.
    if (weekGap > 4.43) {
      monthRenewAmt = monthRenewAmt * (weekGap / 4.3)
    }

    monthActiveAmt = monthRenewAmt



    let yearLeaseSubs = await this.subscriptionRepository.find({
      where: {
        and: [
          {next_assessment_at: {between: [since, adjustedUntilParam]}},
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
          {next_assessment_at: {between: [since, adjustedUntilParam]}},
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
