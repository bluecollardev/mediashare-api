import { getTestMediaItemId, initializeTestMediaItem } from './media-item';
import { initializeTestPlaylist } from './playlist';
import { getTestUserId, initializeTestUser } from './user';

// Initialize a user with a single playlist containing a single media item
export const initializePopulatedTestUser = async (
  baseUrl: string,
  userApiBaseUrl: string
) => {
  try {
    const [testUser, authResponse] = await initializeTestUser(
      baseUrl,
      userApiBaseUrl
    );
    const testUserId = getTestUserId(testUser);

    const testMediaItem = await initializeTestMediaItem(
      baseUrl,
      authResponse?.['IdToken']
    )(testUserId);
    const testMediaItemId = getTestMediaItemId(testMediaItem);

    const testPlaylist = await initializeTestPlaylist(
      baseUrl,
      authResponse?.['IdToken']
    )(testUserId, testMediaItemId);

    return {
      authResponse: authResponse as any,
      testUser,
      testUserId,
      mediaItem: testMediaItem,
      playlist: testPlaylist,
      authCtx: authResponse,
    };
  } catch (err) {
    throw err;
  }
};
