import { IdType } from '../types';

interface IObjectIdParameters {
  userId?: IdType;
  mediaId?: IdType;
  playlistId?: IdType;
  playlistItemId?: IdType;
  createdBy?: IdType;
}

export type ObjectIdParameters = Partial<IObjectIdParameters>;

interface IContentSearchParameters {
  query?: string;
  fullText?: boolean; // Search all text fields?
  textMatchingMode?: 'and' | 'or';
  tags?: string[];
  tagsMatchingMode?: 'any' | 'all';
  // When true, ignore the configured app-subscriber-content creators and
  // return only the requesting user's own content. Library / "My X"
  // endpoints pass true; the global Search endpoint leaves it unset.
  ownerOnly?: boolean;
}

export type ContentSearchParameters = Partial<IContentSearchParameters>;

export type SearchParameters = Partial<
  ObjectIdParameters & ContentSearchParameters
>;
