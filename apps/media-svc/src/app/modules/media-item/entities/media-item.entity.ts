import { AutoMap } from '@automapper/classes';
import { AutoMapOptions } from '@automapper/classes';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { ApiBaseEntity } from '@mediashare/core/entities/base.entity';
import { TagKeyValue } from '@mediashare/core/modules/tags/dto/tag-key-value.dto';
import { MediaVisibilityType } from '../../../core/models';

@Entity('media_item')
export class MediaItem extends ApiBaseEntity {
  @AutoMap()
  @Column({ nullable: false, type: 'text' })
  key: string;

  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  // Explicitly set the name option: https://github.com/typeorm/typeorm/issues/4026
  @Column({ nullable: false, type: 'text' })
  @Index('userId', { unique: false })
  userId: string;

  @AutoMap()
  @Column({ nullable: false, type: 'text' })
  title: string;

  @AutoMap()
  @Column({ nullable: true, type: 'text' })
  summary: string;

  @AutoMap()
  @Column({ nullable: false, type: 'text' })
  description: string;

  @AutoMap()
  @Column({ nullable: false, type: 'text' })
  uri: string;

  @AutoMap()
  @Column({ nullable: true })
  imageSrc: string;

  @AutoMap()
  @Column({ nullable: true })
  isPlayable: boolean;

  @AutoMap()
  @Column({ nullable: false })
  visibility: MediaVisibilityType;

  @AutoMap()
  @Column({ name: 'tags', array: true, nullable: true })
  tags: TagKeyValue[];
}
