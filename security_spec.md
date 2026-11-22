# LinkDraw Security Specification

## 1. Data Invariants
1. A `CollabBoard` can only be created by an authenticated, email-verified user who sets `ownerId == request.auth.uid`, includes themselves in `memberUids` (max 20), and creates the matching `BoardInvite` atomically or prior to join.
2. `BoardInvite` documents are readable by single-document `get` using exact 6-character alphanumeric uppercase code; `list` is strictly forbidden to prevent invite scraping.
3. Access to `/collab_boards/{boardId}` subcollections (`elements`, `presence`, `comments`) requires `request.auth.uid` to be present in the parent board's `memberUids` array (`get()` Master Gate).
4. `BoardPresence` documents at `/presence/{memberUid}` can only be written by the user whose UID matches `{memberUid}` and `uid == request.auth.uid`.
5. `BoardComment` documents require `authorId == request.auth.uid` on creation; only the author or board owner can edit or delete them.
6. `PersonalBoard` and `StudioNote` documents under `/users/{userId}/...` are strictly private to `request.auth.uid == userId`.
7. All `createdAt` and `updatedAt` timestamps must equal `request.time`, and `createdAt` / `ownerId` / `authorId` are immutable after creation.

## 2. The "Dirty Dozen" Attack Payloads
1. **Shadow Field Injection on Board**: Creating a `collab_boards` document with an extra `isAdmin: true` ghost key. -> `PERMISSION_DENIED` (`hasOnly()`).
2. **Owner Spoofing**: Creating a `collab_boards` document with `ownerId: "victim_uid"`. -> `PERMISSION_DENIED` (`ownerId == request.auth.uid`).
3. **Oversized Member Array**: Updating `memberUids` to 25 UIDs (> 20 limit). -> `PERMISSION_DENIED` (`memberUids.size() <= 20`).
4. **Unverified Email Write**: Attempting any write with `email_verified: false`. -> `PERMISSION_DENIED`.
5. **Invite Scraping**: Running `list` query on `/board_invites`. -> `PERMISSION_DENIED` (`allow list: if false`).
6. **Non-Member Element Injection**: Writing to `/collab_boards/{boardId}/elements/{elId}` when caller UID is not in parent `memberUids`. -> `PERMISSION_DENIED`.
7. **Presence Impersonation**: Writing to `/collab_boards/{boardId}/presence/other_uid`. -> `PERMISSION_DENIED`.
8. **Comment Author Spoofing / Editing Another's Comment**: Updating a comment authored by another user when caller is not board owner. -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Creating an element with a 300-character ID or illegal characters (`../foo`). -> `PERMISSION_DENIED` (`isValidId()`).
10. **Timestamp Forgery**: Sending a backdated `createdAt` or `updatedAt` != `request.time`. -> `PERMISSION_DENIED`.
11. **Cross-Tenant Personal Board Read**: Reading `/users/other_uid/personal_boards/{boardId}`. -> `PERMISSION_DENIED`.
12. **Blanket Board List**: Listing `/collab_boards` without filtering where `request.auth.uid in resource.data.memberUids`. -> `PERMISSION_DENIED`.
