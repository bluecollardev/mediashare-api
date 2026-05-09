import { AutoMap } from '@automapper/classes';
import { AutoMapOptions } from '@automapper/classes';
import {
  ObjectIdColumn,
  Entity,
  CreateDateColumn,
  UpdateDateColumn,
  ColumnOptions,
  Column,
} from 'typeorm';
import { ObjectId } from 'mongodb';

export interface IApiBaseEntity {
  _id: ObjectId;
}

export abstract class DataProviderBaseEntity<M> implements IApiBaseEntity {
  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @ObjectIdColumn()
  _id: ObjectId;

  // TODO: Do we need to update this?
  //  The constructor part needs to be looked at!
  //  Remove if unnecessary...
  protected constructor(model?: Partial<M>) {
    Object.assign(this, model);
  }
}

@Entity()
export class ApiBaseEntity implements IApiBaseEntity {
  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @ObjectIdColumn()
  _id: ObjectId;

  @AutoMap()
  @Column({ name: 'createdBy', nullable: false, unique: false })
  createdBy: string;

  @AutoMap()
  @CreateDateColumn()
  readonly createdAt: Date;

  @AutoMap()
  @UpdateDateColumn(<ColumnOptions>{ required: false })
  readonly updatedDate: Date;
}
