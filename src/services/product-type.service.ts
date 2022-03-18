import { /* inject, */ BindingScope, injectable} from '@loopback/core';

const yearLeaseIds: number[] = [5135042]
const monthLeaseIds: number[] = [5874830]
const v10ProIds: number[] = [5135022]
const v10CrossIds: number[] = [4452098, 5153304]
const v10AlbumIds: number[] = [5135020]
const upgradeIds: number[] = [3805476, 3805492, 4316817, 4433849, 4445987, 4445988, 4445989, 4445990, 4445991, 4445994, 4452106, 4452107, 4480069, 4480614, 4480616, 4480619, 4481015, 4683863, 5135017, 5135018, 5135019]

@injectable({scope: BindingScope.TRANSIENT})
export class ProductTypeService {
  constructor(/* Add @inject to inject parameters */) { }

  /*
   * Add service methods here
   */


  isYearLease(product_id: number): boolean {
    return yearLeaseIds.includes(product_id);
  }

  isMonthLease(product_id: number): boolean {
    return monthLeaseIds.includes(product_id);
  }

  isUpgrade(product_id: number): boolean {
    return upgradeIds.includes(product_id);
  }

  isv10Pro(product_id: number): boolean {
    return v10ProIds.includes(product_id);
  }

  isv10Cross(product_id: number): boolean {
    return v10CrossIds.includes(product_id);
  }

  isv10Album(product_id: number): boolean {
    return v10AlbumIds.includes(product_id);
  }

  getProductType(product_id: number, memo: string, counter: number, kind?: string, amount?: number): string {
    let productType = "undetermined"
    let isRenewal = memo.toLowerCase().includes('renew')
    let isReOptIn = kind?.includes("component_proration")
    if (counter == 1) {
      console.log(product_id, memo, kind, amount, isRenewal)
    }
    if (isReOptIn) {
      productType = "reOptIn"
    } else if (this.isMonthLease(product_id) && isRenewal) {
      productType = "monthLeaseRenewal"
    } else if (this.isYearLease(product_id) && isRenewal) {
      productType = "yearLeaseRenewal"
    } else if (isRenewal || amount == 17900) {
      productType = "peRenewal"
      if (counter == 1) {console.log(productType)}
    } else if (this.isMonthLease(product_id)) {
      productType = "monthLease"
    } else if (this.isYearLease(product_id)) {
      productType = "yearLease"
    } else if (this.isUpgrade(product_id)) {
      productType = "upgrade"
    } else if (this.isv10Album(product_id)) {
      productType = "v10Album"
    } else if (this.isv10Cross(product_id)) {
      productType = "v10Cross"
    } else if (this.isv10Pro(product_id)) {
      productType = "v10Pro"
    }
    if (counter == 1) {console.log(productType)}

    return productType
  }

}
