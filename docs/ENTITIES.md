# API Entities & Relationships

This document describes the persisted entities across the `mediashare-api` microservices and how they relate. It is intended as a structural map — not an API reference — to help anyone tracing why a read/write does or doesn't return what they expect.

The same shape applies to `ppt_mediashare-platform` (the PocketPT fork), which is structurally identical.

---

## Foundation: abstract bases

Defined in `libs/core/src/lib/entities/`. Concrete entities extend these.

### `ApiBaseEntity`

| Field         | Type       | Notes                                                    |
| ------------- | ---------- | -------------------------------------------------------- |
| `_id`         | `ObjectId` | Mongo primary key                                        |
| `createdBy`   | `string`   | **AWS Cognito `sub` of the creator** (not a Mongo `_id`) |
| `createdAt`   | `Date`     | auto-managed                                             |
| `updatedDate` | `Date`     | auto-managed                                             |

### `KeyPair<T>` extends `ApiBaseEntity`

Generic key/value pair used as a base for `Tag` and `Stat`.

| Field   | Type     |
| ------- | -------- |
| `key`   | `string` |
| `value` | `T`      |

---

## Concrete entities

### `user-svc`

#### `User` — collection `user`

Identity and profile. The canonical link to AWS Cognito is `sub`, not `_id`. Subscription/billing fields hang directly off the user document.

| Field                                                                   | Type          | Notes                                                                  |
| ----------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| `sub`                                                                   | `string`      | **AWS Cognito subject ID** — used everywhere as the "owner" identifier |
| `username`, `email`, `firstName`, `lastName`, `phoneNumber`, `imageSrc` | `string`      | profile                                                                |
| `role`                                                                  | `BcRolesType` | enum (`BC_ROLES`)                                                      |
| `isDisabled`                                                            | `boolean`     | admin lockout flag                                                     |
| `transactionId`, `transactionDate`, `transactionEndDate`                | `string`      | subscription lifecycle                                                 |

#### `UserConnection` — collection `user_connection`

Directed edge from one user to another (follow / contact). Both ends are **strings**, not ObjectIds — they hold the Cognito `sub` of each user.

| Field          | Type     |
| -------------- | -------- |
| `userId`       | `string` |
| `connectionId` | `string` |

> **Note:** The entity has commented-out `ObjectIdColumn` decorators. The current schema stores both fields as plain strings. Don't assume a Mongo join works.

---

### `media-svc`

#### `MediaItem` — collection `media_item`

A single piece of media (video, audio, etc.) owned by a user.

| Field                                                | Type                  | Notes                                                    |
| ---------------------------------------------------- | --------------------- | -------------------------------------------------------- |
| `key`                                                | `string`              | S3 key                                                   |
| `userId`                                             | `string`              | **Cognito `sub` of owner** (text field, not an ObjectId) |
| `title`, `summary`, `description`, `uri`, `imageSrc` | `string`              | content metadata                                         |
| `isPlayable`                                         | `boolean`             |                                                          |
| `visibility`                                         | `MediaVisibilityType` | enum gating read access                                  |
| `tags`                                               | `TagKeyValue[]`       | **denormalized** — copies, not refs to `tags` collection |

#### `Playlist` — collection `playlist`

A user-curated, ordered collection of `MediaItem`s.

| Field                              | Type                     | Notes                                                      |
| ---------------------------------- | ------------------------ | ---------------------------------------------------------- |
| `cloneOf`                          | `ObjectId?`              | self-reference: original Playlist this one was cloned from |
| `title`, `description`, `imageSrc` | `string`                 |                                                            |
| `mediaIds`                         | `ObjectId[]`             | ordered list of `MediaItem._id`                            |
| `visibility`                       | `PlaylistVisibilityType` | enum gating read access                                    |
| `tags`                             | `TagKeyValue[]`          | **denormalized** copies                                    |

Inherits `createdBy: string` from `ApiBaseEntity` — the Cognito `sub` of the playlist owner.

#### `PlaylistItem` — collection `playlist_item`

A **per-playlist, user-modifiable override** of a `MediaItem`. The underlying media file (S3 asset) stays untouched in `media_item`; user-editable presentation fields (title, description, thumbnail, sort order, visibility) live on the corresponding `playlist_item` row, scoped to one specific playlist. When a playlist is cloned, fresh `playlist_item` rows are created under the cloning user, preserving the original media reference and original-author attribution.

| Field                                                              | Type                  | Notes                                                          |
| ------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------- |
| `playlistId`                                                       | `ObjectId`            | → `Playlist._id` (indexed)                                     |
| `mediaId`                                                          | `ObjectId`            | → `MediaItem._id` (indexed)                                    |
| `userId`                                                           | `string`              | **playlist owner's Cognito `sub`** (indexed) — re-set on clone |
| `sortIndex`                                                        | `number?`             | order within the playlist; absolute value used by the UI       |
| `title`, `summary`, `description`, `uri`, `imageSrc`, `isPlayable` |                       | seeded from MediaItem at add-time, then editable per-playlist  |
| `visibility`                                                       | `MediaVisibilityType` | initial value seeded from source media                         |
| `tags`                                                             | `TagKeyValue[]`       |                                                                |

##### Wire-only fields (in stored documents, not in the entity class)

The persisted `playlist_item` documents carry additional denormalized fields that the TypeORM entity does **not** declare:

| Field           | Shape                                                                                      | Purpose                                |
| --------------- | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| `username`      | `string`                                                                                   | original creator's username (snapshot) |
| `author`        | nested User doc (`_id`, `sub`, `email`, `username`, `role`, `imageSrc`, names, timestamps) | full original-creator snapshot         |
| `authorProfile` | `{ authorId, authorName, authorUsername, authorImage }`                                    | compact attribution used by the UI     |
| `category`      | `string` (e.g. `'paid'`)                                                                   | content category                       |

These survive clones — they pin the original creator's identity onto the cloned row even after `userId`/`createdBy` switch to the cloning user. That's how attribution is preserved when content is forked into another user's library.

> **Two parallel representations of a playlist's contents:**
>
> - `Playlist.mediaIds: ObjectId[]` — canonical ordered list of `MediaItem._id`s. **Always references `media_item._id` (never `playlist_item._id`)** — verified against both code (`playlist.service.ts:171-185`) and the demo data (565 distinct values; 558 found in `media_item._id`, 0 in `playlist_item._id`, 7 orphaned by deletion).
> - `playlist_item` documents — one row per item, joined by `playlistId == playlist._id`. Holds the per-playlist overrides.
>
> Both representations must stay in sync on writes. Divergence symptoms: empty-looking playlists, stale titles/uris, items missing after a clone, orphaned `playlist_item` rows after `media_item` deletion.

#### `ShareItem` — collection `share_item`

A share grant from one user to another, for either a playlist OR a single media item.

| Field        | Type        | Notes                                   |
| ------------ | ----------- | --------------------------------------- |
| `userSub`    | `string`    | **recipient's Cognito `sub`** (indexed) |
| `playlistId` | `ObjectId?` | set when sharing a playlist             |
| `mediaId`    | `ObjectId?` | set when sharing a single media item    |

Inherits `createdBy` from `ApiBaseEntity` = the **sharer's** Cognito `sub`.

> Exactly one of `playlistId` / `mediaId` is expected to be set per row (XOR-style), though the schema doesn't enforce it.

---

### Core / shared (`libs/core`)

#### `Tag` — collection `tags`

A catalog/taxonomy entry. **Not** a foreign-key target — `tags` arrays on Playlist/MediaItem/PlaylistItem are denormalized `TagKeyValue[]` snapshots, not references.

| Field           | Type         |
| --------------- | ------------ |
| `key`           | `string`     |
| `value`         | `string`     |
| `imageSrc`      | `string`     |
| `isMediaTag`    | `boolean`    |
| `isPlaylistTag` | `boolean`    |
| `parentIds`     | `ObjectId[]` |

Tags form a hierarchy via `parentIds` — used for taxonomy navigation, not for embedded tag references.

#### `Stat` — collection `stat`

`extends KeyPair<string>`. Generic key/value store for ad-hoc stats. No relations.

---

## Relationship overview

```
                  ┌──────────────────┐
                  │      User        │  identity (collection: user)
                  │    .sub (str)    │  ← canonical owner ID everywhere
                  └────────┬─────────┘
                           │ sub
       ┌───────────────────┼───────────────────────────┐
       │                   │                           │
       ▼                   ▼                           ▼
┌──────────────┐  ┌──────────────────┐         ┌──────────────────┐
│ MediaItem    │  │ Playlist         │         │ UserConnection   │
│ .userId(str) │  │ .createdBy(str)  │         │ .userId(str)     │
│              │  │ .mediaIds[]──────┼──┐      │ .connectionId(str)│
│              │  │ .cloneOf? ───────┼──┼─→ (self)              │
└──────┬───────┘  └─────────┬────────┘  │      └──────────────────┘
       │                    │           │
       │ mediaId            │ playlistId│ mediaIds[]
       │                    │           │
       │     ┌──────────────▼───────────▼──────────┐
       │     │ PlaylistItem (snapshot of media)    │
       │     │  .playlistId, .mediaId, .userId(str)│
       │     └─────────────────────────────────────┘
       │
       │  shared via
       ▼
┌─────────────────────────────────────────┐
│ ShareItem                                │
│  .userSub(str) = recipient               │
│  .createdBy(str) = sharer (from base)    │
│  .playlistId? XOR .mediaId?              │
└─────────────────────────────────────────┘

Tag (collection: tags)  — catalog only; never referenced via FK.
                          Tag data is *embedded* as TagKeyValue[] on
                          Playlist / MediaItem / PlaylistItem.
```

---

## Frontend rendering: how playlist contents are resolved

A loaded `Playlist` from the backend carries **two parallel arrays**: `mediaItems` (from `$lookup mediaIds → media_item`) and `playlistItems` (from reverse `$lookup _id → playlist_item.playlistId`). The frontend merges them client-side. See `mediashare-source/src/store/modules/playlist.ts:144-181`.

The merge rule:

1. **`mediaItems` is the spine.** The selector iterates `mediaItems` — one rendered row per item in `Playlist.mediaIds`.
2. **For each `mediaItem`, find the matching `playlistItem`** where `playlistItem.mediaId === mediaItem._id` (plain string equality; both serialize to strings on the wire).
3. **If a `playlistItem` is found, spread it first — its fields win** (`{ ...(pmi.playlistItem ?? pmi.mediaItem) }`). Otherwise the unmodified `mediaItem` is used.
4. **`_id` becomes `playlistItem._id` when present**, else `mediaItem._id`. Downstream actions (delete-from-playlist, navigate-to-detail) act on whichever row is authoritative for that item.
5. **Sort is by `playlistItem.sortIndex`** (using `Math.abs`, so negative values are tolerated). Items with `sortIndex == 0` or missing fall to the bottom.

### Consequences of this design

- **The source of truth for "what's in this playlist" is `Playlist.mediaIds`** (which feeds `mediaItems`), not the `playlist_item` collection. A `playlist_item` row whose underlying `media_item` was deleted has no spine entry to attach to and therefore **does not render** — it becomes silently invisible. (This matches the orphan count we measured in the demo data: 7 of 565 distinct `mediaIds` values point at deleted media.)
- **Conversely**, a `mediaItem` in the playlist with no `playlist_item` row still renders, using the canonical (un-overridden) media fields.
- **The join key (`mediaId === _id`) is string equality.** The generated rxjs client serializes ObjectIds as strings, which is why this works. If anything on the wire ever returns a wrapped ObjectId object instead, the override join silently fails and overrides disappear — a non-obvious debug target.
- **Sorting depends on `playlist_item` rows existing.** A playlist with no `playlist_item` rows at all has no `sortIndex` to sort by, so its render order falls back to whatever ordering Mongo's `$lookup` returned — and `$lookup` does **not** preserve `localField` order. Playlists that look "shuffled" are usually missing their `playlist_item` rows.

---

## Cross-cutting gotchas

1. **Cognito `sub` is the ownership key — not Mongo `_id`.**
   `User.createdBy`, `MediaItem.userId`, `Playlist.createdBy`, `PlaylistItem.userId`, `ShareItem.userSub`, and both sides of `UserConnection` all hold the Cognito `sub` **as a string**. To answer "what does user X own / share / receive?" you match `User.sub` against those string fields — not against `User._id`.

2. **`PlaylistItem` is a per-playlist override, not a duplicate.**
   The relationship is: `Playlist.mediaIds[]` references _immutable_ `media_item` docs (the actual S3 assets). For each item, an optional `playlist_item` row in the SAME playlist holds _user-editable_ overrides of presentation fields (title, description, sort order, etc.). The frontend merges them at render time, preferring the override (see "Frontend rendering" above). This lets a user clone a playlist and customize the titles/descriptions/thumbnails within their copy without touching the original media file.

3. **Tags are denormalized everywhere they're shown.**
   The `tags` collection itself is a catalog/typeahead source. Embedded `tags: TagKeyValue[]` arrays on Playlist / MediaItem / PlaylistItem are **copies** taken at write time — updating a `Tag` document does **not** propagate to existing playlists/items.

4. **`Playlist.cloneOf` records the original.**
   When a user clones another user's playlist, the new `Playlist` doc is intended to record the source `_id` in `cloneOf`, and a fresh set of `playlist_item` rows is created with `userId` set to the cloning user (with the original creator preserved on each row via the denormalized `author`/`authorProfile` blobs).

   **Caveat from the demo data:** in `data/mediashare-backup.20231230-153439.with-demo-users.tar.gz`, **0 of 270 playlists have `cloneOf` set**. Either the clone path didn't populate it at the time, or the backup pre-dates that field being used. Don't rely on `cloneOf` being present when reading historical data.

5. **The "master content user" pattern is a coded primitive — but the wiring is currently broken.**
   The model is: a configurable set of user IDs hold the "master" content (subscription/public playlists meant to be visible to every paid subscriber). Other users see that content alongside their own.

   **Configuration:** env var `APP_SUBSCRIBER_CONTENT_USER_IDS` (a list of Cognito subs), read from `apps/{media-svc,user-svc,tags-svc}/src/app/app.configuration.ts:48` into the config key `appSubscriberContentUserIds`. Default value is `['default']` (sentinel that matches no real user).

   **Two branches in `buildAggregateQuery`** (`apps/media-svc/src/app/modules/playlist/playlist.service.ts:51-134`):

   - When `userId` **is provided** → `$match: { createdBy: userId }` (owner-only).
   - When `userId` **is absent** → `$match: { $and: [ { $or: createdBy IN appSubscriberContentUserIds }, { visibility: { $in: ['public', 'subscription'] } } ] }` (subscriber-content path).

   **Wiring bug:** `GET /api/playlists` (`playlist.controller.ts:155-181`) always passes `userId` from `@CognitoUser('sub')`, so the data service always takes the owner branch. The subscriber-content branch is **unreachable from the authenticated list endpoint**. No `/feed`, `/discover`, or `/popular` route on the playlist controller invokes it either. As a result, even when `APP_SUBSCRIBER_CONTENT_USER_IDS` is set, paying subscribers cannot see the master content via this endpoint.

   **To make the intended behavior work**, the read path needs to union both branches when a user is authenticated, e.g. `$match: { $or: [ { createdBy: userId }, { createdBy: { $in: subscriberIds }, visibility: { $in: ['public', 'subscription'] } } ] }`. The same shape applies to `playlist-item.service.ts:88-…` and `media-item.service.ts` (both already include the subscriber-content branch in their `buildAggregateQuery`).

   **In the demo backup**, the master content is owned by `createdBy = '117b5484-87f3-43d3-b0b1-b743a432be57'` (Lucas) — 269 of 270 playlists, all with `visibility: 'subscription'`. The original-creator attribution on `playlist_item` rows is preserved as **Adam Fehr** (`sub: 5d8b7b90-83fd-4d04-a59c-589ab6bf71f2`) via the denormalized `author`/`authorProfile` blobs. AFehr is **not** in the `user` collection — only as snapshots inside playlist_items. So to test the subscriber-content path with this dataset, you'd set `APP_SUBSCRIBER_CONTENT_USER_IDS=117b5484-87f3-43d3-b0b1-b743a432be57` (Lucas's sub), not AFehr's.

6. **`ShareItem` is the bridge for "shared with me" reads.**
   To list content the current user has access to via sharing (rather than via ownership or subscriber-content), query `share_item` where `userSub == currentUser.sub`, then resolve each row's `playlistId` or `mediaId` against the appropriate collection. Visibility flags on the target may further gate the read — confirm against the service code.

7. **No real foreign-key constraints.**
   MongoDB via TypeORM enforces no referential integrity. Orphaned refs are real: in the demo data, 7 of 565 distinct `Playlist.mediaIds` values point at `media_item` documents that no longer exist. Defend against this on the read path (the frontend silently drops orphans because they have no spine entry).

---

## See also

- `apps/<service>/src/app/modules/<module>/entities/` — entity source of truth
- `libs/core/src/lib/entities/` — abstract bases
- `openapi/<service>.json` — generated OpenAPI spec, regenerated on every non-prod startup (see `main.ts`)
- `docs/MONGO.md` — backup / restore commands
