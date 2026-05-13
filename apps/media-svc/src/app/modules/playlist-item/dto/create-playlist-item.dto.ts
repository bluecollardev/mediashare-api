import { AutoMap } from '@automapper/classes';
import { ApiProperty } from '@nestjs/swagger';
import { ApiLongString, ApiString, ApiTextString } from '@mediashare/shared';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { TagKeyValue } from '@mediashare/core/modules/tags/dto/tag-key-value.dto';
import { MEDIA_VISIBILITY, MediaVisibilityType } from '../../../core/models';

export class CreatePlaylistItemDto {
  @IsString()
  @AutoMap()
  @ApiString({ required: true })
  playlistId: string;

  @IsString()
  @AutoMap()
  @ApiString({ required: true })
  mediaId: string;

  @IsOptional()
  @AutoMap()
  @ApiString({ required: true })
  createdBy?: string;

  @IsString()
  @AutoMap()
  @ApiString({ required: true })
  title: string;

  @IsOptional()
  @IsString()
  @AutoMap()
  @ApiLongString({ required: false })
  summary?: string;

  @IsString()
  @AutoMap()
  @ApiTextString({ required: true })
  description: string;

  @IsString()
  @AutoMap()
  @ApiLongString({ required: true })
  uri: string;

  @IsOptional()
  @IsString()
  @AutoMap()
  @ApiLongString({ required: false })
  imageSrc?: string;

  @IsOptional()
  @IsInt()
  @AutoMap()
  @ApiProperty({ type: 'number', required: false })
  sortIndex?: number;

  @IsOptional()
  @IsBoolean()
  @AutoMap()
  @ApiProperty({ required: false })
  isPlayable?: boolean;

  @IsIn(MEDIA_VISIBILITY)
  @AutoMap()
  @ApiProperty({
    enum: MEDIA_VISIBILITY,
    name: 'visibility',
    enumName: 'MediaVisibilityType',
    required: true,
  })
  visibility: MediaVisibilityType;

  @ApiProperty({
    type: () => TagKeyValue,
    required: false,
    isArray: true,
    nullable: true,
  })
  tags?: TagKeyValue[];
}
