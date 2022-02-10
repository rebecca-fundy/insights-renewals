import {Entity, model, property} from '@loopback/repository';

@model()
export class Refresh extends Entity {
  // [x: string]: any;
  @property({
    type: 'number',
    id: true,
    generated: true,
  })
  idRefresh?: number;

  @property({
    type: 'date',
    required: true,
  })
  refreshDate: Date;


  constructor(data?: Partial<Refresh>) {
    super(data);
  }
}

export interface RefreshRelations {
  // describe navigational properties here
}

export type RefreshWithRelations = Refresh & RefreshRelations;
