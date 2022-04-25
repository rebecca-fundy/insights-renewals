import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {DbDataSource} from '../datasources';
import {Transaction, TransactionRelations} from '../models';

export interface ProductField {
  name: string,
  chargify?: number,
  authorize?: number,
  total: number
}

export interface TotalField {
  name: string,
  chargify: number,
  authorize: number,
  total: number
}

export interface ChargifyField {
  name: string,
  chargify: number,
  total: number
}

export interface AuthorizeField {
  name: string,
  authorize: number,
  total: number
}

export interface RevenueReport {
  title: string,
  v10ProSuite: ChargifyField,
  v10AlbumSuite: ChargifyField,
  v10ProSuiteCrossgrade: ChargifyField,
  proEnhancements: ChargifyField,
  proEnhancementsReOptIn: ChargifyField,
  upgrades: ChargifyField,
  v10ProSuiteYearLeaseSignup: ChargifyField,
  v10ProSuiteYearLeaseRenew: ChargifyField,
  v10ProSuiteMonthLeaseSignup: ChargifyField,
  v10ProSuiteMonthLeaseRenew: ChargifyField,
  oldProofer: AuthorizeField,
  directGross: ProductField,
  directNet: ProductField,
  undetermined: ProductField,
  totalGross: TotalField,
  totalNet: TotalField,
  newRev: TotalField,
  saasRev: TotalField
}

export class TransactionRepository extends DefaultCrudRepository<
  Transaction,
  typeof Transaction.prototype.id,
  TransactionRelations
> {
  constructor(
    @inject('datasources.db') dataSource: DbDataSource,
  ) {
    super(Transaction, dataSource);
  }
}
