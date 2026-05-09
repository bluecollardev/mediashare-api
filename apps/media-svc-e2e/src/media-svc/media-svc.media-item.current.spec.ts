/* Ignore module boundaries, it's just our test scaffolding */
/* eslint-disable @nx/enforce-module-boundaries */
import axios from 'axios';
import { clone } from 'remeda';
import { DataSource, MongoRepository } from 'typeorm';
import { AuthenticationResultType } from '@aws-sdk/client-cognito-identity-provider';
import { UpdateMediaItemDto } from '@mediashare/media-svc/src/app/modules/media-item/dto/update-media-item.dto';
import { MediaItemDto } from '@mediashare/media-svc/src/app/modules/media-item/dto/media-item.dto';
import { MediaItem } from '@mediashare/media-svc/src/app/modules/media-item/entities/media-item.entity';
import { User } from '@mediashare/user-svc/src/app/modules/user/entities/user.entity';
import { INestApplication } from '@nestjs/common';
import { getTestUserId, initializeTestUser } from './functions/user';
import { getBaseUrl, initializeApp, initializeDB } from './functions/app';
import { defaultOptionsWithBearer } from './functions/auth';
import {
  getTestMediaItemId,
  initializeTestMediaItem,
} from './functions/media-item';
import { initializeApp as initializeUserApi } from '@mediashare/user-svc-e2e/src/user-svc/functions/app';

describe('MediaItemAPI.e2e', () => {
  let app: INestApplication;
  let baseUrl: string;
  let userApi: INestApplication;
  let userApiBaseUrl: string;

  let db: DataSource;
  let mediaItemRepository: MongoRepository<MediaItem>;
  let userRepository: MongoRepository<User>;
  let authResponse: AuthenticationResultType;
  let testMediaItem;
  let testMediaItemId;
  let testUser;
  let testUserId;

  beforeAll(async () => {
    const globalPrefix = 'api';
    app = await initializeApp(globalPrefix);
    baseUrl = await getBaseUrl(app, globalPrefix);

    userApi = await initializeUserApi(globalPrefix);
    userApiBaseUrl = await getBaseUrl(userApi, globalPrefix);

    db = await initializeDB([MediaItem, User]);
    mediaItemRepository = await db.getMongoRepository(MediaItem);
    userRepository = await db.getMongoRepository(User);

    // Delete all test records
    await mediaItemRepository.deleteMany({});
  });

  beforeEach(async () => {
    // Delete all test records
    await mediaItemRepository.deleteMany({});
    await userRepository.deleteMany({});
  });

  afterAll(async () => {
    // await app.close();
    await db.close();
  });

  describe('MediaItemAPI should get the mediaItem', () => {
    it('should get the mediaItem', async () => {
      [testUser, authResponse] = await initializeTestUser(
        baseUrl,
        userApiBaseUrl
      );
      testUserId = getTestUserId(testUser);

      testMediaItem = await initializeTestMediaItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId);
      testMediaItemId = getTestMediaItemId(testMediaItem);

      await axios
        .get(
          `${baseUrl}/media-items/${testMediaItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          expect(res.status).toEqual(200);

          const mediaItem: MediaItemDto = res.data;
          expect(mediaItem).toBeTruthy();
          expect(mediaItem._id).toBeDefined();
          // TODO: This actually returns a profile object with authorId, author, authorImage and authorName
          // TODO: Dates aren't being returned, fix this!
          // expect(mediaItem.createdAt).toBeDefined();
          // expect(mediaItem.updatedDate).toBeDefined();
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });
  });

  describe('MediaItemAPI should update the mediaItem', () => {
    it('should update the mediaItem', async () => {
      [testUser, authResponse] = await initializeTestUser(
        baseUrl,
        userApiBaseUrl
      );
      testUserId = getTestUserId(testUser);

      testMediaItem = await initializeTestMediaItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId);
      testMediaItemId = getTestMediaItemId(testMediaItem);

      const dto = clone(testMediaItem) as UpdateMediaItemDto;

      await axios
        .put(
          `${baseUrl}/media-items/${testMediaItemId}`,
          dto,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then(async (res) => {
          expect(res.status).toEqual(200);

          const updated: MediaItemDto = res.data;
          expect(updated).toBeDefined();
          expect(updated._id).toEqual(testMediaItemId);
          expect(updated.createdAt).toEqual(testMediaItem.createdAt);
          expect(updated.updatedDate).toBeDefined();
          expect(new Date(updated.updatedDate).getTime()).toBeLessThanOrEqual(
            new Date(testMediaItem.createdAt).getTime()
          );

          // Don't trust the response object - find the mediaItem, and make sure it's updated too
          await axios
            .get(
              `${baseUrl}/media-items/${testMediaItemId}`,
              defaultOptionsWithBearer(authResponse?.IdToken)
            )
            .then((res) => {
              expect(res.status).toEqual(200);

              const mediaItem: MediaItemDto = res.data;
              expect(mediaItem).toBeTruthy();
              expect(mediaItem._id).toEqual(testMediaItemId);
              // TODO: Should ProfileDto return dates?
              // expect(mediaItem.createdAt).toEqual(testMediaItem.createdAt);
              // expect(mediaItem.updatedDate).toBeDefined();
            });
        })
        .catch((err) => {
          throw err;
          // expect(err).toBeDefined();
          // throwValidationError(errors);
        });
    });
  });

  describe('MediaItemAPI should delete the mediaItem', () => {
    it('should delete the mediaItem', async () => {
      [testUser, authResponse] = await initializeTestUser(
        baseUrl,
        userApiBaseUrl
      );
      testUserId = getTestUserId(testUser);

      testMediaItem = await initializeTestMediaItem(
        baseUrl,
        authResponse?.IdToken
      )(testUserId);
      testMediaItemId = getTestMediaItemId(testMediaItem);

      await axios
        .delete(
          `${baseUrl}/media-items/${testMediaItemId}`,
          defaultOptionsWithBearer(authResponse?.IdToken)
        )
        .then((res) => {
          // TODO: Make response 204 if no content
          expect(res.status).toEqual(200);
        });
    });
  });
});
