import { PinoLogger } from 'nestjs-pino';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMapper } from '@automapper/nestjs';
import { Mapper } from '@automapper/core';
import { ConfigService } from '@nestjs/config';
import { MongoRepository } from 'typeorm';
import { MongoFindManyOptions } from 'typeorm/find-options/mongodb/MongoFindManyOptions';
import { MongoFindOneOptions } from 'typeorm/find-options/mongodb/MongoFindOneOptions';

import { ObjectIdGuard, StringIdGuard } from '@mediashare/core/guards';
import { IdType } from '@mediashare/shared';
import { SearchParameters } from '@mediashare/shared';
import { FilterableDataService } from '@mediashare/core/services';

import { PlaylistItemService } from '../playlist-item/playlist-item.service';
import { Playlist } from './entities/playlist.entity';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PlaylistDto } from '../playlist/dto/playlist.dto';
import { PlaylistItem } from '../playlist-item/entities/playlist-item.entity';

import { VISIBILITY_PUBLIC, VISIBILITY_SUBSCRIPTION } from '../../core/models';

/* type CreatePlaylistParameters = {
  playlistId: ObjectId;
  items: string[];
  createdBy: ObjectId;
}; */

@Injectable()
export class PlaylistDataService extends FilterableDataService<
  Playlist,
  MongoRepository<Playlist>
> {
  constructor(
    @InjectRepository(Playlist) repository: MongoRepository<Playlist>,
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
      ownerOnly = false,
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

    // Match by user ID if it's available as it's indexed and this is the best way to reduce the number of results early.
    // Authenticated users see their own content UNION the configured app-subscriber-content
    // creators' public/subscription playlists. This is what makes "master content user"
    // visible to every authenticated subscriber.
    if (userId) {
      // ownerOnly skips the subscriber-content branch — used by Library /
      // "My Playlists" endpoints so AFehr's content doesn't appear there.
      const matchClause = ownerOnly
        ? { createdBy: userId }
        : (() => {
            const appSubscriberContentUserIds = this.configService.get(
              'app.appSubscriberContentUserIds',
              ['default']
            );
            return {
              $or: [
                { createdBy: userId },
                {
                  createdBy: {
                    $in: appSubscriberContentUserIds.map((id) =>
                      StringIdGuard(id)
                    ),
                  },
                  visibility: {
                    $in: [VISIBILITY_PUBLIC, VISIBILITY_SUBSCRIPTION],
                  },
                },
              ],
            };
          })();
      aggregateQuery = aggregateQuery.concat([
        {
          $match: query
            ? { $text: { $search: query }, ...matchClause }
            : matchClause,
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
      {
        $lookup: {
          from: 'media_item',
          localField: 'mediaIds',
          foreignField: '_id',
          as: 'mediaItems',
        },
      },
      {
        $lookup: {
          from: 'playlist_item',
          localField: '_id',
          foreignField: 'playlistId',
          as: 'playlistItems',
        },
      },
      ...this.buildAuthorFields(),
      // { $lookup: { from: 'share_item', localField: '_id', foreignField: 'playlistId', as: 'shareItems' } },
      // { $lookup: { from: 'view_item', localField: '_id', foreignField: 'playlistId', as: 'viewItems' } },
      // { $lookup: { from: 'like_item', localField: '_id', foreignField: 'playlistId', as: 'likeItems' } },
    ];
  }

  protected replaceRoot(): object {
    return {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            {
              _id: '$_id',
              userId: '$userId',
              ...this.buildAuthorReplaceRootDetails(),
              title: '$title',
              description: '$description',
              imageSrc: '$imageSrc',
              visibility: '$visibility',
              tags: '$tags',
              mediaItems: '$mediaItems',
              playlistItems: '$playlistItems',
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
export class PlaylistService {
  constructor(
    public dataService: PlaylistDataService,
    @InjectMapper() private readonly classMapper: Mapper,
    logger: PinoLogger,
    private configService: ConfigService,
    private playlistItemService: PlaylistItemService
  ) {}

  async create(dto: CreatePlaylistDto & { createdBy: IdType }) {
    const {
      title,
      visibility,
      description,
      imageSrc,
      mediaIds,
      tags,
      createdBy,
      cloneOf,
    } = dto;
    return await this.dataService.create({
      title,
      visibility,
      description,
      imageSrc,
      tags,
      createdBy,
      mediaIds: mediaIds.map((id) => ObjectIdGuard(id)),
      cloneOf,
    } as any);
  }

  async update(playlistId: IdType, dto: UpdatePlaylistDto) {
    const { mediaIds, ...rest } = dto;
    // TODO: Transaction!
    // Get playlist items by playlistId
    const playlistItems = await this.playlistItemService.findAllByQuery({
      playlistId: ObjectIdGuard(playlistId),
    } as any);
    // Filter out any deleted media items
    const playlistItemIdsToDelete = playlistItems
      // If playlist item mediaId is NOT included in our mediaIds, delete the playlist item
      .filter(
        (item: PlaylistItem) => !mediaIds.includes(item.mediaId.toString())
      )
      .map((item: PlaylistItem) => item._id.toString());

    // Ensure unique ids
    const uniquePlaylistItemIdsToDelete = Array.from(
      new Set(playlistItemIdsToDelete)
    );
    const deletePlaylistItems = uniquePlaylistItemIdsToDelete.map(
      async (playlistItemId) =>
        await this.playlistItemService.remove(playlistItemId)
    );

    const result = await Promise.all(deletePlaylistItems);
    if (!result) {
      // Handle error
    }

    return await this.dataService.update(playlistId, {
      ...rest,
      mediaIds:
        mediaIds.length > 0 ? mediaIds.map((id) => ObjectIdGuard(id)) : [],
    } as any);
  }

  async remove(playlistId: IdType) {
    // Get playlist items by playlistId
    const playlistItems = await this.playlistItemService.findAllByQuery({
      playlistId: ObjectIdGuard(playlistId),
    } as any);
    const playlistItemIdsToDelete = playlistItems.map((item: PlaylistItem) =>
      item._id.toString()
    );
    const deletePlaylistItems = playlistItemIdsToDelete.map(
      async (playlistItemId) =>
        await this.playlistItemService.remove(playlistItemId)
    );

    const result = await Promise.all(deletePlaylistItems);
    if (!result) {
      // Handle error
    }

    return await this.dataService.remove(playlistId);
  }

  /* private async createPlaylistItems({ playlistId, items, createdBy }: CreatePlaylistParameters) {
    if (!playlistId || typeof playlistId === 'string') throw new Error('wrong type in createPlaylistItems.id');
    const mappedItems = items.map((item) => ({ item, playlistId, createdBy }));
    return await this.playlistItemService.insertMany(mappedItems);
  }

  private async updatePlaylistItems({ playlistId, items, createdBy }: CreatePlaylistParameters) {
    if (!playlistId || typeof playlistId === 'string') throw new Error('wrong type in createPlaylistItems.id');
    const mappedItems = items.map((item) => ({ item, playlistId, createdBy }));
    return await this.playlistItemService.insertMany(mappedItems);
  } */

  async getById(id: IdType) {
    return await this.dataService.getById(id);
  }

  async getBySub(id: IdType) {
    return await this.dataService.getBySub(id);
  }

  async findOne(id: IdType) {
    const entity = await this.dataService.findOne(id);
    return await this.classMapper.mapAsync(entity, Playlist, PlaylistDto);
  }

  async findAll() {
    return await this.dataService.findAll();
  }

  async findByQuery(query: MongoFindOneOptions<Playlist>) {
    return await this.dataService.findByQuery(query);
  }

  async findAllByQuery(query: MongoFindManyOptions<Playlist>) {
    return await this.dataService.findAllByQuery(query);
  }

  async getPopular() {
    return await this.dataService.getPopular();
  }

  async search(params: SearchParameters) {
    return await this.dataService.search(params);
  }
}
