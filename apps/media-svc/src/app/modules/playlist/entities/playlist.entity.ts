import { AutoMap } from '@automapper/classes';
import { AutoMapOptions } from '@automapper/classes';
import { Column, Entity, Index } from 'typeorm';
import { ObjectId } from 'mongodb';
import { ApiBaseEntity } from '@mediashare/core/entities/base.entity';
import { TagKeyValue } from '@mediashare/core/modules/tags/dto/tag-key-value.dto';
import { PlaylistVisibilityType } from '../../../core/models';

@Entity('playlist')
export class Playlist extends ApiBaseEntity {
  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @Column({ nullable: true })
  @Index('cloneOf', { unique: false })
  cloneOf?: ObjectId;

  @AutoMap()
  @Column({ nullable: true, type: 'text' })
  title: string;

  @AutoMap()
  @Column({ nullable: true, type: 'text' })
  description: string;

  @AutoMap()
  @Column({ nullable: true })
  imageSrc?: string;

  @AutoMap()
  @Column('mediaIds')
  mediaIds: ObjectId[];

  @AutoMap()
  @Column({ nullable: true })
  visibility: PlaylistVisibilityType;

  @AutoMap()
  @Column({ name: 'tags', array: true, nullable: true })
  tags: TagKeyValue[];
}
