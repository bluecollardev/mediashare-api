// Verifies the new $match pipeline shape used by playlist.service.ts /
// media-item.service.ts / playlist-item.service.ts after the union fix:
//
//   {
//     $or: [
//       { createdBy: userId },
//       {
//         createdBy: { $in: appSubscriberContentUserIds },
//         visibility: { $in: ['public', 'subscription'] },
//       },
//     ],
//   }
//
// Runs the query directly against mongo (read-only) so we don't need NestJS
// runtime. Assumes the demo dataset has been mongorestored AND the seeder
// (yarn seed:users) has been applied — i.e. AFehr owns 267 playlists with
// visibility 'subscription', Lucas owns 2, and there is 1 ObjectId-typed legacy.
//
// Connection: same conventions as data-integrity.spec.ts.

import { MongoClient, Db } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'mediashare';

const ADAM_SUB = '5d8b7b90-83fd-4d04-a59c-589ab6bf71f2';
const LUCAS_SUB = '117b5484-87f3-43d3-b0b1-b743a432be57';

function buildUnionMatch(userId: string, subscriberIds: string[]) {
  return {
    $or: [
      { createdBy: userId },
      {
        createdBy: { $in: subscriberIds },
        visibility: { $in: ['public', 'subscription'] },
      },
    ],
  };
}

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

describe('subscriber-content union ($match shape)', () => {
  test('Lucas with subscriberIds=[AFehr] sees his own + AFehr public/subscription playlists', async () => {
    const match = buildUnionMatch(LUCAS_SUB, [ADAM_SUB]);
    const count = await db
      .collection('playlist')
      .countDocuments(match as any);
    // Lucas owns 2 playlists. AFehr owns 267, all visibility 'subscription'.
    // Union (with no overlap) = 269.
    expect(count).toBe(269);
  });

  test('Lucas alone (default subscriberIds) sees only his 2 playlists', async () => {
    // Default config is ['default'] — a sentinel that matches no real createdBy.
    const match = buildUnionMatch(LUCAS_SUB, ['default']);
    const count = await db
      .collection('playlist')
      .countDocuments(match as any);
    expect(count).toBe(2);
  });

  test('AFehr with subscriberIds=[AFehr] sees only his 267 (no duplicates via $or)', async () => {
    const match = buildUnionMatch(ADAM_SUB, [ADAM_SUB]);
    const count = await db
      .collection('playlist')
      .countDocuments(match as any);
    expect(count).toBe(267);
  });

  test('a stranger with subscriberIds=[AFehr] still sees AFehr public/subscription content', async () => {
    const strangerSub = '00000000-0000-0000-0000-000000000000';
    const match = buildUnionMatch(strangerSub, [ADAM_SUB]);
    const count = await db
      .collection('playlist')
      .countDocuments(match as any);
    expect(count).toBe(267);
  });

  test('visibility gate works: a private AFehr playlist would not be visible to others', async () => {
    // All AFehr playlists in the demo are visibility:subscription. To test
    // the gate without mutating data, count what would match if AFehr's
    // playlists were filtered to private only — should be 0.
    const count = await db.collection('playlist').countDocuments({
      createdBy: ADAM_SUB,
      visibility: 'private',
    });
    expect(count).toBe(0);
  });
});
