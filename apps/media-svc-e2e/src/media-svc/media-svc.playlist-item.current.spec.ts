/* Ignore module boundaries, it's just our test scaffolding */
/* eslint-disable @nx/enforce-module-boundaries */
import axios from 'axios';
import { clone } from 'remeda';
import { INestApplication } from '@nestjs/common';
import { DataSource, MongoRepository } from 'typeorm';
import { initializePopulatedTestUser } from './functions/populated-user';
import { getTestUserId } from './functions/user';
import { getTestMediaItemId } from './functions/media-item';
import { getTestPlaylistId } from './functions/playlist';
import { getBaseUrl, initializeApp, initializeDB } from './functions/app';
import { defaultOptionsWithBearer } from './functions/auth';
import {
  getTestPlaylistItemId,
  initializeTestPlaylistItem,
} from './functions/playlist-item';
import { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';
import { Playlist } from '@mediashare/media-svc/src/app/modules/playlist/entities/playlist.entity';
import { UpdatePlaylistItemDto } from '@mediashare/media-svc/src/app/modules/playlist-item/dto/update-playlist-item.dto';
import { PlaylistItemDto } from '@mediashare/media-svc/src/app/modules/playlist-item/dto/playlist-item.dto';
import { PlaylistItem } from '@mediashare/media-svc/src/app/modules/playlist-item/entities/playlist-item.entity';
import { MediaItem } from '@mediashare/media-svc/src/app/modules/media-item/entities/media-item.entity';
import { User } from '@mediashare/user-svc/src/app/modules/user/entities/user.entity';
import { initializeApp as initializeUserApi } from '@mediashare/user-svc-e2e/src/user-svc/functions/app';

describe('PlaylistItemAPI.e2e', () => {
  let app: INestApplication;
  let baseUrl: string;
  let userApi: INestApplication;
  let userApiBaseUrl: string;

  let db: DataSource;
  let playlistItemRepository: MongoRepository<PlaylistItem>;
  let playlistRepository: MongoRepository<Playlist>;
  let mediaItemRepository: MongoRepository<MediaItem>;
  let userRepository: MongoRepository<User>;
  let authResponse: AuthenticationResultType;
  let testPlaylistItem;
  let testPlaylistItemId;
  let testUserId;
  let testPlaylistId;
  let testMediaItemId;

  beforeAll(async () => {
    const globalPrefix = 'api';
    app = await initializeApp(globalPrefix);
    baseUrl = await getBaseUrl(app, globalPrefix);

    userApi = await initializeUserApi(globalPrefix);
    userApiBaseUrl = await getBaseUrl(userApi, globalPrefix);

    db = await initializeDB([PlaylistItem, Playlist, MediaItem, User]);
    playlistItemRepository = await db.getMongoRepository(PlaylistItem);
    playlistRepository = await db.getMongoRepository(Playlist);
    mediaItemRepository = await db.getMongoRepository(MediaItem);
    userRepository = await db.getMongoRepository(User);

    // Delete all test records
    await playlistItemRepository.deleteMany({});
  });

  beforeEach(async () => {
    // Delete all test records
    await playlistItemRepository.deleteMany({});
    await playlistRepository.deleteMany({});
    await mediaItemRepository.deleteMany({});
    await userRepository.deleteMany({});
  });

  afterAll(async () => {
    // await app.close();
    await db.close();
  });

  describe('PlaylistAPI should get the playlistItem', () => {
    it('should get the playlistItem', async () => {
      const {
        testUser,
        authResponse,
        mediaItem: testMediaItem,
        playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      testMediaItemId = getTestMediaItemId(testMediaItem);
      testPlaylistId = getTestPlaylistId(testPlaylist);

      testPlaylistItem = await initializeTestPlaylistItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, testPlaylistId, testMediaItemId);
      testPlaylistItemId = getTestPlaylistItemId(testPlaylistItem);

      await axios
        .get(
          `${baseUrl}/playlist-items/${testPlaylistItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          expect(res.status).toEqual(200);

          const playlistItem: PlaylistItemDto = res.data;
          expect(playlistItem).toBeTruthy();
          expect(playlistItem._id).toBeDefined();
          // TODO: This actually returns a profile object with authorId, author, authorImage and authorName
          // TODO: Dates aren't being returned, fix this!
          // expect(playlistItem.createdAt).toBeDefined();
          // expect(playlistItem.updatedDate).toBeDefined();
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });
  });

  describe('PlaylistAPI should update the playlistItem', () => {
    it('should update the playlistItem', async () => {
      const {
        testUser,
        authResponse,
        mediaItem: testMediaItem,
        playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      testMediaItemId = getTestMediaItemId(testMediaItem);
      testPlaylistId = getTestPlaylistId(testPlaylist);

      testPlaylistItem = await initializeTestPlaylistItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, testPlaylistId, testMediaItemId);
      testPlaylistItemId = getTestPlaylistItemId(testPlaylistItem);

      const dto = clone(testPlaylistItem) as UpdatePlaylistItemDto;

      await axios
        .put(
          `${baseUrl}/playlist-items/${testPlaylistItemId}`,
          dto,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then(async (res) => {
          expect(res.status).toEqual(200);

          const updated: PlaylistItemDto = res.data;
          expect(updated).toBeDefined();
          expect(updated._id).toEqual(testPlaylistItemId);
          expect(updated.createdAt).toEqual(testPlaylistItem.createdAt);
          expect(updated.updatedDate).toBeDefined();
          expect(new Date(updated.updatedDate).getTime()).toBeLessThanOrEqual(
            new Date(testPlaylistItem.createdAt).getTime()
          );

          // Don't trust the response object - find the playlistItem, and make sure it's updated too
          await axios
            .get(
              `${baseUrl}/playlist-items/${testPlaylistItemId}`,
              defaultOptionsWithBearer(authResponse?.IdToken)
            )
            .then((res) => {
              expect(res.status).toEqual(200);

              const playlistItem: PlaylistItemDto = res.data;
              expect(playlistItem).toBeDefined();
              expect(playlistItem._id).toEqual(testPlaylistItemId);
              // TODO: Should ProfileDto return dates?
              // expect(playlistItem.createdAt).toEqual(testPlaylistItem.createdAt);
              // expect(playlistItem.updatedDate).toBeDefined();
            });
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });
  });

  describe('PlaylistAPI should delete the playlistItem', () => {
    it('should delete the playlistItem', async () => {
      const {
        testUser,
        authResponse,
        mediaItem: testMediaItem,
        playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      testMediaItemId = getTestMediaItemId(testMediaItem);
      testPlaylistId = getTestPlaylistId(testPlaylist);

      testPlaylistItem = await initializeTestPlaylistItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, testPlaylistId, testMediaItemId);
      testPlaylistItemId = getTestPlaylistItemId(testPlaylistItem);

      await axios
        .delete(
          `${baseUrl}/playlist-items/${testPlaylistItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          // TODO: Make response 204 if no content
          expect(res.status).toEqual(200);
        });
    });
  });
});
