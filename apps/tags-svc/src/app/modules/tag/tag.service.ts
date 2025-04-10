import { PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { ConfigService } from '@nestjs/config';
import { MongoRepository } from 'typeorm';
import { MongoFindManyOptions } from 'typeorm/find-options/mongodb/MongoFindManyOptions';
import { MongoFindOneOptions } from 'typeorm/find-options/mongodb/MongoFindOneOptions';

import { IdType } from '@mediashare/shared';
import { DataService } from '@mediashare/core/services';
import {
  ApiErrorResponse,
  ApiErrorResponses,
} from '@mediashare/core/errors/api-error';

import { Tag } from '@mediashare/core/modules/tags/tag.entity';
import { CreateTagDto } from '@mediashare/core/modules/tags/dto/create-tag.dto';
import { UpdateTagDto } from '@mediashare/core/modules/tags/dto/update-tag.dto';
import { TagDto } from '@mediashare/core/modules/tags/dto/tag.dto';

/* type CreateTagParameters = {
  playlistId: ObjectId;
  items: string[];
  createdBy: ObjectId;
}; */

@Injectable()
export class TagDataService extends DataService<Tag, MongoRepository<Tag>> {
  constructor(
    @InjectRepository(Tag) repository: MongoRepository<Tag>,
    logger: PinoLogger,
    private configService: ConfigService
  ) {
    super(repository, logger);
    this.repository
      // TODO: Support weights and upgrade MongoDB, for now we're just going to remove description as we can't weight the results...
      // .createCollectionIndex({ title: 'text', description: 'text' })
      .createCollectionIndex({ title: 'text' });
  }
}

@Injectable()
export class TagService {
  constructor(
    public dataService: TagDataService,
    @InjectMapper() private readonly classMapper: Mapper,
    logger: PinoLogger,
    private configService: ConfigService
  ) {}

  async create(createTagDto: CreateTagDto): Promise<TagDto> {
    const errors = await this.dataService.validateDto(
      CreateTagDto,
      createTagDto
    );
    if (errors)
      throw new ApiErrorResponse(ApiErrorResponses.ValidationError(errors));
    const entity = await this.classMapper.mapAsync(
      createTagDto,
      CreateTagDto,
      Tag
    );
    const result = await this.dataService.create(entity);
    return await this.classMapper.mapAsync(result, Tag, TagDto);
  }

  async update(
    playlistItemId: IdType,
    updateTagDto: UpdateTagDto
  ): Promise<TagDto> {
    const errors = await this.dataService.validateDto(
      UpdateTagDto,
      updateTagDto
    );
    if (errors)
      throw new ApiErrorResponse(ApiErrorResponses.ValidationError(errors));
    const entity = await this.classMapper.mapAsync(
      updateTagDto,
      UpdateTagDto,
      Tag
    );
    const result = await this.dataService.update(playlistItemId, entity);
    return await this.classMapper.mapAsync(result, Tag, TagDto);
  }

  async remove(id: IdType) {
    return await this.dataService.remove(id);
  }

  async findOne(id: IdType) {
    const entity = await this.dataService.findOne(id);
    return await this.classMapper.mapAsync(entity, Tag, TagDto);
  }

  async findAll() {
    return await this.dataService.findAll();
  }

  async findByQuery(query: MongoFindOneOptions<Tag>) {
    return await this.dataService.findByQuery(query);
  }

  async findAllByQuery(query: MongoFindManyOptions<Tag>) {
    return await this.dataService.findAllByQuery(query);
  }

  async getPopular() {
    // return await this.dataService.getPopular();
  }
}
