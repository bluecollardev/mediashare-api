// Seeder — restores the canonical state for the "master content user" (Adam Fehr / AFehr).
//
// What this fixes:
//   - The Dec-2023 `replace-userid-object-ids` migration reattributed AFehr's content
//     to Lucas's Cognito sub and dropped AFehr from the `user` collection.
//   - This script puts AFehr back as a user, re-points content to him, and (optionally)
//     ensures an AWS Cognito account for him exists in the configured user pool.
//
// Idempotent: rerunning against an already-correct DB is a no-op (every update has a
// match condition that excludes already-correct rows; the Cognito step does a lookup
// before any create).
//
// Env:
//   MONGO_URI                (default: mongodb://localhost:27017)
//   MONGO_DB                 (default: mediashare)
//   COGNITO_USER_POOL_ID     (default: us-west-2_NIibhhG4d)
//   AWS_REGION               (default: us-west-2)
//   Standard AWS creds via env / shared credentials / SSO.
//
// Flags:
//   --skip-cognito           Skip Cognito user lookup/create. Falls back to the
//                            snapshot sub already present in `playlist_item.author.sub`.
//   --dry-run                Connect and report what would change, but make no writes.
//
// Run:  yarn seed:users [--skip-cognito] [--dry-run]

import { MongoClient, Db, ObjectId } from 'mongodb';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const ADAM = {
  email: 'Atfehr.pt@gmail.com',
  username: 'AFehr',
  firstName: 'Adam',
  lastName: 'Fehr',
  legacyOid: '61907743a0c0e20021fa232f', // his Mongo _id from the original schema
  snapshotSub: '5d8b7b90-83fd-4d04-a59c-589ab6bf71f2', // his Cognito sub as seen in playlist_item.author.sub
};

const args = new Set(process.argv.slice(2));
const SKIP_COGNITO = args.has('--skip-cognito');
const DRY_RUN = args.has('--dry-run');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'mediashare';
const COGNITO_USER_POOL_ID =
  process.env.COGNITO_USER_POOL_ID || 'us-west-2_NIibhhG4d';
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

const log = (...a: any[]) => console.log('[seed:users]', ...a);

async function resolveAdamSub(): Promise<string> {
  if (SKIP_COGNITO) {
    log(
      `--skip-cognito set, using snapshot sub ${ADAM.snapshotSub} as canonical`
    );
    return ADAM.snapshotSub;
  }

  const cognito = new CognitoIdentityProviderClient({ region: AWS_REGION });

  try {
    const list = await cognito.send(
      new ListUsersCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Filter: `email = "${ADAM.email}"`,
        Limit: 1,
      })
    );
    if (list.Users && list.Users.length > 0) {
      const u = list.Users[0];
      const sub = u.Attributes?.find((a) => a.Name === 'sub')?.Value;
      if (sub) {
        log(`Cognito: existing user found for ${ADAM.email}, sub=${sub}`);
        return sub;
      }
    }
  } catch (err) {
    log(
      `Cognito lookup failed (${
        (err as Error).message
      }); falling back to snapshot sub.`
    );
    return ADAM.snapshotSub;
  }

  if (DRY_RUN) {
    log(
      `[dry-run] Cognito user not found; would AdminCreateUser. Using snapshot sub for planning.`
    );
    return ADAM.snapshotSub;
  }

  log(`Cognito: no user with email ${ADAM.email}; creating...`);
  try {
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: ADAM.email,
        UserAttributes: [
          { Name: 'email', Value: ADAM.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: ADAM.firstName },
          { Name: 'family_name', Value: ADAM.lastName },
        ],
        MessageAction: 'SUPPRESS', // don't email the user
      })
    );
    const sub = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    if (!sub) {
      throw new Error('AdminCreateUser returned no `sub` attribute');
    }
    log(`Cognito: created user, sub=${sub}`);
    return sub;
  } catch (err) {
    log(
      `Cognito create failed (${
        (err as Error).message
      }); falling back to snapshot sub.`
    );
    return ADAM.snapshotSub;
  }
}

async function reattribute(db: Db, adamSub: string) {
  const adamLegacyOid = new ObjectId(ADAM.legacyOid);
  let updates = {
    userUpsert: 0,
    playlistByLegacyOid: 0,
    playlistByAuthorAttribution: 0,
    playlistItemByAuthor: 0,
    mediaItemByLegacyId: 0,
    mediaItemByTransitive: 0,
  };

  // ---- 1. Upsert AFehr in `user` ----------------------------------------
  if (DRY_RUN) {
    const existing = await db.collection('user').findOne({ email: ADAM.email });
    log(
      `[dry-run] would upsert user ${
        ADAM.email
      }, sub=${adamSub} (existing=${!!existing})`
    );
  } else {
    const r = await db.collection('user').updateOne(
      { email: ADAM.email },
      {
        $set: {
          sub: adamSub,
          username: ADAM.username,
          email: ADAM.email,
          firstName: ADAM.firstName,
          lastName: ADAM.lastName,
          role: 'admin',
          updatedDate: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
    updates.userUpsert = (r.upsertedCount || 0) + (r.modifiedCount || 0);
    log(
      `user upsert: matched=${r.matchedCount}, modified=${
        r.modifiedCount
      }, inserted=${r.upsertedCount || 0}`
    );
  }

  // ---- 2. Playlists with legacy ObjectId createdBy → sub string ---------
  {
    const filter = { createdBy: adamLegacyOid as any };
    if (DRY_RUN) {
      const n = await db.collection('playlist').countDocuments(filter);
      log(
        `[dry-run] would update ${n} playlists with createdBy=ObjectId(${ADAM.legacyOid}) → "${adamSub}"`
      );
    } else {
      const r = await db
        .collection('playlist')
        .updateMany(filter, { $set: { createdBy: adamSub } });
      updates.playlistByLegacyOid = r.modifiedCount;
      log(`playlist (legacy ObjectId): modified=${r.modifiedCount}`);
    }
  }

  // ---- 3. Playlists whose playlist_items show AFehr authorship ----------
  // Find playlists currently NOT owned by adamSub but whose playlist_item
  // rows have author.sub = AFehr (snapshot or canonical).
  const adamAuthorSubs = Array.from(new Set([adamSub, ADAM.snapshotSub]));
  const playlistsToReattribute = await db
    .collection('playlist_item')
    .distinct('playlistId', { 'author.sub': { $in: adamAuthorSubs } });
  if (playlistsToReattribute.length > 0) {
    const filter = {
      _id: { $in: playlistsToReattribute },
      createdBy: { $ne: adamSub },
    };
    if (DRY_RUN) {
      const n = await db.collection('playlist').countDocuments(filter);
      log(
        `[dry-run] would reattribute ${n} playlists' createdBy → "${adamSub}" based on playlist_item.author.sub`
      );
    } else {
      const r = await db
        .collection('playlist')
        .updateMany(filter, { $set: { createdBy: adamSub } });
      updates.playlistByAuthorAttribution = r.modifiedCount;
      log(`playlist (by author attribution): modified=${r.modifiedCount}`);
    }
  } else {
    log(
      'playlist (by author attribution): no playlist_items with AFehr author.sub'
    );
  }

  // ---- 4. playlist_items: set userId/createdBy to adamSub; normalize author.sub
  {
    const filter = { 'author.sub': { $in: adamAuthorSubs } };
    if (DRY_RUN) {
      const total = await db.collection('playlist_item').countDocuments(filter);
      const needsUpdate = await db.collection('playlist_item').countDocuments({
        ...filter,
        $or: [
          { userId: { $ne: adamSub } },
          { createdBy: { $ne: adamSub } },
          { 'author.sub': { $ne: adamSub } },
        ],
      });
      log(
        `[dry-run] ${total} playlist_items authored by AFehr; ${needsUpdate} need userId/createdBy/author.sub update`
      );
    } else {
      const r = await db.collection('playlist_item').updateMany(filter, {
        $set: {
          createdBy: adamSub,
          'author.sub': adamSub,
        },
      });
      updates.playlistItemByAuthor = r.modifiedCount;
      log(`playlist_item (author=AFehr): modified=${r.modifiedCount}`);
    }
  }

  // ---- 5. media_items: identify AFehr's by legacy fields and set createdBy
  // Legacy data carries `userId` (either his _id-as-string or his snapshot sub).
  // The new schema uses `createdBy` only — set that. The legacy field gets
  // $unset in step 7.
  {
    const filter = {
      $or: [
        { userId: { $in: [ADAM.legacyOid, ADAM.snapshotSub] } },
        { createdBy: { $in: [ADAM.legacyOid, ADAM.snapshotSub] } },
      ],
      createdBy: { $ne: adamSub },
    };
    if (DRY_RUN) {
      const n = await db.collection('media_item').countDocuments(filter as any);
      log(
        `[dry-run] would update ${n} media_items with legacy AFehr id → createdBy "${adamSub}"`
      );
    } else {
      const r = await db
        .collection('media_item')
        .updateMany(filter as any, { $set: { createdBy: adamSub } });
      updates.mediaItemByLegacyId = r.modifiedCount;
      log(`media_item (legacy id): modified=${r.modifiedCount}`);
    }
  }

  // ---- 6. media_items: transitively (referenced by AFehr playlist_items)
  const adamMediaIds = await db
    .collection('playlist_item')
    .distinct('mediaId', { 'author.sub': { $in: adamAuthorSubs } });
  if (adamMediaIds.length > 0) {
    const filter = { _id: { $in: adamMediaIds }, createdBy: { $ne: adamSub } };
    if (DRY_RUN) {
      const n = await db.collection('media_item').countDocuments(filter);
      log(
        `[dry-run] would update ${n} media_items transitively (referenced by AFehr playlist_items)`
      );
    } else {
      const r = await db
        .collection('media_item')
        .updateMany(filter, { $set: { createdBy: adamSub } });
      updates.mediaItemByTransitive = r.modifiedCount;
      log(
        `media_item (transitive via playlist_item): modified=${r.modifiedCount}`
      );
    }
  }

  // ---- 7. Legacy schema cleanup: media_item & playlist_item ------------
  // The legacy schema duplicated ownership across `userId` and (the inherited)
  // `createdBy`. The new schema has only `createdBy`. Migrate any rows still
  // carrying `userId` by copying it to `createdBy` (when needed), then $unset
  // `userId` entirely.
  for (const coll of ['media_item', 'playlist_item'] as const) {
    const needsCreatedBy = {
      userId: { $exists: true, $type: 'string' as const },
      $expr: { $ne: ['$createdBy', '$userId'] },
    };
    if (DRY_RUN) {
      const n = await db.collection(coll).countDocuments(needsCreatedBy as any);
      log(`[dry-run] ${coll}: would copy userId → createdBy on ${n} rows`);
    } else {
      const r = await db
        .collection(coll)
        .updateMany(needsCreatedBy as any, [
          { $set: { createdBy: '$userId' } },
        ]);
      (updates as any)[`${coll}_createdBy_set`] = r.modifiedCount;
      log(`${coll}: createdBy set from userId on ${r.modifiedCount} rows`);
    }

    const hasLegacyUserId = { userId: { $exists: true } };
    if (DRY_RUN) {
      const n = await db.collection(coll).countDocuments(hasLegacyUserId);
      log(`[dry-run] ${coll}: would $unset userId on ${n} rows`);
    } else {
      const r = await db
        .collection(coll)
        .updateMany(hasLegacyUserId, { $unset: { userId: '' } });
      (updates as any)[`${coll}_userId_unset`] = r.modifiedCount;
      log(`${coll}: $unset userId on ${r.modifiedCount} rows`);
    }
  }

  // ---- 8. Restore tag imageSrc URLs from the pre-2023 backup ------------
  // The Dec-2023 migration also stripped `imageSrc` off every tag. The image
  // files still live in the S3 bucket; we just need to re-attach the URLs.
  // Map extracted from `data/mediashare-backup.20230125-1907.tar.gz`.
  const TAG_IMAGE_SRC_BASE =
    'https://mediashare0079445c24114369af875159b71aee1c04439-dev.s3.amazonaws.com/public/tags';
  const tagImageMap: Record<string, string> = {
    shoulder: `${TAG_IMAGE_SRC_BASE}/shoulder.jpg`,
    neck: `${TAG_IMAGE_SRC_BASE}/neck.jpg`,
    'upper-back': `${TAG_IMAGE_SRC_BASE}/upper-back.jpg`,
    'lower-back': `${TAG_IMAGE_SRC_BASE}/lower-back.jpg`,
    elbow: `${TAG_IMAGE_SRC_BASE}/elbow.jpg`,
    wrist: `${TAG_IMAGE_SRC_BASE}/wrist.jpg`,
    hand: `${TAG_IMAGE_SRC_BASE}/hand.jpg`,
    hip: `${TAG_IMAGE_SRC_BASE}/hip.jpg`,
    knee: `${TAG_IMAGE_SRC_BASE}/knee.jpg`,
    'foot-and-ankle': `${TAG_IMAGE_SRC_BASE}/foot-and-ankle.jpg`,
    pricing: `${TAG_IMAGE_SRC_BASE}/pricing.jpg`,
    mobility: `${TAG_IMAGE_SRC_BASE}/mobility.jpg`,
    strength: `${TAG_IMAGE_SRC_BASE}/strength.jpg`,
    stability: `${TAG_IMAGE_SRC_BASE}/stability.jpg`,
    power: `${TAG_IMAGE_SRC_BASE}/power.jpg`,
    'pain-relief': `${TAG_IMAGE_SRC_BASE}/pain-relief.jpg`,
    neurodynamics: `${TAG_IMAGE_SRC_BASE}/neurodynamics.jpg`,
    'self-assessments': `${TAG_IMAGE_SRC_BASE}/self-assessments.jpg`,
    'activity-and-postural-modifications': `${TAG_IMAGE_SRC_BASE}/modifications.jpg`,
    'weightlifting-technique': `${TAG_IMAGE_SRC_BASE}/technique.jpg`,
    'talking-videos': `${TAG_IMAGE_SRC_BASE}/talking-videos.jpg`,
    'rehab-programs': `${TAG_IMAGE_SRC_BASE}/rehab-programs.jpg`,
    'prehab-programs': `${TAG_IMAGE_SRC_BASE}/prehab-programs.jpg`,
    'mobility-progressions': `${TAG_IMAGE_SRC_BASE}/mobility.jpg`,
    'strength-progressions': `${TAG_IMAGE_SRC_BASE}/strength.jpg`,
    'stability-progressions': `${TAG_IMAGE_SRC_BASE}/stability.jpg`,
    'power-progressions': `${TAG_IMAGE_SRC_BASE}/power.jpg`,
    'misc-routines': `${TAG_IMAGE_SRC_BASE}/routines.jpg`,
  };

  let tagImageSet = 0;
  for (const [key, imageSrc] of Object.entries(tagImageMap)) {
    const filter = { key, $or: [{ imageSrc: { $exists: false } }, { imageSrc: null }, { imageSrc: '' }, { imageSrc: { $ne: imageSrc } }] };
    if (DRY_RUN) {
      const n = await db.collection('tags').countDocuments(filter as any);
      if (n > 0) log(`[dry-run] tags '${key}': would set imageSrc on ${n} doc(s)`);
    } else {
      const r = await db
        .collection('tags')
        .updateMany(filter as any, { $set: { imageSrc } });
      tagImageSet += r.modifiedCount;
    }
  }
  if (!DRY_RUN) {
    (updates as any).tagImageSrcRestored = tagImageSet;
    log(`tags: imageSrc restored on ${tagImageSet} rows`);
  }

  // ---- 9. Drop the dangling ObjectId-typed playlist ---------------------
  // One playlist has `createdBy: ObjectId(...)` left over from the pre-string
  // schema. The owner no longer exists in the user collection; the playlist
  // is invisible to the read path. Remove it.
  {
    const filter = {
      createdBy: { $type: 'objectId' as const },
    };
    if (DRY_RUN) {
      const n = await db.collection('playlist').countDocuments(filter as any);
      log(`[dry-run] would delete ${n} playlist(s) with ObjectId-typed createdBy`);
    } else {
      const r = await db.collection('playlist').deleteMany(filter as any);
      (updates as any).playlistObjectIdCreatedByDeleted = r.deletedCount;
      log(
        `playlist (ObjectId createdBy cleanup): deleted=${r.deletedCount}`
      );
    }
  }

  return updates;
}

async function main() {
  if (DRY_RUN) log('DRY RUN — no writes will be performed.');
  log(`mongo: ${MONGO_URI}/${MONGO_DB}`);
  log(`cognito pool: ${COGNITO_USER_POOL_ID} (region ${AWS_REGION})`);

  const adamSub = await resolveAdamSub();
  log(`canonical AFehr sub: ${adamSub}`);

  const client = await new MongoClient(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  }).connect();
  try {
    const db = client.db(MONGO_DB);
    const summary = await reattribute(db, adamSub);
    log('summary:', JSON.stringify(summary, null, 2));

    log(
      `\nNext step: set APP_SUBSCRIBER_CONTENT_USER_IDS=${adamSub} in media-svc / user-svc / tags-svc env so the subscriber-content branch picks up AFehr's content.`
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[seed:users] FATAL:', err);
  process.exit(1);
});
