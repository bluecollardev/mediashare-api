import { AutoMap } from '@automapper/classes';
import { Entity, Column } from 'typeorm';
import { ApiBaseEntity } from '@mediashare/core/entities/base.entity';

@Entity('user_connection')
export class UserConnection extends ApiBaseEntity {
  // Both ends are Cognito subs (strings), not ObjectIds. Matches data shape.
  @AutoMap()
  @Column({ name: 'userId', nullable: false })
  userId: string;

  @AutoMap()
  @Column({ name: 'connectionId', nullable: false })
  connectionId: string;
}
