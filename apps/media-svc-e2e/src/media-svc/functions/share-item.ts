/* Ignore module boundaries, it's just our test scaffolding */
/* eslint-disable @nx/enforce-module-boundaries */
import axios from 'axios';
import { testAndCloneShareItem } from '../test-components';
import { defaultOptionsWithBearer } from './auth';
import {
  CreateMediaShareItemDto,
  CreatePlaylistShareItemDto,
} from '@mediashare/media-svc/src/app/modules/share-item/dto/create-share-item.dto';

export const createMediaShareItem =
  ({ baseUrl, token }) =>
  async (shareItem) => {
    const dto = {
      ...shareItem,
    } as CreateMediaShareItemDto;

    return axios.post(
      `${baseUrl}/share-items`,
      dto,
      defaultOptionsWithBearer(token)
    );
  };

export const createPlaylistShareItem =
  ({ baseUrl, token }) =>
  async (shareItem) => {
    const dto = {
      ...shareItem,
    } as CreatePlaylistShareItemDto;

    return axios.post(
      `${baseUrl}/share-items`,
      dto,
      defaultOptionsWithBearer(token)
    );
  };

export const createAndValidateTestShareItem = async (
  createShareItemFn,
  shareItemData = {
    // Default data
  }
) => {
  return new Promise((resolve, reject) => {
    createShareItemFn(shareItemData)
      .then((res) => {
        expect(res.status).toEqual(201);
        const shareItem = res.data;
        testAndCloneShareItem(shareItem, shareItemData);
        resolve(shareItem);
      })
      .catch((err) => {
        expect(err).toBeDefined();
        reject(err);
      });
  });
};
export const getTestShareItemId = (testShareItem) =>
  testShareItem._id.toString();

export const initializeTestShareItem =
  (baseUrl: string, token: string) =>
  async (
    testUserId: string,
    testPlaylistId?: string,
    testMediaItemId?: string
  ) => {
    const testShareItemData = {
      key: 'test-key',
      playlistId: testPlaylistId,
      mediaId: testMediaItemId,
      userId: testUserId,
      title: 'Test Media',
      description: 'Test media description',
      uri: 'https://www.example.com',
      visibility: 'public',
    };
    // Create a corresponding shareItem in the database
    let createShareItemFn;
    if (testMediaItemId) {
      createShareItemFn = createMediaShareItem({
        baseUrl,
        token,
      });
    } else if (testPlaylistId) {
      createShareItemFn = createPlaylistShareItem({
        baseUrl,
        token,
      });
    }

    let result;
    // eslint-disable-next-line no-useless-catch
    try {
      result = await createAndValidateTestShareItem(
        createShareItemFn,
        testShareItemData
      );
    } catch (err) {
      throw err;
    }

    return result;
  };
