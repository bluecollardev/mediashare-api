import { AutoMap } from '@automapper/classes';
import { AutoMapOptions } from '@automapper/classes';
import { Entity, ObjectIdColumn, Column } from 'typeorm';
import { ApiBaseEntity } from '@mediashare/core/entities/base.entity';
import { ObjectId } from 'mongodb';

@Entity('user_connection')
export class UserConnection extends ApiBaseEntity {
  // @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  // Explicitly set the name option: https://github.com/typeorm/typeorm/issues/4026
  @AutoMap()
  // @ObjectIdColumn({ name: 'userId', nullable: false })
  @Column({ name: 'userId', nullable: false })
  userId: string;

  // @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  // Explicitly set the name option: https://github.com/typeorm/typeorm/issues/4026
  @AutoMap()
  // @ObjectIdColumn({ name: 'connectionId', nullable: false })
  @Column({ name: 'connectionId', nullable: false })
  connectionId: string;
  // connectionId: ObjectId;
}
