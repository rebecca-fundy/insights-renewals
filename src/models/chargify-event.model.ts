import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class ChargifyEvent extends Entity {
  @property({
    type: 'string',
  })
  eventType?: string;

  @property({
    type: 'number',
    id: true,
    generated: false,
  })
  eventId: number;

  @property({
    type: 'string',
  })
  eventBody?: string;


  constructor(data?: Partial<ChargifyEvent>) {
    super(data);
  }
}

export interface ChargifyEventRelations {
  // describe navigational properties here
}

export type ChargifyEventWithRelations = ChargifyEvent & ChargifyEventRelations;
