/**
 * Dirty Dozen Security Rules Test Specification for LinkDraw
 * Verifies all 12 adversarial vectors against firestore.rules expectations.
 */
export const DIRTY_DOZEN_VECTORS = [
  {
    id: 1,
    name: 'Shadow Field Injection on CollabBoard',
    path: '/collab_boards/board_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'hasOnly rejects ghost fields like isAdmin'
  },
  {
    id: 2,
    name: 'Owner Spoofing on CollabBoard',
    path: '/collab_boards/board_2',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'incoming().ownerId must equal request.auth.uid'
  },
  {
    id: 3,
    name: 'Oversized Member Array (>20)',
    path: '/collab_boards/board_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'memberUids.size() <= 20 enforced'
  },
  {
    id: 4,
    name: 'Unverified Email Write',
    path: '/collab_boards/board_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'request.auth.token.email_verified == true required'
  },
  {
    id: 5,
    name: 'Invite Code Scraping (list)',
    path: '/board_invites',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    reason: 'allow list: if false on /board_invites'
  },
  {
    id: 6,
    name: 'Non-Member Element Injection',
    path: '/collab_boards/board_1/elements/node_x',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Master Gate isBoardMember(boardId) blocks non-members'
  },
  {
    id: 7,
    name: 'Presence Impersonation',
    path: '/collab_boards/board_1/presence/other_uid',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'memberUid == request.auth.uid enforced'
  },
  {
    id: 8,
    name: 'Cross-Author Comment Edit',
    path: '/collab_boards/board_1/comments/comment_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'existing().authorId == request.auth.uid enforced'
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    path: '/collab_boards/board_1/elements/invalid..id',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'isValidId enforces ^[a-zA-Z0-9_\\-]+$ and <= 128 chars'
  },
  {
    id: 10,
    name: 'Timestamp Forgery',
    path: '/collab_boards/board_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'createdAt == request.time and updatedAt == request.time enforced'
  },
  {
    id: 11,
    name: 'Cross-Tenant Personal Board Read',
    path: '/users/victim_uid/personal_boards/pb_1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    reason: 'request.auth.uid == userId enforced'
  },
  {
    id: 12,
    name: 'Blanket Board List Without Membership',
    path: '/collab_boards',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    reason: 'allow list enforces request.auth.uid in existing().memberUids'
  }
];
