import React, { useState } from 'react';
import { FileText, Plus, Table, Trash2, X } from 'lucide-react';
import type {
  ArrowType,
  CanvasLayerName,
  EdgeRouting,
  GraphEdge,
  GraphNode,
  LineStyle,
  NodeShape,
  StickyNote,
  TableData,
} from '../types/linkdraw';
import { ALL_NODE_SHAPES } from '../lib/geometry';
import { IconEmojiTray, NodeIconBadge } from './IconEmojiTray';

const NODE_SWATCHES = [
  '#dbeafe',
  '#dcfce7',
  '#fef3c7',
  '#fee2e2',
  '#e0e7ff',
  '#fce7f3',
  '#f1f5f9',
  '#ffffff',
  '#1e293b',
];

const EDGE_SWATCHES = ['#475569', '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed'];
const STICKY_SWATCHES = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'];

interface NodeInspectorProps {
  node: GraphNode;
  onUpdate: (updated: GraphNode) => void;
  onDelete: (id: string) => void;
  onOpenLinkedNote: (node: GraphNode) => void;
  onClose: () => void;
}

export const NodeInspectorModal: React.FC<NodeInspectorProps> = ({
  node,
  onUpdate,
  onDelete,
  onOpenLinkedNote,
  onClose,
}) => {
  const [draft, setDraft] = useState<GraphNode>(() => ({
    ...node,
    tags: [...node.tags],
    metadata: { ...node.metadata },
    tableData: node.tableData
      ? {
          headers: [...node.tableData.headers],
          rows: node.tableData.rows.map((r) => [...r]),
        }
      : null,
  }));
  const [tagsInput, setTagsInput] = useState(node.tags.join(', '));
  const [newMetaKey, setNewMetaKey] = useState('');
  const [newMetaVal, setNewMetaVal] = useState('');
  const [showTableModal, setShowTableModal] = useState(false);

  const applyChanges = () => {
    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onUpdate({
      ...draft,
      tags: parsedTags,
      updatedAt: Date.now(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold">Node Inspector</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 text-sm">
          {/* Label & Text Styling */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Label
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, bold: !draft.bold })}
                  title="Bold"
                  className={`w-7 h-6 rounded border text-xs font-bold transition-colors ${
                    draft.bold
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, italic: !draft.italic })}
                  title="Italic"
                  className={`w-7 h-6 rounded border text-xs italic font-serif transition-colors ${
                    draft.italic
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  I
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, underline: !draft.underline })}
                  title="Underline"
                  className={`w-7 h-6 rounded border text-xs underline transition-colors ${
                    draft.underline
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  U
                </button>
                <select
                  value={draft.fs ?? 13}
                  onChange={(e) => setDraft({ ...draft, fs: Number(e.target.value) })}
                  title="Font Size"
                  className="h-6 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono"
                >
                  {[10, 12, 13, 14, 16, 18, 20, 24, 28, 32].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}px
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <textarea
              rows={2}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              style={{
                fontWeight: draft.bold ? 700 : 400,
                fontStyle: draft.italic ? 'italic' : 'normal',
                textDecoration: draft.underline ? 'underline' : 'none',
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Shape & Fill Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Shape
              </label>
              <select
                value={draft.shape}
                onChange={(e) => {
                  const nextShape = e.target.value as NodeShape;
                  let nextTable = draft.tableData;
                  if (nextShape === 'table' && !nextTable) {
                    nextTable = {
                      headers: ['Col 1', 'Col 2'],
                      rows: [
                        ['', ''],
                        ['', ''],
                      ],
                    };
                  }
                  setDraft({ ...draft, shape: nextShape, tableData: nextTable });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {ALL_NODE_SHAPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Shape Fill Style
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, filled: true })}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    draft.filled !== false
                      ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-slate-100'
                      : 'text-slate-500'
                  }`}
                >
                  Filled
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      filled: false,
                      borderColor: draft.borderColor || '#2563eb',
                      borderWidth: draft.borderWidth ?? 2.4,
                    })
                  }
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors ${
                    draft.filled === false
                      ? 'bg-white dark:bg-slate-900 shadow-xs text-blue-600 dark:text-blue-400'
                      : 'text-slate-500'
                  }`}
                >
                  Unfilled (Outline)
                </button>
              </div>
            </div>
          </div>

          {/* Colors & Border Styling */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Fill Color {draft.filled === false && <span className="opacity-60">(inactive when unfilled)</span>}
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {NODE_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, color: c, filled: true })}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-md border ${
                        draft.filled !== false && draft.color.toLowerCase() === c.toLowerCase()
                          ? 'ring-2 ring-blue-600 border-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#dbeafe'}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value, filled: true })}
                    title="Custom fill color"
                    className="w-6 h-6 p-0 border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer bg-transparent"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Border Color
                  </label>
                  {draft.borderColor && (
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, borderColor: undefined })}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Auto
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {EDGE_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDraft({ ...draft, borderColor: c })}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-md border ${
                        (draft.borderColor ?? '').toLowerCase() === c.toLowerCase()
                          ? 'ring-2 ring-blue-600 border-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={
                      draft.borderColor && /^#[0-9a-f]{6}$/i.test(draft.borderColor)
                        ? draft.borderColor
                        : '#334155'
                    }
                    onChange={(e) => setDraft({ ...draft, borderColor: e.target.value })}
                    title="Custom border color"
                    className="w-6 h-6 p-0 border border-slate-300 dark:border-slate-700 rounded-md cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Border Width</span>
                  <span className="font-mono tabular-nums">{(draft.borderWidth ?? 1.6).toFixed(1)}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={draft.borderWidth ?? 1.6}
                  onChange={(e) => setDraft({ ...draft, borderWidth: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Canvas Layer</label>
                <select
                  value={draft.layer}
                  onChange={(e) => setDraft({ ...draft, layer: e.target.value as CanvasLayerName })}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Background">Background</option>
                  <option value="Data">Data</option>
                  <option value="Annotations">Annotations</option>
                </select>
              </div>
            </div>
          </div>

          {/* Icon & Emoji Tray */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Icon / Emoji Tray
              </label>
              <div className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="text-[11px] text-slate-400">Selected:</span>
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
                  <NodeIconBadge
                    icon={draft.icon}
                    className="w-3.5 h-3.5"
                    fallback={<span className="text-[10px] text-slate-400">None</span>}
                  />
                </span>
              </div>
            </div>
            <IconEmojiTray
              value={draft.icon ?? ''}
              position={draft.iconPosition ?? 'inline'}
              onChangeIcon={(nextIcon) => setDraft({ ...draft, icon: nextIcon })}
              onChangePosition={(nextPos) => setDraft({ ...draft, iconPosition: nextPos })}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="backend, critical, phase-1"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>

          {/* Progress */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Progress Overlay</span>
              <input
                type="checkbox"
                checked={draft.progress !== null && draft.progress !== undefined}
                onChange={(e) =>
                  setDraft({ ...draft, progress: e.target.checked ? 50 : null })
                }
                className="w-4 h-4 accent-blue-600"
              />
            </div>
            {draft.progress !== null && draft.progress !== undefined && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={draft.progress}
                  onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })}
                  className="flex-1 accent-blue-600"
                />
                <span className="font-mono text-xs w-10 text-right tabular-nums">
                  {draft.progress}%
                </span>
              </div>
            )}
          </div>

          {/* Size Presets + Sliders */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Dimensions</span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'Compact', w: 116, h: 48 },
                  { label: 'Standard', w: 156, h: 60 },
                  { label: 'Large', w: 224, h: 90 },
                ].map((preset) => (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => setDraft({ ...draft, w: preset.w, h: preset.h })}
                    className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Width</span>
                  <span className="font-mono tabular-nums">{Math.round(draft.w)}px</span>
                </div>
                <input
                  type="range"
                  min={32}
                  max={800}
                  value={draft.w}
                  onChange={(e) => setDraft({ ...draft, w: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Height</span>
                  <span className="font-mono tabular-nums">{Math.round(draft.h)}px</span>
                </div>
                <input
                  type="range"
                  min={28}
                  max={600}
                  value={draft.h}
                  onChange={(e) => setDraft({ ...draft, h: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Switches: Fold Children & Lock Position */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <span className="text-xs font-medium">Fold Children</span>
              <input
                type="checkbox"
                checked={Boolean(draft.collapsed)}
                onChange={(e) => setDraft({ ...draft, collapsed: e.target.checked })}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <span className="text-xs font-medium">Lock Position</span>
              <input
                type="checkbox"
                checked={Boolean(draft.locked)}
                onChange={(e) => setDraft({ ...draft, locked: e.target.checked })}
                className="w-4 h-4 accent-blue-600"
              />
            </label>
          </div>

          {/* Embedded Data Table Editor Trigger */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!draft.tableData) {
                  setDraft({
                    ...draft,
                    shape: 'table',
                    w: Math.max(draft.w, 220),
                    h: Math.max(draft.h, 110),
                    tableData: {
                      headers: ['Col 1', 'Col 2'],
                      rows: [
                        ['', ''],
                        ['', ''],
                      ],
                    },
                  });
                }
                setShowTableModal(true);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Table className="w-4 h-4" />
              Edit Embedded Data Table
            </button>

            <button
              type="button"
              onClick={() => {
                onUpdate({ ...draft, tags: tagsInput.split(',').map((s) => s.trim()).filter(Boolean), updatedAt: Date.now() });
                onOpenLinkedNote(draft);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            >
              <FileText className="w-4 h-4" />
              Open Linked Document in Notes Studio
            </button>
          </div>

          {/* Metadata Key-Value Editor */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="block text-xs font-medium">Metadata Key-Value Pairs</span>
            <div className="space-y-1.5">
              {Object.entries(draft.metadata).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={k}
                    className="w-1/3 px-2 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                  />
                  <input
                    type="text"
                    value={v}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        metadata: { ...draft.metadata, [k]: e.target.value },
                      })
                    }
                    className="flex-1 px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...draft.metadata };
                      delete next[k];
                      setDraft({ ...draft, metadata: next });
                    }}
                    className="p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Key (e.g. ip)"
                value={newMetaKey}
                onChange={(e) => setNewMetaKey(e.target.value)}
                className="w-1/3 px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="text"
                placeholder="Value"
                value={newMetaVal}
                onChange={(e) => setNewMetaVal(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => {
                  const k = newMetaKey.trim();
                  if (!k) return;
                  setDraft({ ...draft, metadata: { ...draft.metadata, [k]: newMetaVal } });
                  setNewMetaKey('');
                  setNewMetaVal('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Node
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyChanges}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {showTableModal && draft.tableData && (
        <DataTableEditorModal
          initialData={draft.tableData}
          onSave={(nextTable) => {
            setDraft({ ...draft, shape: 'table', tableData: nextTable });
            setShowTableModal(false);
          }}
          onClose={() => setShowTableModal(false)}
        />
      )}
    </div>
  );
};

interface DataTableEditorProps {
  initialData: TableData;
  onSave: (data: TableData) => void;
  onClose: () => void;
}

export const DataTableEditorModal: React.FC<DataTableEditorProps> = ({
  initialData,
  onSave,
  onClose,
}) => {
  const [headers, setHeaders] = useState<string[]>([...initialData.headers]);
  const [rows, setRows] = useState<string[][]>(initialData.rows.map((r) => [...r]));

  const addColumn = () => {
    setHeaders([...headers, `Col ${headers.length + 1}`]);
    setRows(rows.map((r) => [...r, '']));
  };

  const removeColumn = (colIdx: number) => {
    if (headers.length <= 1) return;
    setHeaders(headers.filter((_, i) => i !== colIdx));
    setRows(rows.map((r) => r.filter((_, i) => i !== colIdx)));
  };

  const addRow = () => {
    setRows([...rows, headers.map(() => '')]);
  };

  const removeRow = (rowIdx: number) => {
    setRows(rows.filter((_, i) => i !== rowIdx));
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold">Embedded Data Table Editor</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" /> Add Row
            </button>
            <button
              type="button"
              onClick={addColumn}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" /> Add Column
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800">
                  {headers.map((h, ci) => (
                    <th key={ci} className="p-1.5 border-b border-r border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={h}
                          onChange={(e) => {
                            const next = [...headers];
                            next[ci] = e.target.value;
                            setHeaders(next);
                          }}
                          className="w-full px-1.5 py-1 font-semibold bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-700"
                        />
                        {headers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColumn(ci)}
                            className="text-slate-400 hover:text-red-500 p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="w-8 border-b border-slate-200 dark:border-slate-700" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-slate-100 dark:border-slate-800">
                    {headers.map((_, ci) => (
                      <td key={ci} className="p-1.5 border-r border-slate-100 dark:border-slate-800">
                        <input
                          type="text"
                          value={row[ci] ?? ''}
                          onChange={(e) => {
                            const next = rows.map((r) => [...r]);
                            next[ri][ci] = e.target.value;
                            setRows(next);
                          }}
                          className="w-full px-1.5 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
                        />
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(ri)}
                        className="text-slate-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ headers, rows })}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Save Table
          </button>
        </div>
      </div>
    </div>
  );
};

interface EdgeInspectorProps {
  edge: GraphEdge;
  onUpdate: (updated: GraphEdge) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const EdgeInspectorModal: React.FC<EdgeInspectorProps> = ({
  edge,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const [draft, setDraft] = useState<GraphEdge>({ ...edge });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold">Connection Inspector</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Label</label>
              <input
                type="text"
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="e.g. HTTPS REST"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Weight</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: Math.max(0.1, Number(e.target.value) || 1) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Routing Type</label>
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as EdgeRouting })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="straight">Straight</option>
                <option value="curved">Curved</option>
                <option value="elbow">Elbow</option>
                <option value="orthogonal">Orthogonal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Arrowheads</label>
              <select
                value={draft.arrow}
                onChange={(e) => setDraft({ ...draft, arrow: e.target.value as ArrowType })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="forward">Forward</option>
                <option value="backward">Backward</option>
                <option value="both">Both</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          {/* Curvature Control */}
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Curvature (Bend)
                </span>
                <span className="ml-2 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                  {draft.type === 'elbow' || draft.type === 'orthogonal'
                    ? draft.type
                    : draft.curvature === undefined || draft.curvature === null
                    ? 'Auto'
                    : `${draft.curvature > 0 ? '+' : ''}${Math.round(draft.curvature)} px`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const current =
                      draft.curvature !== undefined && draft.curvature !== null
                        ? draft.curvature
                        : 48;
                    setDraft({
                      ...draft,
                      type: 'curved',
                      curvature: current === 0 ? -48 : -current,
                    });
                  }}
                  className="px-2 py-0.5 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                >
                  Flip
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, type: 'curved', curvature: null })}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded border ${
                    draft.curvature === undefined || draft.curvature === null
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  Auto
                </button>
              </div>
            </div>

            <input
              type="range"
              min={-240}
              max={240}
              step={4}
              value={
                draft.curvature !== undefined && draft.curvature !== null
                  ? draft.curvature
                  : draft.type === 'straight'
                  ? 0
                  : 48
              }
              onChange={(e) =>
                setDraft({
                  ...draft,
                  type: 'curved',
                  curvature: Number(e.target.value),
                })
              }
              className="w-full accent-blue-600 cursor-pointer"
            />

            <div className="grid grid-cols-5 gap-1.5">
              {[-120, -48, 0, 48, 120].map((val) => {
                const isActive =
                  draft.type === 'curved' &&
                  draft.curvature !== undefined &&
                  draft.curvature !== null &&
                  Math.round(draft.curvature) === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDraft({ ...draft, type: 'curved', curvature: val })}
                    className={`py-1 rounded-md text-[11px] font-mono border transition-colors ${
                      isActive
                        ? 'border-blue-500 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {val === 0 ? 'Flat' : val > 0 ? `+${val}` : val}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Line Style</label>
              <select
                value={draft.lineStyle}
                onChange={(e) => setDraft({ ...draft, lineStyle: e.target.value as LineStyle })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {EDGE_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, color: c })}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-md ${
                      draft.color.toLowerCase() === c ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onDelete(edge.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Connection
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onUpdate({ ...draft, updatedAt: Date.now() });
                onClose();
              }}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StickyInspectorProps {
  sticky: StickyNote;
  onUpdate: (updated: StickyNote) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const StickyInspectorModal: React.FC<StickyInspectorProps> = ({
  sticky,
  onUpdate,
  onDelete,
  onClose,
}) => {
  const [draft, setDraft] = useState<StickyNote>({ ...sticky, tags: [...(sticky.tags ?? [])] });
  const [tagsInput, setTagsInput] = useState((sticky.tags ?? []).join(', '));

  const applyChanges = () => {
    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    onUpdate({ ...draft, tags: parsedTags, updatedAt: Date.now() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold">Sticky Note Inspector</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Content</label>
            <textarea
              rows={5}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="todo, lead, follow-up"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Paper Color</label>
            <div className="flex items-center gap-2">
              {STICKY_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
                  style={{ backgroundColor: c }}
                  className={`w-7 h-7 rounded-lg border ${
                    draft.color.toLowerCase() === c
                      ? 'ring-2 ring-blue-600 border-white'
                      : 'border-slate-300 dark:border-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              onDelete(sticky.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Sticky
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={applyChanges}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
