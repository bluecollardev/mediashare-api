# Change log

Append-only running record of fixes, investigations, and decisions. Each entry has a short header (date · scope) and a body. Newest at top.

---

## 2026-05-11 · Subscriber content + AFehr seeder + open-bug triage

### Context

Web app login now works (after the patches and submodule bump committed earlier this session), but `GET /api/playlists` returns `[]` to authenticated users that are not the literal creator of content. The user's mental model — "master content user (AFehr) creates playlists; subscribers see them" — is _intended_ by the codebase but the wiring is broken in multiple places.

### Open issues to fix this round

| #   | Item                                                                                                                                                                             | Severity | Owner  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | Subscriber-content branch in `buildAggregateQuery` is unreachable from `GET /api/playlists` (controller always passes `userId`)                                                  | P0       | api    |
| 2   | `getBySub` (no-query path) doesn't union owner + subscriber-content either                                                                                                       | P0       | api    |
| 3   | Same wiring bug in `media-item.service.ts` and `playlist-item.service.ts` (their `buildAggregateQuery` has the subscriber branch too, also unreachable)                          | P0       | api    |
| 4   | AFehr (master content user) is not present in the `user` collection; his identity survives only as denormalized `author`/`authorProfile` snapshots on `playlist_item` rows       | P0       | api    |
| 5   | No actual seeder. `package.json` declares `seed:users` → `scripts/gen-users.script.ts` but the `scripts/` directory does not exist                                               | P0       | api    |
| 6   | `APP_SUBSCRIBER_CONTENT_USER_IDS` env var is unset; default `['default']` matches no user                                                                                        | P0       | api    |
| 7   | Legacy data shape: 1 playlist has `createdBy` as an `ObjectId` (should be Cognito-sub string); 2 media_items have `userId` as AFehr's `_id`-as-string (should be his sub)        | P1       | api    |
| 8   | Orphan refs: 7 of 565 `Playlist.mediaIds` values point at deleted `media_item._id`s; 7 of 557 `playlist_item.mediaId` values likewise                                            | P1       | api    |
| 9   | Schema drift: `playlist_item` docs carry `username`, `author`, `authorProfile`, `category` not declared on the TypeORM entity                                                    | P1       | api    |
| 10  | `UserConnection` entity has commented-out `ObjectIdColumn` decorators; the data stores both ends as plain strings                                                                | P1       | api    |
| 11  | Frontend release-channel selection is patched to detect localhost-web but the `TODO: Fix / implement releaseChannel` (use `Updates.releaseChannel`) is still pending             | P2       | source |
| 12  | `react-native-paper` `withTheme` ref warning is silenced via a console filter in `index.js`, not fixed at the source                                                             | P2       | app    |
| 13  | Expo SDK version mismatches in wrapper deps (vector-icons, expo-av, react-native, react-native-gesture-handler, react-native-safe-area-context) — warnings only, harmless on web | P3       | app    |

### Plan

**Phase 1 — Seeder (P0 items 4, 5, 6)**

1. Create `scripts/gen-users.script.ts` (matching the path already declared in `package.json`'s `seed:users`).
2. Idempotent — safe to run repeatedly. Upserts by `sub`.
3. Connects via `MONGO_URI` / `MONGO_DB` env (defaults `mongodb://localhost:27017` / `mediashare`).
4. Steps performed:
   - Upsert AFehr in `user` collection: `sub: 5d8b7b90-83fd-4d04-a59c-589ab6bf71f2`, `username: AFehr`, `email: Atfehr.pt@gmail.com`, `role: admin`, names from existing denormalized snapshots.
   - Re-attribute content to AFehr where the original author is him:
     - `playlist`: set `createdBy = AFehr.sub` for all playlists currently `createdBy = '117b5484-…'` (Lucas) where the dominant `playlist_item.author.sub` of that playlist is AFehr.
     - `playlist_item`: set `userId = createdBy = AFehr.sub` for all rows where `author.sub == AFehr.sub`.
     - `media_item`: set `userId = AFehr.sub` for the 2 rows currently storing `userId = '61907743a0c0e20021fa232f'` (his `_id` as string).
   - Log a summary of changed counts.
5. Document required env var: `APP_SUBSCRIBER_CONTENT_USER_IDS=5d8b7b90-83fd-4d04-a59c-589ab6bf71f2` (AFehr's sub). Add to `docker-compose.yml` service env for media-svc / user-svc / tags-svc.
6. Out-of-scope: Cognito user creation for AFehr. The mongo `sub` must match an existing Cognito user for in-app login to work as him. Documented as a separate manual step.

**Phase 2 — Data service union fix (P0 items 1, 2, 3)**

1. In `apps/media-svc/src/app/modules/playlist/playlist.service.ts:51` (`buildAggregateQuery`), change the `if (userId)` branch from `{ createdBy: userId }` to `{ $or: [ { createdBy: userId }, { createdBy: { $in: subscriberIds }, visibility: { $in: ['public', 'subscription'] } } ] }`.
2. Apply the same edit to `apps/media-svc/src/app/modules/media-item/media-item.service.ts` and `apps/media-svc/src/app/modules/playlist-item/playlist-item.service.ts`.
3. Change the controller's `findAll` (`playlist.controller.ts:155`) to always call `playlistService.search({ userId, query, tags })` — single code path, eliminates the `getBySub` no-query branch from this endpoint. Do the same in `media-item.controller.ts` and `playlist-item.controller.ts` for consistency.
4. Leave `getBySub` alone (it's still used elsewhere; can be revisited later).

**Phase 3 — Tests (lock down the fix)**

1. Re-run the existing data-integrity spec (`apps/media-svc-e2e/src/media-svc/data-integrity.spec.ts`) — must still pass.
2. Re-run the existing frontend selector spec (`mediashare-source/src/store/modules/__tests__/playlist.selectors.test.ts`) — must still pass.
3. Add a new spec that runs the updated pipeline directly against mongo and asserts: with `subscriberIds = [AFehr.sub]` and `userId = <some non-AFehr sub>`, the returned playlists include the AFehr-owned ones (visibility public|subscription) PLUS any owned by the userId.
4. Document the env vars needed to run all three.

**Phase 4 — Documentation**

1. Update `docs/ENTITIES.md` gotcha #5 to reference the new union behavior and the seeder.
2. Update this `CHANGES.md` execution log section below as each phase lands.

**Phase 5 — P1 data quality (deferred unless trivial)**

1. The 1 ObjectId-typed `createdBy` and the 2 ObjectId-as-string `userId`s can be normalized in the seeder run (it's a one-line update each).
2. Schema drift on `playlist_item` entity: extend the entity class to declare the wire fields (`username`, `author`, `authorProfile`, `category`). Not strictly required for runtime but improves type safety.

### Phases NOT in scope this round (P2/P3)

- (#11) Properly implement `Updates.releaseChannel` selection in `mediashare-source/src/config.ts`.
- (#12) Fix `react-native-paper` `withTheme` at source (upgrade or `forwardRef` patch).
- (#13) Bring Expo SDK deps in line with `expo install`'s expected versions.

### Execution log

**2026-05-11 11:21** — Probed `data/mediashare-backup.20230120-2323.tar.gz` and `data/mediashare-backup.20230125-1907.tar.gz`. Both contain the **original pre-migration state**:

- 12 users in `user` collection, including **AFehr** (`_id: 61907743a0c0e20021fa232f`, `sub: 5d8b7b90-83fd-4d04-a59c-589ab6bf71f2`, `email: Atfehr.pt@gmail.com`, `role: admin`), Lucas, and 10 subscribers.
- `playlist.createdBy` is the user's **Mongo `_id` as ObjectId**, not their Cognito sub: AFehr owns **269 playlists**, Lucas owns 10–11, brodnik3 (a subscriber) owns 1.
- `media_item.userId` is also the **Mongo `_id` as ObjectId**: AFehr owns **1201 media_items**, Lucas owns 15, plus 2 already-string entries.

The `20231220-0015.replace-userid-object-ids.tar.gz` migration was supposed to convert ObjectId → Cognito-sub string. It went wrong: AFehr's 269 playlists got reattributed to Lucas's sub (`117b5484-…`) instead of AFehr's sub (`5d8b7b90-…`), and AFehr was dropped from the `user` collection. The `with-demo-users` backup (used so far this session) reflects that broken state.

**Implication for the seeder:** we have a clear original-truth reference and a clear reattribution rule. The denormalized `playlist_item.author.sub` field (`5d8b7b90-…`) is preserved through the bad migration, so we can re-identify AFehr's content from any of the post-migration states.

Decisions confirmed:

- Seeder lives at `scripts/gen-users.script.ts` (matches existing `package.json` declaration `seed:users`).
- Cognito user creation in pool `us-west-2_NIibhhG4d` is in scope. Idempotent (lookup by email first; create only if missing).
- Idempotency end-to-end: rerunning the seeder against an already-correct DB is a no-op.

**2026-05-11 11:25** — Phase 1 complete. Seeder applied; data restored:

- AFehr inserted into `user` collection (sub `5d8b7b90-83fd-4d04-a59c-589ab6bf71f2`, role `admin`).
- 267 playlists reattributed Lucas → AFehr.
- 2340 playlist_items reattributed Lucas → AFehr (userId, createdBy, author.sub normalized to canonical sub).
- 552 media_items reattributed (2 via legacy ID, 550 transitively via AFehr playlist_items).
- Re-run produces 0 modifications (idempotent).

Cognito lookup failed locally because AWS credentials aren't configured in this shell (`Could not load credentials from any providers`). The seeder gracefully fell back to the snapshot sub. **Once AWS creds are available** (`aws configure` or `AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY` exported), re-run `yarn seed:users` and it will look up / create the real Cognito user; if Cognito returns a different sub than the snapshot, the seeder will re-normalize Mongo to that sub.

**2026-05-11 11:30** — Phase 2 complete. Data-service union fix applied to all three services:

- `playlist.service.ts:73-105` — `buildAggregateQuery` userId branch now `{ $or: [{ createdBy: userId }, { createdBy IN subscriberIds, visibility IN [public, subscription] }] }`.
- `playlist-item.service.ts` — same pattern applied.
- `media-item.service.ts` — same pattern applied.
- `playlist.controller.ts:findAll` and `media-item.controller.ts:findAll` — always go through `search()` (drop the `getBySub` no-query branch from authenticated lists; `getBySub` still exists, just no longer called from these endpoints).
- `playlist-item.controller.ts` was already calling `search({})` without userId — left untouched.

Added `APP_SUBSCRIBER_CONTENT_USER_IDS=5d8b7b90-83fd-4d04-a59c-589ab6bf71f2` to media-svc and user-svc env blocks in `docker-compose.yml`.

**Phase 3 — Tests.** All passing.

- 6/6 existing API data-integrity (unchanged).
- 7/7 existing frontend selector tests (unchanged).
- **NEW** 5/5 `subscriber-content.spec.ts`:
  - Lucas + subscriberIds=[AFehr] → 269 playlists (own 2 + AFehr's 267, no overlap).
  - Lucas + default subscriberIds → 2.
  - AFehr + subscriberIds=[AFehr] → 267 (overlap, no duplicates).
  - Stranger + subscriberIds=[AFehr] → 267.
  - Private visibility gate works (0 private AFehr playlists exist).

### Live-runtime verification — requires restart

The running media-svc process was started without `APP_SUBSCRIBER_CONTENT_USER_IDS` set in its env, so the bug fix in-process is dormant. To verify end-to-end:

```sh
# Stop the existing media-svc nx serve (Ctrl+C the npm run wrapper, or kill
# the nx serve media-svc process) and restart with the env var:
APP_SUBSCRIBER_CONTENT_USER_IDS=5d8b7b90-83fd-4d04-a59c-589ab6bf71f2 \
  PORT=3000 nx serve media-svc
```

Then reload the web app; `GET /api/playlists` should return 269 entries for Lucas and 267 for any other authenticated user.

### Still open after this round

- (#7) Legacy ObjectId-typed `createdBy` on 1 brodnik3 playlist. Seeder doesn't touch it (brodnik3 is a different user). Defer or migrate separately.
- (#9) Schema drift on `playlist_item` (denormalized `username`, `author`, `authorProfile`, `category` not in entity class). Defer — runtime works without it.
- (#10) `UserConnection` ObjectIdColumn vs string. Defer.
- (#11) Frontend release-channel selection — TODO in `mediashare-source/src/config.ts`. Defer.
- (#12) `react-native-paper` `withTheme` ref warning — silenced, not fixed at source. Defer.
- (#13) Expo SDK version drift. Defer.

### Cognito follow-up

To actually log in as AFehr in the web app, his Cognito user must exist in pool `us-west-2_NIibhhG4d`. Re-run `yarn seed:users` once AWS credentials are configured locally. The seeder will then call `ListUsers` + `AdminCreateUser` as needed.
