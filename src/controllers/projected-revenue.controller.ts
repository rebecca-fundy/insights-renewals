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
    let isCalendarMonth = this.dateService.isCalendarMonth(since, until)
    console.log(isCalendarMonth)
    console.log('week gap since until', weekGap)
    console.log('week gap today until', weekGapTodayUntil)
    console.log('param.since: ', since)
    console.log('param.until: ', adjustedUntilParam)
    //For month leases, the next_assessment_at is aways within one month of the current date.
    //This means that:
    //(1) Any projections with a simple date filter for further in the future will return nothing for month leases.
    //(2) Projections spanning multiple months will not include repeated revenue.
    //The routine below adjusts for these conditions.

    let monthLeaseSubs: (Subscription & SubscriptionRelations)[] = []
    if (isCalendarMonth || weekGap > 4.43) {//If the date range we are projecting for is a calender month or more we sum the renewal amounts for all active monthly subscriptions.
      monthLeaseSubs = await this.subscriptionRepository.find({
        where: {
          and: [
            {state: "active"},
            {product_id: 5874830},
          ]
        }
      })
        .then(result => result.filter(sub => sub.cc_exp_year == 0 || sub.cc_exp_year > sinceYear || (sub.cc_exp_year == sinceYear && sub.cc_exp_month > sinceMonth - 1)));

    } else if (weekGapTodayUntil < 4.43) { //If the period we are projecting for ends less than a month from the current date, simply apply the date filter with the adjusted 'until' param.
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

    } else if (weekGap < 4.43) { //If the end date of the projected period is more than a month out from the current date, but the projected period is less than a month, then adjust the dates to get a projection for the current period that includes those dates. For example, a two-week projection several months from now will give the expected revenue for those same two weeks in the month extending from the current date.
      let sinceDay = since.getUTCDate()
      let currentDay = today.getUTCDate()
      let untilDay = until.getUTCDate()
      let adjustedSince = new Date();
      let adjustedUntil = new Date();
      let interval2Since = new Date();
      let interval2Until = new Date();
      let monthGap = this.dateService.checkMonthGap(since, until)
      adjustedSince.setUTCFullYear(today.getUTCFullYear())

      if (sinceDay >= currentDay && untilDay >= currentDay && sinceDay <= untilDay) { //e.g. today is Apr 4 and we are projecting for May 15 - May 30
        console.log('debug1');
        adjustedSince.setUTCMonth(today.getUTCMonth()) //reset month to current month (if today is Apr 4, we want to reset to Apr 15 - Apr 30)
        adjustedSince.setUTCDate(since.getUTCDate())
        adjustedSince.setUTCHours(0, 0, 0, 0)
        adjustedUntil.setUTCFullYear(adjustedSince.getUTCFullYear())
        adjustedUntil.setUTCMonth(adjustedSince.getUTCMonth())
        adjustedUntil.setUTCDate(untilDay)
        adjustedUntil.setUTCHours(23, 59, 59, 999)
      } else if (sinceDay < currentDay && untilDay < currentDay && sinceDay <= untilDay) { //e.g. today is Apr 20 and we are projecting for June 1 - June 15
        console.log('debug2');
        adjustedSince.setUTCMonth(today.getUTCMonth() + 1) //reset month to month after current one (if today is Apr. 20, we want to reset for May 1 - May 15)
        adjustedSince.setUTCDate(since.getUTCDate())
        adjustedSince.setUTCHours(0, 0, 0, 0)
        adjustedUntil.setUTCFullYear(adjustedSince.getUTCFullYear())
        adjustedUntil.setUTCMonth(adjustedSince.getUTCMonth())
        adjustedUntil.setUTCDate(untilDay)
        adjustedUntil.setUTCHours(23, 59, 59, 999)
        console.log(adjustedSince)
      } else {//if current date is between since and until, we need two intervals: current month for valid future renewal dates, and the next month for dates already past in the the current month. For example: if current date is April 4, and projection is for 5/1 - 5/15, we will have valid renewal dates from 4/5 - 4/15 and 5/1 - 5/3.
        if (untilDay > sinceDay) {
          console.log('debug3')
          adjustedSince.setUTCFullYear(today.getUTCFullYear())
          adjustedSince.setUTCMonth(today.getUTCMonth() + 1)
          adjustedSince.setUTCDate(1)
          adjustedSince.setUTCHours(0, 0, 0, 0)
          adjustedUntil.setUTCMonth(adjustedSince.getUTCMonth())
          adjustedUntil.setUTCDate(today.getUTCDate() - 1)
          adjustedUntil.setUTCHours(23, 59, 59, 999)
          interval2Since.setUTCFullYear(today.getUTCFullYear());
          interval2Since.setUTCMonth(today.getUTCMonth())
          interval2Since.setUTCDate(today.getUTCDate())
          interval2Since.setUTCHours(0, 0, 0, 0)
          interval2Until.setUTCFullYear(interval2Since.getUTCFullYear())
          interval2Until.setUTCMonth(today.getUTCMonth())
          interval2Until.setUTCDate(until.getUTCDate())
          interval2Until.setUTCHours(23, 59, 59, 999)
        } else if (untilDay <= sinceDay) {
          console.log('debug4')
          adjustedSince.setUTCFullYear(today.getUTCFullYear())
          adjustedSince.setUTCMonth(today.getUTCMonth())
          adjustedSince.setUTCDate(sinceDay)
          adjustedSince.setUTCHours(0, 0, 0, 0)
          adjustedUntil.setUTCMonth(adjustedSince.getUTCMonth() + 1)
          adjustedUntil.setUTCDate(0)
          adjustedUntil.setUTCHours(23, 59, 59, 999)
          interval2Since.setUTCFullYear(today.getUTCFullYear());
          interval2Since.setUTCMonth(today.getUTCMonth() + 1)
          interval2Since.setUTCDate(1)
          interval2Since.setUTCHours(0, 0, 0, 0)
          interval2Until.setUTCFullYear(interval2Since.getUTCFullYear())
          interval2Until.setUTCMonth(today.getUTCMonth() + 1)
          interval2Until.setUTCDate(until.getUTCDate())
          interval2Until.setUTCHours(23, 59, 59, 999)
        }
      }
      console.log(`adjustedSince interval: ${adjustedSince}, ${adjustedUntil}`);
      console.log(`interval2: ${interval2Since}, ${interval2Until}`);

      monthLeaseSubs = await this.subscriptionRepository.find({
        where: {
          and: [
            {or: [{next_assessment_at: {between: [adjustedSince, adjustedUntil]}}, {next_assessment_at: {between: [interval2Since, interval2Until]}}]},
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
      monthRenewAmt = monthRenewAmt * (weekGap / 4.43)
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
