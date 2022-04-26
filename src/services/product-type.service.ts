import { /* inject, */ BindingScope, injectable} from '@loopback/core';
//Includes live and sandbox product IDs
const yearLeaseIds: number[] = [5135042, 5081978]
const monthLeaseIds: number[] = [5874830, 5601362]
const v10ProIds: number[] = [5135022, 5081977]
const v10CrossIds: number[] = [4452098, 5153304, 5152248]
const v10AlbumIds: number[] = [5135020, 5081976]
const upgradeIds: number[] = [3805476, 3805492, 4316817, 4433849, 4445987, 4445988, 4445989, 4445990, 4445991, 4445994, 4452106, 4452107, 4480069, 4480614, 4480616, 4480619, 4481015, 4683863, 5135017, 5135018, 5135019, 4466594, 5085553, 5084462, 5084205, 4631030, 4624053, 4624049, 4624044, 4624042, 4624031, 4466604, 4466603, 4466602, 4466601, 4466600, 4466599, 4466598, 4466597, 4466596, 4466595, 4466593, 4466606]
const oldProoferIds: number[] = [27089, 27093, 27094, 3296637, 3761050]
const saasProductTypes: string[] = ["monthLeaseRenewal", "yearLeaseRenewal", "peRenewal", "oldProofer"]
const leaseProducts: string[] = ["monthLease", "yearLease", "monthLeaseRenewal", "yearLeaseRenewal"]
const peOldCost = 17900;
const peNewCost = 19900;

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

  isOldProofer(product_id: number): boolean {
    return oldProoferIds.includes(product_id);
  }

  isLeaseProduct(productType: string): boolean {
    return leaseProducts.includes(productType)
  }

  getProductType(product_id: number, memo?: string, kind?: string, amount?: number): string {
    let productType = "undetermined"
    let isRenewal = memo?.toLowerCase().includes('renew')
    let isReOptIn = kind?.includes("component_proration")
    if (isReOptIn) {
      productType = "reOptIn"
    } else if (this.isMonthLease(product_id) && isRenewal) {
      productType = "monthLeaseRenewal"
    } else if (this.isYearLease(product_id) && isRenewal) {
      productType = "yearLeaseRenewal"
    } else if (isRenewal || amount == peOldCost || amount == peNewCost) {
      productType = "peRenewal"
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
    } else if (this.isOldProofer(product_id)) {
      productType = "oldProofer"
    }

    return productType
  }

  getRevenueType(productType: string) {
    if (saasProductTypes.includes(productType)) {
      return "saasRevenue"
    }
    return "newRevenue"
  }

}
