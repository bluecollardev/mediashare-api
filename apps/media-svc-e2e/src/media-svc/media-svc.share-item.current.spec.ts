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
  getTestShareItemId,
  initializeTestShareItem,
} from './functions/share-item';
import { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';
import { Playlist } from '@mediashare/media-svc/src/app/modules/playlist/entities/playlist.entity';
import {
  UpdateMediaShareItemDto,
  UpdatePlaylistShareItemDto,
} from '@mediashare/media-svc/src/app/modules/share-item/dto/update-share-item.dto';
import {
  MediaShareItemDto,
  PlaylistShareItemDto,
} from '@mediashare/media-svc/src/app/modules/share-item/dto/share-item.dto';
import { ShareItem } from '@mediashare/media-svc/src/app/modules/share-item/entities/share-item.entity';
import { MediaItem } from '@mediashare/media-svc/src/app/modules/media-item/entities/media-item.entity';
import { User } from '@mediashare/user-svc/src/app/modules/user/entities/user.entity';
import { initializeApp as initializeUserApi } from '@mediashare/user-svc-e2e/src/user-svc/functions/app';

describe('ShareItemAPI.e2e', () => {
  let app: INestApplication;
  let baseUrl: string;
  let userApi: INestApplication;
  let userApiBaseUrl: string;

  let db: DataSource;
  let shareItemRepository: MongoRepository<ShareItem>;
  let playlistRepository: MongoRepository<Playlist>;
  let mediaItemRepository: MongoRepository<MediaItem>;
  let userRepository: MongoRepository<User>;
  let authResponse: AuthenticationResultType;
  let testShareItem;
  let testShareItemId;
  let testUserId;
  let testPlaylistId;
  let testMediaItemId;

  beforeAll(async () => {
    const globalPrefix = 'api';
    app = await initializeApp(globalPrefix);
    baseUrl = await getBaseUrl(app, globalPrefix);

    userApi = await initializeUserApi(globalPrefix);
    userApiBaseUrl = await getBaseUrl(userApi, globalPrefix);

    db = await initializeDB([ShareItem, Playlist, MediaItem, User]);
    shareItemRepository = await db.getMongoRepository(ShareItem);
    playlistRepository = await db.getMongoRepository(Playlist);
    mediaItemRepository = await db.getMongoRepository(MediaItem);
    userRepository = await db.getMongoRepository(User);

    // Delete all test records
    await shareItemRepository.deleteMany({});
  });

  beforeEach(async () => {
    // Delete all test records
    await shareItemRepository.deleteMany({});
    await playlistRepository.deleteMany({});
    await mediaItemRepository.deleteMany({});
    await userRepository.deleteMany({});
  });

  afterAll(async () => {
    // await app.close();
    await db.close();
  });

  describe('ShareItemsAPI should get the shareItem', () => {
    it('should get create and get a media shareItem', async () => {
      const {
        testUser,
        mediaItem: testMediaItem,
        // playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      testMediaItemId = getTestMediaItemId(testMediaItem);
      // testPlaylistId = getTestPlaylistId(testPlaylist);

      testShareItem = await initializeTestShareItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, undefined, testMediaItemId);
      testShareItemId = getTestShareItemId(testShareItem);

      await axios
        .get(
          `${baseUrl}/share-items/${testShareItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          expect(res.status).toEqual(200);

          const shareItem: MediaShareItemDto = res.data;
          expect(shareItem).toBeTruthy();
          expect(shareItem._id).toBeDefined();
          // TODO: This actually returns a profile object with authorId, author, authorImage and authorName
          // TODO: Dates aren't being returned, fix this!
          // expect(shareItem.createdAt).toBeDefined();
          // expect(shareItem.updatedDate).toBeDefined();
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });

    it('should get create and get a playlist shareItem', async () => {
      const {
        testUser,
        // mediaItem: testMediaItem,
        playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      // testMediaItemId = getTestMediaItemId(testMediaItem);
      testPlaylistId = getTestPlaylistId(testPlaylist);

      testShareItem = await initializeTestShareItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, testPlaylistId, undefined);
      testShareItemId = getTestShareItemId(testShareItem);

      await axios
        .get(
          `${baseUrl}/share-items/${testShareItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          expect(res.status).toEqual(200);

          const shareItem: PlaylistShareItemDto = res.data;
          expect(shareItem).toBeTruthy();
          expect(shareItem._id).toBeDefined();
          // TODO: This actually returns a profile object with authorId, author, authorImage and authorName
          // TODO: Dates aren't being returned, fix this!
          // expect(shareItem.createdAt).toBeDefined();
          // expect(shareItem.updatedDate).toBeDefined();
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });
  });

  describe('ShareItemsAPI should update the shareItem', () => {
    it('should update the media shareItem', async () => {
      const {
        testUser,
        mediaItem: testMediaItem,
        // playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      testMediaItemId = getTestMediaItemId(testMediaItem);
      // testPlaylistId = getTestPlaylistId(testPlaylist);

      testShareItem = await initializeTestShareItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, undefined, testMediaItemId);
      testShareItemId = getTestShareItemId(testShareItem);

      const dto = clone(testShareItem) as UpdateMediaShareItemDto;

      await axios
        .put(
          `${baseUrl}/share-items/${testShareItemId}`,
          dto,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then(async (res) => {
          expect(res.status).toEqual(200);

          const updated: MediaShareItemDto = res.data;
          expect(updated).toBeDefined();
          expect(updated._id).toEqual(testShareItemId);
          expect(updated.createdAt).toEqual(testShareItem.createdAt);
          expect(updated.updatedDate).toBeDefined();
          expect(new Date(updated.updatedDate).getTime()).toBeLessThanOrEqual(
            new Date(testShareItem.createdAt).getTime()
          );

          // Don't trust the response object - find the shareItem, and make sure it's updated too
          await axios
            .get(
              `${baseUrl}/share-items/${testShareItemId}`,
              defaultOptionsWithBearer(authResponse?.IdToken)
            )
            .then((res) => {
              expect(res.status).toEqual(200);

              const shareItem: MediaShareItemDto = res.data;
              expect(shareItem).toBeDefined();
              expect(shareItem._id).toEqual(testShareItemId);
              // TODO: Should ProfileDto return dates?
              // expect(shareItem.createdAt).toEqual(testShareItem.createdAt);
              // expect(shareItem.updatedDate).toBeDefined();
            });
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });

    it('should update the playlist shareItem', async () => {
      const {
        testUser,
        // mediaItem: testMediaItem,
        playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      // testMediaItemId = getTestMediaItemId(testMediaItem);
      testPlaylistId = getTestPlaylistId(testPlaylist);

      testShareItem = await initializeTestShareItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, testPlaylistId, undefined);
      testShareItemId = getTestShareItemId(testShareItem);

      const dto = clone(testShareItem) as UpdatePlaylistShareItemDto;

      await axios
        .put(
          `${baseUrl}/share-items/${testShareItemId}`,
          dto,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then(async (res) => {
          expect(res.status).toEqual(200);

          const updated: PlaylistShareItemDto = res.data;
          expect(updated).toBeDefined();
          expect(updated._id).toEqual(testShareItemId);
          expect(updated.createdAt).toEqual(testShareItem.createdAt);
          expect(updated.updatedDate).toBeDefined();
          expect(new Date(updated.updatedDate).getTime()).toBeLessThanOrEqual(
            new Date(testShareItem.createdAt).getTime()
          );

          // Don't trust the response object - find the shareItem, and make sure it's updated too
          await axios
            .get(
              `${baseUrl}/share-items/${testShareItemId}`,
              defaultOptionsWithBearer(authResponse?.IdToken)
            )
            .then((res) => {
              expect(res.status).toEqual(200);

              const shareItem: PlaylistShareItemDto = res.data;
              expect(shareItem).toBeDefined();
              expect(shareItem._id).toEqual(testShareItemId);
              // TODO: Should ProfileDto return dates?
              // expect(shareItem.createdAt).toEqual(testShareItem.createdAt);
              // expect(shareItem.updatedDate).toBeDefined();
            });
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });
  });

  describe('ShareItemsAPI should delete the shareItem', () => {
    it('should delete the shareItem', async () => {
      const {
        testUser,
        mediaItem: testMediaItem,
        playlist: testPlaylist,
      } = await initializePopulatedTestUser(baseUrl, userApiBaseUrl);
      testUserId = getTestUserId(testUser);
      testMediaItemId = getTestMediaItemId(testMediaItem);
      testPlaylistId = getTestPlaylistId(testPlaylist);

      testShareItem = await initializeTestShareItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId, testPlaylistId, testMediaItemId);
      testShareItemId = getTestShareItemId(testShareItem);

      await axios
        .delete(
          `${baseUrl}/share-items/${testShareItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          // TODO: Make response 204 if no content
          expect(res.status).toEqual(200);
        });
    });
  });
});
