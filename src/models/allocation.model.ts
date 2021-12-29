import {Entity, model, property} from '@loopback/repository';

@model()
export class Allocation extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: false,
    required: true,
  })
  allocation_id: number;

  @property({
    type: 'number',
  })
  subscription_id?: number;

  @property({
    type: 'number',
  })
  component_id?: number;

  @property({
    type: 'date',
  })
  timestamp?: Date;

  @property({
    type: 'number',
  })
  quantity?: number;

  @property({
    type: 'number',
  })
  previous_quantity?: number;


  constructor(data?: Partial<Allocation>) {
    super(data);
  }
}

export interface AllocationRelations {
  // describe navigational properties here
}

export type AllocationWithRelations = Allocation & AllocationRelations;
