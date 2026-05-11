import { PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { ConfigService } from '@nestjs/config';
import { MongoRepository } from 'typeorm';
import { MongoFindManyOptions } from 'typeorm/find-options/mongodb/MongoFindManyOptions';
import { MongoFindOneOptions } from 'typeorm/find-options/mongodb/MongoFindOneOptions';

import { StringIdGuard } from '@mediashare/core/guards';
import { IdType, SearchParameters } from '@mediashare/shared';
import { FilterableDataService } from '@mediashare/core/services';
import {
  ApiErrorResponse,
  ApiErrorResponses,
} from '@mediashare/core/errors/api-error';

import { MediaItem } from './entities/media-item.entity';
import { CreateMediaItemDto } from './dto/create-media-item.dto';
import { UpdateMediaItemDto } from './dto/update-media-item.dto';
import { MediaItemDto } from './dto/media-item.dto';

import { VISIBILITY_PUBLIC, VISIBILITY_SUBSCRIPTION } from '../../core/models';

@Injectable()
export class MediaItemDataService extends FilterableDataService<
  MediaItem,
  MongoRepository<MediaItem>
> {
  constructor(
    @InjectRepository(MediaItem) repository: MongoRepository<MediaItem>,
    logger: PinoLogger,
    private configService: ConfigService
  ) {
    super(repository, logger);
    this.repository
      // TODO: Support weights and upgrade MongoDB, for now we're just going to remove description as we can't weight the results...
      // .createCollectionIndex({ title: 'text', description: 'text' })
      .createCollectionIndex({ title: 'text' })
      .then((indexName) => {
        this.collectionIndexName = indexName;
      });
  }

  protected buildAggregateQuery(params: SearchParameters) {
    const {
      userId,
      query,
      fullText = false,
      // textMatchingMode = 'and',
      tags,
      // TODO: Complete support for tagsMatchingMode (it's not exposed via controller)
      tagsMatchingMode = 'all', // all | any // TODO: Type this!
    }: SearchParameters = params;

    let aggregateQuery = [];

    // We have to search by text first as $match->$text is only allowed to be the first part of an aggregate query
    // TODO: fullText means a search on all index fields, this is only supported in MongoDB Atlas
    // Not sure if we want to use Atlas as we can't self host... we can implement distributed search later...
    if (query && fullText) {
      // IMPORTANT! This shouldn't run at any time (fullText = false is hardcoded)
      throw new Error('Elastic search has not been implemented');
    } else if (query && !fullText) {
      if (this.useDistributedSearch) {
        throw new Error('Elastic search has not been implemented');
      }
    }

    // Match by user ID if it's available as it's indexed and this is the best way to reduce the number of results early
    // Authenticated users see their own media_items UNION the configured app-subscriber-content
    // creators' public/subscription items.
    if (userId) {
      const appSubscriberContentUserIds = this.configService.get(
        'app.appSubscriberContentUserIds',
        ['default']
      );
      const ownershipOrSubscriberContent = {
        $or: [
          { createdBy: userId },
          {
            createdBy: {
              $in: appSubscriberContentUserIds.map((id) => StringIdGuard(id)),
            },
            visibility: {
              $in: [VISIBILITY_PUBLIC, VISIBILITY_SUBSCRIPTION],
            },
          },
        ],
      };
      aggregateQuery = aggregateQuery.concat([
        {
          $match: query
            ? { $text: { $search: query }, ...ownershipOrSubscriberContent }
            : ownershipOrSubscriberContent,
        },
      ]);
    } else {
      // Only return search results that are app subscriber content (for paying app subscribers), shared content from a user's network, or public content
      const appSubscriberContentUserIds = this.configService.get(
        'app.appSubscriberContentUserIds',
        ['default']
      );
      aggregateQuery = aggregateQuery.concat([
        {
          $match: query
            ? {
                $text: { $search: query },
                $and: [
                  {
                    $or: [
                      ...appSubscriberContentUserIds.map((id) => ({
                        createdBy: StringIdGuard(id),
                      })),
                    ],
                  },
                  {
                    visibility: {
                      $in: [VISIBILITY_PUBLIC, VISIBILITY_SUBSCRIPTION],
                    },
                  },
                ],
              }
            : {
                $and: [
                  {
                    $or: [
                      ...appSubscriberContentUserIds.map((id) => ({
                        createdBy: StringIdGuard(id),
                      })),
                    ],
                  },
                  {
                    visibility: {
                      $in: [VISIBILITY_PUBLIC, VISIBILITY_SUBSCRIPTION],
                    },
                  },
                ],
              },
        },
      ]);
    }

    // Tags are not indexed as they're nested in the documents, so do this last!
    if (tags) {
      aggregateQuery = aggregateQuery.concat([
        {
          $addFields: {
            matchedTags: '$tags.key',
          },
        },
      ]);

      if (tagsMatchingMode === 'any') {
        aggregateQuery.push({
          $match: {
            // TODO: User tags?
            // createdBy: userId,
            matchedTags: { $in: tags },
          },
        });
      } else if (tagsMatchingMode === 'all') {
        aggregateQuery.push({
          $match: {
            // TODO: User tags?
            // createdBy: userId,
            matchedTags: { $all: tags },
          },
        });
      }
    }

    return aggregateQuery;
  }

  protected buildFields() {
    return [
      ...this.buildAuthorFields(),
      // { $lookup: { from: 'share_item', localField: '_id', foreignField: 'mediaId', as: 'shareItems' } },
      // { $lookup: { from: 'view_item', localField: '_id', foreignField: 'mediaId', as: 'viewItems' } },
      // { $lookup: { from: 'like_item', localField: '_id', foreignField: 'mediaId', as: 'likeItems' } },
    ];
  }

  protected replaceRoot(): object {
    return {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            {
              _id: '$_id',
              ...this.buildAuthorReplaceRootDetails(),
              title: '$title',
              description: '$description',
              uri: '$uri',
              imageSrc: '$imageSrc',
              visibility: '$visibility',
              tags: '$tags',
              // shareCount: { $size: '$shareItems' },
              // likesCount: { $size: '$likeItems' },
              // viewCount: { $size: '$viewItems' },
              createdBy: '$createdBy',
              createdAt: '$createdAt',
              updatedDate: '$updatedDate',
            },
          ],
        },
      },
    };
  }
}

@Injectable()
export class MediaItemService {
  constructor(
    public dataService: MediaItemDataService,
    @InjectMapper() private readonly classMapper: Mapper
  ) {}

  async create(createMediaItemDto: CreateMediaItemDto): Promise<MediaItemDto> {
    const errors = await this.dataService.validateDto(
      CreateMediaItemDto,
      createMediaItemDto
    );
    if (errors)
      throw new ApiErrorResponse(ApiErrorResponses.ValidationError(errors));
    const entity = await this.classMapper.mapAsync(
      createMediaItemDto,
      CreateMediaItemDto,
      MediaItem
    );
    const result = await this.dataService.create(entity);
    return await this.classMapper.mapAsync(result, MediaItem, MediaItemDto);
  }

  async update(
    mediaItemId: IdType,
    updateMediaItemDto: UpdateMediaItemDto
  ): Promise<MediaItemDto> {
    const errors = await this.dataService.validateDto(
      UpdateMediaItemDto,
      updateMediaItemDto
    );
    if (errors)
      throw new ApiErrorResponse(ApiErrorResponses.ValidationError(errors));
    const entity = await this.classMapper.mapAsync(
      updateMediaItemDto,
      UpdateMediaItemDto,
      MediaItem
    );
    const result = await this.dataService.update(mediaItemId, entity);
    return await this.classMapper.mapAsync(result, MediaItem, MediaItemDto);
  }

  async remove(id: IdType) {
    return await this.dataService.remove(id);
  }

  async getById(id: IdType) {
    return await this.dataService.getById(id);
  }

  async getBySub(id: IdType) {
    return await this.dataService.getBySub(id);
  }

  async findOne(id: IdType) {
    const entity = await this.dataService.findOne(id);
    return await this.classMapper.mapAsync(entity, MediaItem, MediaItemDto);
  }

  async findAll() {
    return await this.dataService.findAll();
  }

  async findByQuery(query: MongoFindOneOptions<MediaItem>) {
    return await this.dataService.findByQuery(query);
  }

  async findAllByQuery(query: MongoFindManyOptions<MediaItem>) {
    return await this.dataService.findAllByQuery(query);
  }

  async getPopular() {
    return await this.dataService.getPopular();
  }

  async search({ userId, query, tags }: SearchParameters) {
    return await this.dataService.search({ userId, query, tags });
  }
}
