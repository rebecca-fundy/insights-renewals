import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbFundyCentralDataSource} from '../datasources';
import {DirectTransaction, DirectTransactionRelations} from '../models';

export interface DirectResult {
  type: string,
  total: number
}

export class DirectTransactionRepository extends DefaultCrudRepository<
  DirectTransaction,
  typeof DirectTransaction.prototype.id,
  DirectTransactionRelations
> {
  constructor(
    @inject('datasources.db-fundy-central') dataSource: DbFundyCentralDataSource,
  ) {
    super(DirectTransaction, dataSource);
  }
  // async getDirectTransactions(since: Date, until: Date) {
  //   return this.execute(`CALL GetDirectRevenue(${since}, ${until})`)
  // }

}
