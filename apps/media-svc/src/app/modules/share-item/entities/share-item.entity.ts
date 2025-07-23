import { AutoMap } from '@automapper/classes';
import { AutoMapOptions } from '@automapper/classes';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { ApiBaseEntity } from '@mediashare/core/entities/base.entity';

@Entity('share_item')
export class ShareItem extends ApiBaseEntity {
  @AutoMap()
  @Column({ nullable: false, type: 'text' })
  @Index('userSub', { unique: false })
  userSub: string;

  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @ObjectIdColumn({ name: 'playlistId', nullable: true, unique: false })
  @Index('playlistId', { unique: false })
  playlistId: ObjectId;

  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @ObjectIdColumn({ name: 'mediaId', nullable: true, unique: false })
  @Index('mediaId', { unique: false })
  mediaId: ObjectId;

  /* @AutoMap()
  @Column()
  read: boolean; */
}
