import { clone } from 'remeda';

export const testAndCloneMediaItem = (mediaItem, expected) => {
  expect(mediaItem._id).toBeDefined();
  expect(mediaItem.createdAt).toBeDefined();
  expect(mediaItem.updatedDate).toBeDefined();
  return clone(mediaItem);
};

export const testAndCloneShareItem = (shareItem, expected) => {
  expect(shareItem._id).toBeDefined();
  expect(shareItem.createdAt).toBeDefined();
  expect(shareItem.updatedDate).toBeDefined();
  return clone(shareItem);
};

export const testAndClonePlaylistItem = (playlistItem, expected) => {
  expect(playlistItem._id).toBeDefined();
  expect(playlistItem.createdAt).toBeDefined();
  expect(playlistItem.updatedDate).toBeDefined();
  return clone(playlistItem);
};

export const testAndClonePlaylist = (playlist, expected) => {
  expect(playlist._id).toBeDefined();
  expect(playlist.createdAt).toBeDefined();
  expect(playlist.updatedDate).toBeDefined();
  return clone(playlist);
};

export const testAndCloneUser = (user, expected) => {
  expect(user._id).toBeDefined();
  expect(user.sub).toBeDefined();
  expect(user.username).toEqual(expected.username);
  expect(user.email).toEqual(expected.email);
  expect(user.firstName).toEqual(expected.firstName);
  expect(user.lastName).toEqual(expected.lastName);
  expect(user.createdAt).toBeDefined();
  expect(user.updatedDate).toBeDefined();
  return clone(user);
};
