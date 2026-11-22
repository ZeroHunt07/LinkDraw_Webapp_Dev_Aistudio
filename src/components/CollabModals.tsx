import React, { useState } from 'react';
import { Copy, Crosshair, LogOut, MessageSquare, Send, Trash2, UserMinus, Users, X } from 'lucide-react';
import type { BoardComment, CollabPresence, GraphNode, WorkspaceBoard } from '../types/linkdraw';

interface CommentsDrawerProps {
  board: WorkspaceBoard;
  uid: string;
  comments: BoardComment[];
  selectedNode: GraphNode | null;
  onAddComment: (text: string, linkedNode: GraphNode | null) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onFocusNode: (nodeId: string) => void;
  onClose: () => void;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  board,
  uid,
  comments,
  selectedNode,
  onAddComment,
  onDeleteComment,
  onFocusNode,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [attachNode, setAttachNode] = useState(true);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await onAddComment(text.trim(), attachNode ? selectedNode : null);
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold">Board Comments</h2>
          <span className="text-xs text-slate-400 tabular-nums">({comments.length})</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-8">
            No comments yet. Select a node and post a note for collaborators.
          </p>
        ) : (
          comments.map((c) => {
            const canDelete = c.authorId === uid || board.ownerId === uid;
            return (
              <div
                key={c.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{c.authorName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => onDeleteComment(c.id)}
                        className="p-0.5 text-slate-400 hover:text-red-500"
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{c.text}</p>
                {c.linkedNodeId && (
                  <button
                    onClick={() => onFocusNode(c.linkedNodeId!)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline pt-0.5"
                  >
                    <Crosshair className="w-3 h-3" />
                    Focus: {c.linkedNodeLabel || c.linkedNodeId}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3.5 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
        {selectedNode && (
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={attachNode}
              onChange={(e) => setAttachNode(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            <span className="truncate">Link to node: {selectedNode.text}</span>
          </label>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

interface CollaboratorsModalProps {
  board: WorkspaceBoard;
  uid: string;
  presence: CollabPresence[];
  onRenameBoard: (title: string, description: string) => Promise<void>;
  onRemoveMember: (memberUid: string) => Promise<void>;
  onLeaveBoard: () => Promise<void>;
  onDeleteBoard: () => Promise<void>;
  onNotify: (msg: string) => void;
  onClose: () => void;
}

export const CollaboratorsModal: React.FC<CollaboratorsModalProps> = ({
  board,
  uid,
  presence,
  onRenameBoard,
  onRemoveMember,
  onLeaveBoard,
  onDeleteBoard,
  onNotify,
  onClose,
}) => {
  const isOwner = board.ownerId === uid;
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description);
  const [saving, setSaving] = useState(false);

  const memberUids = board.memberUids ?? [board.ownerId];
  const onlineSet = new Set(presence.map((p) => p.uid));

  const copyInvite = async (withLink: boolean) => {
    if (!board.inviteCode) return;
    const text = withLink
      ? `${window.location.origin}?join=${board.inviteCode}`
      : board.inviteCode;
    try {
      await navigator.clipboard.writeText(text);
      onNotify(withLink ? 'Invite link copied.' : `Invite code ${board.inviteCode} copied.`);
    } catch {
      onNotify(`Invite code: ${board.inviteCode}`);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || saving) return;
    setSaving(true);
    try {
      await onRenameBoard(title.trim() || board.title, description.trim());
      onNotify('Board details updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <h2 className="text-base font-semibold">Collaborators & Board Settings</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 text-sm">
          {board.inviteCode && (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-slate-500">Invite Code (Android & Web)</div>
                <div className="font-mono text-lg font-semibold tracking-widest mt-0.5">
                  {board.inviteCode}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyInvite(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" /> Code
                </button>
                <button
                  type="button"
                  onClick={() => copyInvite(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Copy Link
                </button>
              </div>
            </div>
          )}

          {isOwner && (
            <form onSubmit={handleRename} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Board Title</label>
                <input
                  type="text"
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
                <input
                  type="text"
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              >
                {saving ? 'Saving...' : 'Save Board Info'}
              </button>
            </form>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500">
              Members ({memberUids.length} / 20)
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {memberUids.map((mUid) => {
                const name = board.memberNames?.[mUid] || (mUid === board.ownerId ? board.ownerName : mUid);
                const isBoardOwner = mUid === board.ownerId;
                const isOnline = onlineSet.has(mUid);
                return (
                  <div key={mUid} className="flex items-center justify-between px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {name} {mUid === uid ? '(You)' : ''}
                      </div>
                      <div className="text-xs text-slate-500">
                        {isBoardOwner ? 'Owner' : 'Collaborator'} · {isOnline ? 'Active now' : 'Offline'}
                      </div>
                    </div>
                    {isOwner && !isBoardOwner && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(mUid)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                      >
                        <UserMinus className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          {isOwner ? (
            <button
              type="button"
              onClick={async () => {
                await onDeleteBoard();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Board
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await onLeaveBoard();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave Board
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
