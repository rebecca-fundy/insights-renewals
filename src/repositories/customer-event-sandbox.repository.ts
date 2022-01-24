import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {CustomerEventSandbox, CustomerEventSandboxRelations} from '../models';

export class CustomerEventSandboxRepository extends DefaultCrudRepository<
  CustomerEventSandbox,
  typeof CustomerEventSandbox.prototype.idCustomerEvent,
  CustomerEventSandboxRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(CustomerEventSandbox, dataSource);
    // console.log('cust-event-sandbox repo')
    // console.log('today: ' + new Date());
    // this.execute('TRUNCATE TABLE CustomerEventSandbox')
    //   .then(async result => console.log((await this.count()).count));
  }
}
