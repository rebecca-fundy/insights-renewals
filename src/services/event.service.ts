import {inject, Provider} from '@loopback/core';
import {getService} from '@loopback/service-proxy';
import {EventDataSource} from '../datasources';

export interface EventObject {
  event: {
    id: number,
    key: string,
    message?: string,
    subscription_id: number,
    customer_id: number,
    created_at: Date,
    event_specific_data:
    {
      previous_allocation?: number,
      new_allocation?: number,
      component_id?: number,
      component_handle?: string,
      memo?: string,
      allocation_id?: number,
      previous_subscription_state?: string,
      new_subscription_state?: string
    }

  }
}

export interface AllocationObject {
  allocation: {
    allocation_id: number,
    subscription_id: number,
    component_id: number,
    quantity: number,
    previous_quantity: number,
    timestamp: Date
  }
}

export interface ComponentInfo {
  component: {
    id: number,
    name: string,
    kind: string,
    unit_name: string,
    enabled: boolean,
    currency: string,
    allocated_quantity: number,
    pricing_scheme?: string,
    component_id: number,
    component_handle?: string,
    subscription_id: number,
    recurring: boolean,
    archived_at?: Date,
    price_point_id?: number,
    price_point_handle?: string,
    price_point_type?: string,
    price_point_name?: string,
    product_family_id: number,
    product_family_handle: string,
    created_at: Date,
    updated_at: Date
  }
}


export interface Event {
  // this is where you define the Node.js methods that will be
  // mapped to REST/SOAP/gRPC operations as stated in the datasource
  // json file.
  getEvents(page: number): Promise<EventObject[]>,
  getAllocations(subId: number, compId: number): Promise<AllocationObject[]>
  listComponents(subId: number): Promise<ComponentInfo[]>
}

export class EventProvider implements Provider<Event> {
  constructor(
    // event must match the name property in the datasource json file
    @inject('datasources.event')
    protected dataSource: EventDataSource = new EventDataSource(),
  ) { }

  value(): Promise<Event> {
    return getService(this.dataSource);
  }
}
