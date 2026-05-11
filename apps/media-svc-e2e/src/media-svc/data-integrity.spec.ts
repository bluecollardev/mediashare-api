// Asserts the relationship invariants documented in `docs/ENTITIES.md` against
// a live mongo database. Read-only — no writes, no side effects.
//
// Connection:
//   MONGO_URI   (default: mongodb://localhost:27017)
//   MONGO_DB    (default: mediashare)
//
// Some invariants are STRICT (any violation fails). Others are TOLERANT —
// orphan refs are real in this schema (no FK constraints) and the application
// is expected to defend against them at the read path; we just report counts.

import { MongoClient, Db, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'mediashare';

let client: MongoClient;
let db: Db;

beforeAll(async () => {
  client = await new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 3000,
  }).connect();
  db = client.db(MONGO_DB);
});

afterAll(async () => {
  await client?.close();
});

describe('mediashare data integrity', () => {
  test('Playlist.mediaIds values never reference playlist_item._id (must be media_item._id)', async () => {
    const distinctMediaIds: ObjectId[] = await db
      .collection('playlist')
      .aggregate([
        { $unwind: '$mediaIds' },
        { $group: { _id: null, ids: { $addToSet: '$mediaIds' } } },
      ])
      .toArray()
      .then((r) => (r[0]?.ids as ObjectId[]) || []);

    const violations = await db
      .collection('playlist_item')
      .countDocuments({ _id: { $in: distinctMediaIds } });

    expect(violations).toBe(0);
  });

  test('every playlist_item.playlistId references an existing playlist (strict)', async () => {
    const playlistIds: ObjectId[] = await db
      .collection('playlist')
      .find({}, { projection: { _id: 1 } })
      .map((d) => d._id as ObjectId)
      .toArray();

    const orphans = await db
      .collection('playlist_item')
      .countDocuments({ playlistId: { $nin: playlistIds } });

    expect(orphans).toBe(0);
  });

  test('share_item rows have exactly one of playlistId / mediaId set (XOR)', async () => {
    const both = await db.collection('share_item').countDocuments({
      playlistId: { $exists: true, $ne: null },
      mediaId: { $exists: true, $ne: null },
    });
    const neither = await db.collection('share_item').countDocuments({
      $and: [
        { $or: [{ playlistId: { $exists: false } }, { playlistId: null }] },
        { $or: [{ mediaId: { $exists: false } }, { mediaId: null }] },
      ],
    });

    expect({ both, neither }).toEqual({ both: 0, neither: 0 });
  });

  test('Playlist.cloneOf, when set, references an existing playlist', async () => {
    const playlistIds: ObjectId[] = await db
      .collection('playlist')
      .find({}, { projection: { _id: 1 } })
      .map((d) => d._id as ObjectId)
      .toArray();

    const danglingClones = await db.collection('playlist').countDocuments({
      cloneOf: { $exists: true, $ne: null, $nin: playlistIds },
    });

    expect(danglingClones).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Tolerant checks: orphans are real (no FK constraints). Don't fail —
  // just surface counts so they're visible in CI output.
  // -----------------------------------------------------------------------

  test('orphan tolerance: report Playlist.mediaIds entries with no matching media_item', async () => {
    const distinctMediaIds: ObjectId[] = await db
      .collection('playlist')
      .aggregate([
        { $unwind: '$mediaIds' },
        { $group: { _id: null, ids: { $addToSet: '$mediaIds' } } },
      ])
      .toArray()
      .then((r) => (r[0]?.ids as ObjectId[]) || []);
    const present = await db
      .collection('media_item')
      .countDocuments({ _id: { $in: distinctMediaIds } });
    const orphans = distinctMediaIds.length - present;

    // eslint-disable-next-line no-console
    console.log(
      `[orphan-report] Playlist.mediaIds → media_item: ${present}/${distinctMediaIds.length} present, ${orphans} orphaned`
    );
    expect(typeof orphans).toBe('number'); // sentinel — never fails
  });

  test('orphan tolerance: report playlist_item.mediaId entries with no matching media_item', async () => {
    const distinctMediaRefs: ObjectId[] = await db
      .collection('playlist_item')
      .distinct('mediaId');
    const present = await db
      .collection('media_item')
      .countDocuments({ _id: { $in: distinctMediaRefs } });
    const orphans = distinctMediaRefs.length - present;

    // eslint-disable-next-line no-console
    console.log(
      `[orphan-report] playlist_item.mediaId → media_item: ${present}/${distinctMediaRefs.length} present, ${orphans} orphaned`
    );
    expect(typeof orphans).toBe('number');
  });
});
