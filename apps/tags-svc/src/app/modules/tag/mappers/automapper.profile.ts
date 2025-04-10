/* istanbul ignore file */
import {
  convertUsing,
  createMap,
  forMember,
  ignore,
  Mapper,
} from '@automapper/core';
import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import {
  objectIdToStringConverter,
  stringToObjectIdConverter,
} from '@mediashare/core/mappings/converters';
import { Injectable } from '@nestjs/common';
import { Tag } from '@mediashare/core/modules/tags/tag.entity';
import { CreateTagDto } from '@mediashare/core/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@mediashare/core/modules/tags/dto/update-tag.dto';
import { TagDto } from '@mediashare/core/modules/tags/dto/tag.dto';

export const tagToTagDtoMappingFactory = (mapper) =>
  createMap(
    mapper,
    Tag,
    TagDto,
    forMember(
      (dest: TagDto) => dest._id,
      convertUsing(
        objectIdToStringConverter as never,
        (source: Tag) => source._id
      )
    )
    // forMember((dest: TagDto) => dest.createdBy, convertUsing(objectIdToStringConverter as never, (source: Tag) => source.createdBy)),
  );

export const createTagDtoToTagMappingFactory = (mapper) =>
  createMap(
    mapper,
    CreateTagDto,
    Tag,
    forMember((dest: Tag) => dest._id, ignore())
  );

export const updateTagDtoToTagMappingFactory = (mapper) =>
  createMap(
    mapper,
    UpdateTagDto,
    Tag,
    forMember(
      (dest: Tag) => dest._id,
      convertUsing(
        stringToObjectIdConverter as never,
        (source: UpdateTagDto) => source._id
      )
    )
  );

@Injectable()
export class TagMapping extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  override get profile() {
    return (mapper) => {
      tagToTagDtoMappingFactory(mapper);
      createTagDtoToTagMappingFactory(mapper);
      updateTagDtoToTagMappingFactory(mapper);
    };
  }
}
