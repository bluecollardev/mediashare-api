import { AutoMap } from '@automapper/classes';
import { AutoMapOptions } from '@automapper/classes';
import { IsIn } from 'class-validator';
import { Column, Entity, Index, ObjectIdColumn } from 'typeorm';
import { ObjectId } from 'mongodb';
import { ApiBaseEntity } from '@mediashare/core/entities';
import { TagKeyValue } from '@mediashare/core/modules/tags/dto/tag-key-value.dto';

import { MEDIA_VISIBILITY, MediaVisibilityType } from '../../../core/models';

@Entity('playlist_item')
export class PlaylistItem extends ApiBaseEntity {
  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @ObjectIdColumn({ name: 'playlistId', nullable: false, unique: false })
  @Index('playlistId', { unique: false })
  playlistId: ObjectId;

  @AutoMap({ typeFn: () => ObjectId } as AutoMapOptions)
  @ObjectIdColumn({ name: 'mediaId', nullable: false, unique: false })
  @Index('mediaId')
  mediaId: ObjectId;

  @AutoMap()
  @Column({ nullable: true })
  sortIndex?: number;

  @AutoMap()
  @Column({ nullable: true, type: 'text' })
  title: string;

  @AutoMap()
  @Column({ nullable: true, type: 'text' })
  summary?: string;

  @AutoMap()
  @Column({ nullable: true, type: 'text' })
  description: string;

  @AutoMap()
  @Column({ nullable: false })
  uri: string;

  @AutoMap()
  @Column({ nullable: true })
  imageSrc?: string;

  @AutoMap()
  @Column({ nullable: true })
  isPlayable?: boolean;

  @IsIn(MEDIA_VISIBILITY)
  // TODO: Change this to false once all data is updated!
  @Column({ nullable: true })
  visibility: MediaVisibilityType;

  @Column({ name: 'tags', array: true, nullable: true })
  tags: TagKeyValue[];

  // Denormalized snapshots of the original creator. Preserved across clones
  // so attribution survives even when `createdBy` shifts to the cloning user.
  @Column({ nullable: true })
  username?: string;

  @Column({ nullable: true })
  author?: Record<string, any>;

  @Column({ nullable: true })
  authorProfile?: Record<string, any>;

  @Column({ nullable: true })
  category?: string;
}
