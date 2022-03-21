import {inject} from '@loopback/core';
import {
  Count,
  CountSchema,
  Filter, FilterExcludingWhere, repository,
  Where
} from '@loopback/repository';
import {
  del, get,
  getModelSchemaRef, param, patch, post, put, requestBody,
  response
} from '@loopback/rest';
import {Transaction} from '../models';
import {DirectTransactionRepository, RevenueReport, TransactionRepository} from '../repositories';
import {ProductTypeService} from '../services/product-type.service';

export class RevenueController {
  constructor(
    @repository(TransactionRepository)
    public transactionRepository: TransactionRepository,
    @repository(TransactionRepository)
    public directTransactionRepository: DirectTransactionRepository,
    @inject('services.ProductTypeService')
    public productService: ProductTypeService
  ) { }

  @post('/revenue')
  @response(200, {
    description: 'Transaction model instance',
    content: {'application/json': {schema: getModelSchemaRef(Transaction)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {
            title: 'NewTransaction',

          }),
        },
      },
    })
    Transaction: Transaction,
  ): Promise<Transaction> {
    return this.transactionRepository.create(Transaction);
  }

  @get('/revenue/count')
  @response(200, {
    description: 'Transaction model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Transaction) where?: Where<Transaction>,
  ): Promise<Count> {
    return this.transactionRepository.count(where);
  }

  @get('/revenue')
  @response(200, {
    description: 'Array of Transaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Transaction, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Transaction) filter?: Filter<Transaction>,
  ): Promise<Transaction[]> {
    return this.transactionRepository.find(filter);
  }

  @get('/direct-revenue')
  @response(200, {
    description: 'Array of Transaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Transaction, {includeRelations: true}),
        },
      },
    },
  })
  async getDirect(
    @param.query.date('since') since: Date,
    @param.query.date('until') until: Date,
    @param.filter(Transaction) filter?: Filter<Transaction>,
  ): Promise<any> {
    // ): Promise<Transaction[]> {
    console.log(since)
    let sinceDate = `${since.getUTCFullYear()}-${since.getUTCMonth() + 1}-${since.getUTCDate()}`
    let untilDate = `${until.getUTCFullYear()}-${until.getUTCMonth() + 1}-${until.getUTCDate()}`

    let query = `select ot.TransactionType, sum(Total) from FundyCentral.OrderTransaction ot
    join FundyCentral.Order o on ot.OrderId = o.id
    where ot.TransactionDate Between ? and ?
    and ot.Status = "APPROVED"
    and o.OrderType in ("ALBUM", "WALLART", "CARDS")
    Group By ot.TransactionType;`

    let params = [sinceDate, untilDate]
    let result = await this.directTransactionRepository.execute(query, params)
    console.log(result)
    return result;
  }

  @get('/revenue-report')
  @response(200, {
    description: 'Array of Transaction model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Transaction, {includeRelations: true}),
        },
      },
    },
  })
  async getRevenueReport(
    @param.query.date('since') since?: Date,
    @param.query.date('until') until?: Date,
    @param.filter(Transaction) filter?: Filter<Transaction>,
  ): Promise<RevenueReport> {
    let today = new Date();
    let firstDay = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
    console.log('since: ' + since);
    console.log('until: ' + until);

    if (!since) {
      since = firstDay;
    }
    if (!until) {
      until = new Date(since.getUTCFullYear(), since.getUTCMonth() + 1, 0);
    }


    let sameDay = (since.getFullYear() == until.getFullYear()) && (since.getMonth() == until.getMonth()) && (since.getDate() == until.getDate())

    console.log(sameDay)

    // if (sameDay) {
    since.setUTCHours(0)
    since.setUTCMinutes(0)
    since.setUTCSeconds(0)
    until.setUTCHours(23)
    until.setUTCMinutes(59)
    until.setUTCSeconds(59)
    // }

    console.log('since: ' + since);
    console.log('until: ' + until);

    let revenueReport: RevenueReport = {
      title: "Revenue Report",
      v10ProSuite: {
        name: "v10 Pro Suite",
        chargify: 0,
        total: 0
      },
      v10AlbumSuite: {
        name: "v10 Album Suite",
        chargify: 0,
        total: 0
      },
      v10ProSuiteCrossgrade: {
        name: "v10 Pro Suite Crossgrade",
        chargify: 0,
        total: 0
      },
      proEnhancements: {
        name: "Pro Enhancements",
        chargify: 0,
        total: 0
      },
      proEnhancementsReOptIn: {
        name: "Pro E. Re-Opt-In",
        chargify: 0,
        total: 0
      },
      upgrades: {
        name: "Upgrades",
        chargify: 0,
        total: 0
      },
      v10ProSuiteYearLeaseSignup: {
        name: "Year Lease Signup",
        chargify: 0,
        total: 0
      },
      v10ProSuiteYearLeaseRenew: {
        name: "Year Lease Renew",
        chargify: 0,
        total: 0
      },
      v10ProSuiteMonthLeaseSignup: {
        name: "Month Lease Signup",
        chargify: 0,
        total: 0
      },
      v10ProSuiteMonthLeaseRenew: {
        name: "Month Lease Renew",
        chargify: 0,
        total: 0
      },
      oldProofer: {
        name: "Old Proofer",
        authorize: 0,
        total: 0
      },
      directGross: {
        name: "Direct Gross",
        chargify: 0,
        authorize: 0,
        total: 0
      },
      directNet: {
        name: "Direct Net",
        chargify: 0,
        authorize: 0,
        total: 0
      },
      undetermined: {
        name: "Undetermined",
        chargify: 0,
        authorize: 0,
        total: 0
      },
      total: {
        name: "Total",
        chargify: 0,
        authorize: 0,
        total: 0
      },
    }
    let txnsInRange = await this.find(
      {
        where: {
          created_at: {between: [since, until]}
        }
      }
    );
    let counter = 0;
    for (let txn of txnsInRange) {
      counter++;
      let memo = txn.memo
      let kind = txn.kind
      let product_id = txn.product_id
      let isPayment = txn.type == "payment"
      let amount = isPayment
        ? txn.amount_in_cents / 100
        : -(txn.amount_in_cents) / 100
      let productType = this.productService.getProductType(product_id, memo, counter, kind, txn.amount_in_cents)
      // let productType = "reOptIn";

      revenueReport.total.total += amount
      if (txn.source == 'chargify') {
        revenueReport.total.chargify += amount
        switch (productType) {
          case "reOptIn": {
            revenueReport.proEnhancementsReOptIn.chargify += amount
            revenueReport.proEnhancementsReOptIn.total += amount
            break;
          }
          case "monthLeaseRenewal": {
            revenueReport.v10ProSuiteMonthLeaseRenew.chargify += amount
            revenueReport.v10ProSuiteMonthLeaseRenew.total += amount
            break;
          }
          case "yearLeaseRenewal": {
            revenueReport.v10ProSuiteYearLeaseRenew.chargify += amount
            revenueReport.v10ProSuiteYearLeaseRenew.total += amount
            break;
          }
          case "peRenewal": {
            revenueReport.proEnhancements.chargify += amount
            revenueReport.proEnhancements.total += amount
            break;
          }
          case "monthLease": {
            revenueReport.v10ProSuiteMonthLeaseSignup.chargify += amount
            revenueReport.v10ProSuiteMonthLeaseSignup.total += amount
            break;
          }
          case "yearLease": {
            revenueReport.v10ProSuiteYearLeaseSignup.chargify += amount
            revenueReport.v10ProSuiteYearLeaseSignup.total += amount
            break;
          }
          case "upgrade": {
            revenueReport.upgrades.chargify += amount
            revenueReport.upgrades.total += amount
            break;
          }
          case "v10Album": {
            revenueReport.v10AlbumSuite.chargify += amount
            revenueReport.v10AlbumSuite.total += amount
            break;
          }
          case "v10Cross": {
            revenueReport.v10ProSuiteCrossgrade.chargify += amount
            revenueReport.v10ProSuiteCrossgrade.total += amount
            break;
          }
          case "v10Pro": {
            revenueReport.v10ProSuite.chargify += amount
            revenueReport.v10ProSuite.total += amount
            break;
          }
          default: {
            if (revenueReport.undetermined.chargify) {
              revenueReport.undetermined.chargify += amount
            } else {
              revenueReport.undetermined.chargify = amount
            }
            revenueReport.undetermined.total += amount
          }
        }
      } else if (txn.source == "authorize") {
        revenueReport.oldProofer.authorize += amount
        revenueReport.oldProofer.total += amount
        revenueReport.total.authorize += amount
      } else (
        revenueReport.undetermined.total += amount
      )
    }
    return revenueReport
  }

  @patch('/revenue')
  @response(200, {
    description: 'Transaction PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {partial: true}),
        },
      },
    })
    Transaction: Transaction,
    @param.where(Transaction) where?: Where<Transaction>,
  ): Promise<Count> {
    return this.transactionRepository.updateAll(Transaction, where);
  }

  @get('/revenue/{id}')
  @response(200, {
    description: 'Transaction model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Transaction, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.number('id') id: number,
    @param.filter(Transaction, {exclude: 'where'}) filter?: FilterExcludingWhere<Transaction>
  ): Promise<Transaction> {
    return this.transactionRepository.findById(id, filter);
  }

  @patch('/revenue/{id}')
  @response(204, {
    description: 'Transaction PATCH success',
  })
  async updateById(
    @param.path.number('id') id: number,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Transaction, {partial: true}),
        },
      },
    })
    Transaction: Transaction,
  ): Promise<void> {
    await this.transactionRepository.updateById(id, Transaction);
  }

  @put('/revenue/{id}')
  @response(204, {
    description: 'Transaction PUT success',
  })
  async replaceById(
    @param.path.number('id') id: number,
    @requestBody() Transaction: Transaction,
  ): Promise<void> {
    await this.transactionRepository.replaceById(id, Transaction);
  }

  @del('/revenue/{id}')
  @response(204, {
    description: 'Transaction DELETE success',
  })
  async deleteById(@param.path.number('id') id: number): Promise<void> {
    await this.transactionRepository.deleteById(id);
  }
}
