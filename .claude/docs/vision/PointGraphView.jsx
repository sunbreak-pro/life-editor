import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Calendar, Folder, Lightbulb, FileText, Hash,
  RotateCcw, Maximize2, Settings2, Eye, EyeOff, X,
  Sparkles, Link2, Tag as TagIcon, Activity, Cpu,
  Search, Crosshair, Filter, ChevronDown, ChevronRight,
} from 'lucide-react';

/* ========================================================================
   Catppuccin Mocha palette
   ====================================================================== */
const C = {
  base: '#1e1e2e', mantle: '#181825', crust: '#11111b',
  surface0: '#313244', surface1: '#45475a', surface2: '#585b70',
  overlay0: '#6c7086', overlay1: '#7f849c', overlay2: '#9399b2',
  text: '#cdd6f4', subtext1: '#bac2de', subtext0: '#a6adc8',
  blue: '#89b4fa', lavender: '#b4befe', mauve: '#cba6f7',
  pink: '#f5c2e7', peach: '#fab387', yellow: '#f9e2af',
  green: '#a6e3a1', teal: '#94e2d5', sky: '#89dceb',
  sapphire: '#74c7ec', red: '#f38ba8', maroon: '#eba0ac',
};

/* Uniform node size; Project = black */
const UNIFORM_SIZE = 6.5;
const NODE_KIND = {
  daily:   { color: C.sky,      stroke: C.crust, ring: C.sapphire, halo: C.sky,      size: UNIFORM_SIZE, icon: Calendar,  label: 'Daily Note' },
  project: { color: '#000000',  stroke: C.text,  ring: C.pink,     halo: C.lavender, size: UNIFORM_SIZE, icon: Folder,    label: 'Project'    },
  idea:    { color: C.yellow,   stroke: C.crust, ring: C.peach,    halo: C.yellow,   size: UNIFORM_SIZE, icon: Lightbulb, label: 'Idea'       },
  note:    { color: C.lavender, stroke: C.crust, ring: C.blue,     halo: C.lavender, size: UNIFORM_SIZE, icon: FileText,  label: 'Note'       },
  tag:     { color: C.peach,    stroke: C.crust, ring: C.maroon,   halo: C.peach,    size: UNIFORM_SIZE, icon: Hash,      label: 'Tag'        },
};

const LINK_KIND = {
  wikilink: { color: '#7f849c', dash: null,  width: 1.0 },
  tag:      { color: C.peach,   dash: [2,3], width: 0.9 },
  temporal: { color: C.sapphire,dash: [3,2], width: 0.9 },
};

/* Label visibility threshold — labels hidden when k < this value */
const LABEL_ZOOM_THRESHOLD = 0.85;

/* ========================================================================
   Curated Vault
   ====================================================================== */
const DATA = (() => {
  const nodes = [
    { id: 'tag:architecture', type: 'tag', label: '#architecture' },
    { id: 'tag:frontend',     type: 'tag', label: '#frontend'     },
    { id: 'tag:backend',      type: 'tag', label: '#backend'      },
    { id: 'tag:ai',           type: 'tag', label: '#ai'           },
    { id: 'tag:design',       type: 'tag', label: '#design'       },
    { id: 'tag:research',     type: 'tag', label: '#research'     },
    { id: 'tag:wip',          type: 'tag', label: '#wip'          },
    { id: 'tag:phase-b',      type: 'tag', label: '#phase-b'      },

    { id: 'daily/2026-05-08', type: 'daily', label: '05-08', path: 'daily/2026-05-08.md' },
    { id: 'daily/2026-05-09', type: 'daily', label: '05-09', path: 'daily/2026-05-09.md' },
    { id: 'daily/2026-05-10', type: 'daily', label: '05-10', path: 'daily/2026-05-10.md' },
    { id: 'daily/2026-05-11', type: 'daily', label: '05-11', path: 'daily/2026-05-11.md' },
    { id: 'daily/2026-05-12', type: 'daily', label: '05-12', path: 'daily/2026-05-12.md' },
    { id: 'daily/2026-05-13', type: 'daily', label: '05-13', path: 'daily/2026-05-13.md' },
    { id: 'daily/2026-05-14', type: 'daily', label: '05-14', path: 'daily/2026-05-14.md' },

    { id: 'projects/life-editor',     type: 'project', label: 'life-editor',  path: 'projects/life-editor.md' },
    { id: 'projects/remote-mcp',      type: 'project', label: 'Remote MCP',   path: 'projects/remote-mcp.md' },
    { id: 'projects/cloudflare-sync', type: 'project', label: 'CF Sync',      path: 'projects/cloudflare-sync.md' },
    { id: 'projects/sonic-flow',      type: 'project', label: 'Sonic Flow',   path: 'projects/sonic-flow.md' },
    { id: 'projects/tauri-port',      type: 'project', label: 'Tauri Port',   path: 'projects/tauri-port.md' },
    { id: 'projects/android-port',    type: 'project', label: 'Android Port', path: 'projects/android-port.md' },

    { id: 'ideas/graph-view',          type: 'idea', label: 'Graph View',         path: 'ideas/graph-view.md' },
    { id: 'ideas/immutable-storage',   type: 'idea', label: 'Immutable Storage',  path: 'ideas/immutable-storage.md' },
    { id: 'ideas/dual-claude-md',      type: 'idea', label: 'Dual CLAUDE.md',     path: 'ideas/dual-claude-md.md' },
    { id: 'ideas/semantic-similarity', type: 'idea', label: 'AI 類似提案',         path: 'ideas/semantic-similarity.md' },
    { id: 'ideas/multi-agent',         type: 'idea', label: 'Multi-Agent',        path: 'ideas/multi-agent.md' },
    { id: 'ideas/edit-lock',           type: 'idea', label: 'Edit Lock',          path: 'ideas/edit-lock.md' },
    { id: 'ideas/lofi-player',         type: 'idea', label: 'Lo-Fi Player',       path: 'ideas/lofi-player.md' },
    { id: 'ideas/command-palette',     type: 'idea', label: 'Command Palette',    path: 'ideas/command-palette.md' },

    { id: 'notes/d3-force-research', type: 'note', label: 'd3-force 調査',     path: 'notes/d3-force-research.md' },
    { id: 'notes/tauri-vs-wails',    type: 'note', label: 'Tauri vs Wails',   path: 'notes/tauri-vs-wails.md' },
    { id: 'notes/catppuccin',        type: 'note', label: 'Catppuccin',       path: 'notes/catppuccin.md' },
    { id: 'notes/wikilink-syntax',   type: 'note', label: 'WikiLink Syntax',  path: 'notes/wikilink-syntax.md' },
    { id: 'notes/mcp-protocol',      type: 'note', label: 'MCP Protocol',     path: 'notes/mcp-protocol.md' },
    { id: 'notes/d1-vs-sqlite',      type: 'note', label: 'D1 vs SQLite',     path: 'notes/d1-vs-sqlite.md' },
    { id: 'notes/portable-pty',      type: 'note', label: 'portable-pty 検証', path: 'notes/portable-pty.md' },
    { id: 'notes/tiptap-codemirror', type: 'note', label: 'TipTap+CM6',       path: 'notes/tiptap-codemirror.md' },
    { id: 'notes/sync-conflict',     type: 'note', label: 'Sync Conflict',    path: 'notes/sync-conflict.md' },
    { id: 'notes/tmux-agents',       type: 'note', label: 'tmux Agents',      path: 'notes/tmux-agents.md' },

    { id: 'notes/orphan-archive', type: 'note', label: '古いメモ',     path: 'notes/orphan-archive.md' },
    { id: 'notes/orphan-scratch', type: 'note', label: 'スクラッチ',   path: 'notes/orphan-scratch.md' },
  ],
  links = [
    { source: 'daily/2026-05-08', target: 'daily/2026-05-09', kind: 'temporal' },
    { source: 'daily/2026-05-09', target: 'daily/2026-05-10', kind: 'temporal' },
    { source: 'daily/2026-05-10', target: 'daily/2026-05-11', kind: 'temporal' },
    { source: 'daily/2026-05-11', target: 'daily/2026-05-12', kind: 'temporal' },
    { source: 'daily/2026-05-12', target: 'daily/2026-05-13', kind: 'temporal' },
    { source: 'daily/2026-05-13', target: 'daily/2026-05-14', kind: 'temporal' },

    { source: 'daily/2026-05-08', target: 'projects/life-editor',     kind: 'wikilink' },
    { source: 'daily/2026-05-09', target: 'projects/remote-mcp',      kind: 'wikilink' },
    { source: 'daily/2026-05-10', target: 'projects/cloudflare-sync', kind: 'wikilink' },
    { source: 'daily/2026-05-11', target: 'ideas/multi-agent',         kind: 'wikilink' },
    { source: 'daily/2026-05-12', target: 'ideas/graph-view',          kind: 'wikilink' },
    { source: 'daily/2026-05-13', target: 'notes/d3-force-research',   kind: 'wikilink' },
    { source: 'daily/2026-05-14', target: 'ideas/graph-view',          kind: 'wikilink' },
    { source: 'daily/2026-05-14', target: 'notes/d3-force-research',   kind: 'wikilink' },

    { source: 'projects/life-editor', target: 'projects/remote-mcp',      kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'projects/cloudflare-sync', kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'projects/sonic-flow',      kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'projects/tauri-port',      kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'projects/android-port',    kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'ideas/graph-view',          kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'ideas/immutable-storage',   kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'ideas/dual-claude-md',      kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'ideas/edit-lock',           kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'ideas/command-palette',     kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'notes/catppuccin',          kind: 'wikilink' },
    { source: 'projects/life-editor', target: 'notes/tiptap-codemirror',   kind: 'wikilink' },

    { source: 'projects/remote-mcp',      target: 'ideas/semantic-similarity', kind: 'wikilink' },
    { source: 'projects/remote-mcp',      target: 'notes/mcp-protocol',         kind: 'wikilink' },
    { source: 'projects/cloudflare-sync', target: 'notes/d1-vs-sqlite',         kind: 'wikilink' },
    { source: 'projects/cloudflare-sync', target: 'notes/sync-conflict',        kind: 'wikilink' },
    { source: 'projects/sonic-flow',      target: 'projects/life-editor',       kind: 'wikilink' },
    { source: 'projects/sonic-flow',      target: 'ideas/lofi-player',          kind: 'wikilink' },
    { source: 'projects/tauri-port',      target: 'notes/tauri-vs-wails',       kind: 'wikilink' },
    { source: 'projects/tauri-port',      target: 'notes/portable-pty',         kind: 'wikilink' },
    { source: 'projects/android-port',    target: 'projects/tauri-port',        kind: 'wikilink' },

    { source: 'ideas/graph-view',         target: 'notes/d3-force-research', kind: 'wikilink' },
    { source: 'ideas/graph-view',         target: 'notes/wikilink-syntax',   kind: 'wikilink' },
    { source: 'ideas/semantic-similarity',target: 'notes/d3-force-research', kind: 'wikilink' },
    { source: 'ideas/multi-agent',        target: 'notes/tmux-agents',       kind: 'wikilink' },

    { source: 'projects/life-editor',      target: 'tag:architecture', kind: 'tag' },
    { source: 'projects/life-editor',      target: 'tag:phase-b',      kind: 'tag' },
    { source: 'projects/remote-mcp',       target: 'tag:backend',      kind: 'tag' },
    { source: 'projects/remote-mcp',       target: 'tag:ai',           kind: 'tag' },
    { source: 'projects/remote-mcp',       target: 'tag:wip',          kind: 'tag' },
    { source: 'projects/cloudflare-sync',  target: 'tag:backend',      kind: 'tag' },
    { source: 'projects/sonic-flow',       target: 'tag:frontend',     kind: 'tag' },
    { source: 'projects/tauri-port',       target: 'tag:architecture', kind: 'tag' },
    { source: 'projects/android-port',     target: 'tag:wip',          kind: 'tag' },
    { source: 'ideas/graph-view',          target: 'tag:frontend',     kind: 'tag' },
    { source: 'ideas/graph-view',          target: 'tag:design',       kind: 'tag' },
    { source: 'ideas/graph-view',          target: 'tag:wip',          kind: 'tag' },
    { source: 'ideas/immutable-storage',   target: 'tag:architecture', kind: 'tag' },
    { source: 'ideas/dual-claude-md',      target: 'tag:ai',           kind: 'tag' },
    { source: 'ideas/semantic-similarity', target: 'tag:ai',           kind: 'tag' },
    { source: 'ideas/multi-agent',         target: 'tag:ai',           kind: 'tag' },
    { source: 'ideas/edit-lock',           target: 'tag:architecture', kind: 'tag' },
    { source: 'ideas/lofi-player',         target: 'tag:frontend',     kind: 'tag' },
    { source: 'ideas/command-palette',     target: 'tag:design',       kind: 'tag' },
    { source: 'notes/d3-force-research',   target: 'tag:research',     kind: 'tag' },
    { source: 'notes/d3-force-research',   target: 'tag:frontend',     kind: 'tag' },
    { source: 'notes/tauri-vs-wails',      target: 'tag:research',     kind: 'tag' },
    { source: 'notes/tauri-vs-wails',      target: 'tag:architecture', kind: 'tag' },
    { source: 'notes/catppuccin',          target: 'tag:design',       kind: 'tag' },
    { source: 'notes/mcp-protocol',        target: 'tag:backend',      kind: 'tag' },
    { source: 'notes/mcp-protocol',        target: 'tag:ai',           kind: 'tag' },
    { source: 'notes/d1-vs-sqlite',        target: 'tag:backend',      kind: 'tag' },
    { source: 'notes/d1-vs-sqlite',        target: 'tag:research',     kind: 'tag' },
    { source: 'notes/portable-pty',        target: 'tag:research',     kind: 'tag' },
    { source: 'notes/wikilink-syntax',     target: 'tag:research',     kind: 'tag' },
    { source: 'notes/tiptap-codemirror',   target: 'tag:frontend',     kind: 'tag' },
    { source: 'notes/sync-conflict',       target: 'tag:backend',      kind: 'tag' },
    { source: 'notes/tmux-agents',         target: 'tag:ai',           kind: 'tag' },
  ];
  return { nodes, links };
})();

const ALL_TAGS = DATA.nodes.filter((n) => n.type === 'tag');

/* ========================================================================
   Helpers
   ====================================================================== */
function nhopNeighbors(rootId, depth, links) {
  if (depth <= 0) return new Set([rootId]);
  const visited = new Set([rootId]);
  let frontier = new Set([rootId]);
  for (let i = 0; i < depth; i++) {
    const next = new Set();
    links.forEach((l) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (frontier.has(s) && !visited.has(t)) { next.add(t); visited.add(t); }
      if (frontier.has(t) && !visited.has(s)) { next.add(s); visited.add(s); }
    });
    frontier = next;
    if (frontier.size === 0) break;
  }
  return visited;
}

/* ========================================================================
   UI primitives
   ====================================================================== */
function Slider({ label, value, onChange, min, max, step = 1, suffix = '' }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span style={{ color: C.subtext0 }}>{label}</span>
        <span className="mono" style={{ color: C.text }}>
          {step < 1 ? value.toFixed(2) : Math.round(value)}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${C.mauve} ${pct}%, ${C.surface1} ${pct}%)`,
          outline: 'none',
        }}
      />
    </div>
  );
}

function Toggle({ label, value, onChange, icon: Icon }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between px-2.5 py-2 rounded-md transition-colors"
      style={{
        background: value ? C.surface0 : 'transparent',
        border: `1px solid ${value ? C.surface1 : C.surface0}`,
      }}
    >
      <span className="flex items-center gap-2 text-[12px]" style={{ color: value ? C.text : C.subtext0 }}>
        {Icon && <Icon size={13} />}{label}
      </span>
      <div className="w-7 h-4 rounded-full relative transition-colors" style={{ background: value ? C.mauve : C.surface1 }}>
        <div
          className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
          style={{ background: C.text, left: value ? 'calc(100% - 14px)' : '2px' }}
        />
      </div>
    </button>
  );
}

function IconButton({ children, onClick, title, active }) {
  return (
    <button
      onClick={onClick} title={title}
      className="w-8 h-8 rounded-md flex items-center justify-center backdrop-blur transition-colors"
      style={{
        background: active ? `${C.surface1}cc` : `${C.mantle}cc`,
        border: `1px solid ${C.surface0}`,
        color: C.subtext1,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
      onMouseLeave={(e) => (e.currentTarget.style.color = C.subtext1)}
    >
      {children}
    </button>
  );
}

function Section({ title, icon: Icon, accent, children, defaultOpen = true, count }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-2">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between group">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={12} style={{ color: accent || C.mauve }} />}
          <h2 className="text-[10px] uppercase tracking-[0.18em] font-medium" style={{ color: C.subtext0 }}>
            {title}
          </h2>
          {count != null && (
            <span className="mono text-[9px] px-1 rounded" style={{ background: C.surface0, color: C.overlay1 }}>{count}</span>
          )}
        </div>
        {open ? <ChevronDown size={12} style={{ color: C.overlay0 }} /> : <ChevronRight size={12} style={{ color: C.overlay0 }} />}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </section>
  );
}

function LegendDot({ color, stroke }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 10, height: 10,
        background: color,
        border: `1px solid ${stroke || 'transparent'}`,
        boxSizing: 'border-box',
      }}
    />
  );
}

/* ========================================================================
   Main
   ====================================================================== */
export default function PointGraphView() {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const simRef = useRef(null);
  const transformRef = useRef(d3.zoomIdentity);
  const draggedRef = useRef(null);
  const hoveredRef = useRef(null);
  const quadtreeRef = useRef(null);
  const drawRef = useRef(null);
  const zoomRef = useRef(null);
  const isDraggingRef = useRef(false);
  const didMoveRef = useRef(false);

  /* Position cache — preserved across graph rebuilds */
  const positionCacheRef = useRef(new Map());
  /* Latest filtered graph available to centering callback */
  const graphRef = useRef({ nodes: [], links: [] });

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [alpha, setAlpha] = useState(0);
  const [fps, setFps] = useState(0);

  const [repel, setRepel] = useState(-280);
  const [linkDist, setLinkDist] = useState(50);
  const [centerStr, setCenterStr] = useState(0.05);
  const [collideStr, setCollideStr] = useState(1);

  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState({ daily: true, project: true, idea: true, note: true, tag: true });
  const [activeTags, setActiveTags] = useState(new Set());
  const [localDepth, setLocalDepth] = useState(0);
  const [showOrphans, setShowOrphans] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showPanel, setShowPanel] = useState(true);

  /* Stable: selectedId only affects graph when Local Graph is ON */
  const localFocusId = localDepth > 0 ? selectedId : null;

  /* ---- Filtered graph (does NOT depend on selectedId unless Local Graph ON) ---- */
  const graph = useMemo(() => {
    let nodes = DATA.nodes.filter((n) => activeTypes[n.type]);
    let ids = new Set(nodes.map((n) => n.id));

    if (activeTags.size > 0) {
      const tagged = new Set();
      DATA.links.forEach((l) => {
        if (l.kind !== 'tag') return;
        const tagId = l.source.startsWith('tag:') ? l.source : l.target.startsWith('tag:') ? l.target : null;
        const otherId = l.source.startsWith('tag:') ? l.target : l.source;
        if (tagId && activeTags.has(tagId)) {
          tagged.add(otherId);
          tagged.add(tagId);
        }
      });
      nodes = nodes.filter((n) => tagged.has(n.id) || activeTags.has(n.id));
      ids = new Set(nodes.map((n) => n.id));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matched = new Set(
        nodes.filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)).map((n) => n.id)
      );
      const expanded = new Set(matched);
      DATA.links.forEach((l) => {
        if (matched.has(l.source) && ids.has(l.target)) expanded.add(l.target);
        if (matched.has(l.target) && ids.has(l.source)) expanded.add(l.source);
      });
      nodes = nodes.filter((n) => expanded.has(n.id));
      ids = new Set(nodes.map((n) => n.id));
    }

    if (localFocusId && ids.has(localFocusId)) {
      const visited = nhopNeighbors(localFocusId, localDepth, DATA.links);
      nodes = nodes.filter((n) => visited.has(n.id));
      ids = new Set(nodes.map((n) => n.id));
    }

    let links = DATA.links.filter((l) => ids.has(l.source) && ids.has(l.target));

    if (!showOrphans) {
      const connected = new Set();
      links.forEach((l) => { connected.add(l.source); connected.add(l.target); });
      nodes = nodes.filter((n) => connected.has(n.id));
    }

    /* Restore cached positions so simulation continues from where it was */
    const cache = positionCacheRef.current;
    return {
      nodes: nodes.map((n) => {
        const cached = cache.get(n.id);
        return cached
          ? { ...n, x: cached.x, y: cached.y, vx: 0, vy: 0 }
          : { ...n };
      }),
      links: links.map((l) => ({ ...l })),
    };
  }, [activeTypes, activeTags, search, localFocusId, localDepth, showOrphans]);

  graphRef.current = graph;

  const searchMatchSet = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    return new Set(
      graph.nodes
        .filter((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q))
        .map((n) => n.id)
    );
  }, [search, graph]);

  const adjacency = useMemo(() => {
    const m = new Map();
    graph.nodes.forEach((n) => m.set(n.id, new Set([n.id])));
    graph.links.forEach((l) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      m.get(s)?.add(t);
      m.get(t)?.add(s);
    });
    return m;
  }, [graph]);

  const renderStateRef = useRef({});
  renderStateRef.current = { selectedId, showLabels, adjacency, graph, searchMatchSet };

  /* ---- Resize ---- */
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  /* ---- Recenter cached & live node positions when viewport changes.
     This prevents the cloud from drifting off-center when the side
     panel opens/closes or the window resizes. ---- */
  const prevSizeRef = useRef(null);
  useEffect(() => {
    if (size.w === 0 || size.h === 0) return;
    const prev = prevSizeRef.current;
    if (prev && (prev.w !== size.w || prev.h !== size.h)) {
      const dx = (size.w - prev.w) / 2;
      const dy = (size.h - prev.h) / 2;
      // Shift live nodes (currently in sim)
      graphRef.current.nodes.forEach((n) => {
        if (n.x != null) n.x += dx;
        if (n.y != null) n.y += dy;
        if (n.fx != null) n.fx += dx;
        if (n.fy != null) n.fy += dy;
      });
      // Shift cached positions so future filtered views also use the
      // new center as their basis.
      positionCacheRef.current.forEach((pos, id) => {
        positionCacheRef.current.set(id, { x: pos.x + dx, y: pos.y + dy });
      });
    }
    prevSizeRef.current = { w: size.w, h: size.h };
  }, [size.w, size.h]);

  /* ---- Canvas + simulation + interactions ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0) return;
    const ctx = canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let frameTimes = [];
    let lastFrame = performance.now();

    function draw() {
      const now = performance.now();
      frameTimes.push(now - lastFrame);
      lastFrame = now;
      if (frameTimes.length > 30) frameTimes.shift();

      const t = transformRef.current;
      const state = renderStateRef.current;
      const hoveredNode = hoveredRef.current;
      const hovId = hoveredNode?.id;
      const focusId = hovId || state.selectedId;
      const highlightSet = focusId ? state.adjacency.get(focusId) : null;
      const matchSet = state.searchMatchSet;

      ctx.clearRect(0, 0, size.w, size.h);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      // ---- Links ----
      const ls = state.graph.links;
      for (let i = 0; i < ls.length; i++) {
        const l = ls[i];
        const s = l.source, tgt = l.target;
        if (typeof s !== 'object' || typeof tgt !== 'object') continue;
        const style = LINK_KIND[l.kind];
        const accented = focusId && highlightSet?.has(s.id) && highlightSet?.has(tgt.id);
        const dimmed = focusId && !accented;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = accented ? C.mauve : style.color;
        ctx.lineWidth = (accented ? style.width * 2.2 : style.width) / t.k;
        ctx.globalAlpha = dimmed ? 0.04 : accented ? 0.85 : 0.28;
        if (style.dash) ctx.setLineDash([style.dash[0] / t.k, style.dash[1] / t.k]);
        ctx.stroke();
        if (style.dash) ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;

      // ---- Nodes ----
      const ns = state.graph.nodes;
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        const kind = NODE_KIND[n.type];
        if (!kind) continue;
        const isH = hovId === n.id;
        const isS = state.selectedId === n.id;
        const highlighted = focusId && highlightSet?.has(n.id);
        const dimmed = focusId && !highlighted;
        const isMatch = matchSet?.has(n.id);
        const scale = isH || isS ? 1.5 : highlighted || isMatch ? 1.15 : 1;
        const r = kind.size * scale;

        ctx.globalAlpha = dimmed ? 0.15 : 1;

        if (isMatch) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 10 / t.k, 0, Math.PI * 2);
          ctx.fillStyle = C.green;
          ctx.globalAlpha = 0.22;
          ctx.fill();
          ctx.globalAlpha = dimmed ? 0.15 : 1;
        }

        if (isH || isS) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 8 / t.k, 0, Math.PI * 2);
          ctx.fillStyle = kind.halo || kind.color;
          ctx.globalAlpha = 0.22;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = kind.color;
        ctx.fill();
        ctx.strokeStyle = isMatch ? C.green : (kind.stroke || C.crust);
        ctx.lineWidth = (isMatch ? 1.8 : 1.2) / t.k;
        ctx.stroke();

        if (isS) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 5 / t.k, 0, Math.PI * 2);
          ctx.strokeStyle = kind.ring;
          ctx.lineWidth = 1.2 / t.k;
          ctx.setLineDash([3 / t.k, 4 / t.k]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.globalAlpha = 1;

      // ---- Labels (zoom-gated) ----
      if (state.showLabels) {
        const k = t.k;
        const zoomedEnough = k >= LABEL_ZOOM_THRESHOLD;
        const fontSize = Math.max(10, 11 / k);
        ctx.font = `${fontSize}px Geist, ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i < ns.length; i++) {
          const n = ns[i];
          const kind = NODE_KIND[n.type];
          if (!kind) continue;
          const isH = hovId === n.id;
          const isS = state.selectedId === n.id;
          const highlighted = focusId && highlightSet?.has(n.id);
          const isMatch = matchSet?.has(n.id);

          /* Show only when: hovered/selected/match OR zoomed in enough.
             When focus exists, dimmed nodes hide labels regardless. */
          let visible;
          if (isH || isS || isMatch) visible = true;          // always show interactively important
          else if (focusId && !highlighted) visible = false;  // dimmed
          else visible = zoomedEnough;                         // depend on zoom
          if (!visible) continue;

          ctx.fillStyle = isH || isS ? C.text : isMatch ? C.green : highlighted ? C.subtext1 : C.subtext0;
          const r = kind.size * (isH || isS ? 1.5 : highlighted || isMatch ? 1.15 : 1);
          ctx.fillText(n.label, n.x, n.y + r + 3 / k);
        }
      }

      ctx.restore();

      if (frameTimes.length === 30 && Math.random() < 0.1) {
        const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
        setFps(Math.round(1000 / avg));
      }
    }
    drawRef.current = draw;

    /* Lower initial alpha if positions were restored from cache */
    const hasCachedPositions = graph.nodes.some((n) => n.x != null);

    const sim = d3
      .forceSimulation(graph.nodes)
      .force('link', d3.forceLink(graph.links).id((d) => d.id).distance((l) => (l.kind === 'tag' ? linkDist * 0.7 : linkDist)).strength(0.6))
      .force('charge', d3.forceManyBody().strength(repel).distanceMax(500))
      .force('center', d3.forceCenter(size.w / 2, size.h / 2).strength(centerStr))
      /* Per-node pull toward center on each axis. Unlike forceCenter
         (which moves the centroid), forceX/Y pull EACH node back, so
         the cloud stays compactly centered even when sim ages or the
         viewport changes. */
      .force('x', d3.forceX(size.w / 2).strength(0.06))
      .force('y', d3.forceY(size.h / 2).strength(0.06))
      .force('collide', d3.forceCollide().radius((d) => (NODE_KIND[d.type]?.size || UNIFORM_SIZE) + 4).strength(collideStr).iterations(1))
      .alpha(hasCachedPositions ? 0.15 : 1)
      .alphaDecay(0.03)
      .velocityDecay(0.45)
      .on('tick', () => {
        /* Cache positions so future rebuilds don't scatter */
        const cache = positionCacheRef.current;
        for (let i = 0; i < graph.nodes.length; i++) {
          const n = graph.nodes[i];
          if (n.x != null && n.y != null) {
            cache.set(n.id, { x: n.x, y: n.y });
          }
        }
        if (Math.random() < 0.5) {
          quadtreeRef.current = d3.quadtree().x((d) => d.x).y((d) => d.y).addAll(graph.nodes);
        }
        setAlpha(sim.alpha());
        draw();
      });

    quadtreeRef.current = d3.quadtree().x((d) => d.x).y((d) => d.y).addAll(graph.nodes);
    simRef.current = sim;

    function findNodeAt(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const cx = clientX - rect.left;
      const cy = clientY - rect.top;
      const t = transformRef.current;
      const x = (cx - t.x) / t.k;
      const y = (cy - t.y) / t.k;
      const radius = 36 / t.k;
      const found = quadtreeRef.current?.find(x, y, radius);
      if (!found) return null;
      const dx = found.x - x, dy = found.y - y;
      const r = (NODE_KIND[found.type]?.size || UNIFORM_SIZE) + 12 / t.k;
      return dx * dx + dy * dy < r * r ? found : null;
    }

    const zoom = d3
      .zoom()
      .scaleExtent([0.2, 6])
      .filter((event) => {
        if (event.type === 'mousedown' || event.type === 'touchstart' || event.type === 'pointerdown') {
          const x = event.clientX ?? event.touches?.[0]?.clientX;
          const y = event.clientY ?? event.touches?.[0]?.clientY;
          if (x != null && y != null && findNodeAt(x, y)) return false;
        }
        return !event.ctrlKey && !event.button;
      })
      .on('zoom', (event) => {
        transformRef.current = event.transform;
        draw();
      });
    d3.select(canvas).call(zoom);
    zoomRef.current = zoom;

    function updateDraggedPosition(clientX, clientY) {
      if (!draggedRef.current) return;
      const rect = canvas.getBoundingClientRect();
      const t = transformRef.current;
      draggedRef.current.fx = (clientX - rect.left - t.x) / t.k;
      draggedRef.current.fy = (clientY - rect.top - t.y) / t.k;
    }

    function onWindowPointerMove(e) {
      if (!isDraggingRef.current) return;
      if (!didMoveRef.current) didMoveRef.current = true;
      if (e.cancelable) e.preventDefault();
      updateDraggedPosition(e.clientX, e.clientY);
    }

    function onWindowPointerUp() {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (draggedRef.current) {
        sim.alphaTarget(0);
        draggedRef.current.fx = null;
        draggedRef.current.fy = null;
        draggedRef.current = null;
      }
      canvas.style.cursor = 'grab';
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    }

    function onCanvasPointerDown(e) {
      const node = findNodeAt(e.clientX, e.clientY);
      if (!node) return;
      e.preventDefault();
      isDraggingRef.current = true;
      didMoveRef.current = false;
      draggedRef.current = node;
      node.fx = node.x;
      node.fy = node.y;
      sim.alphaTarget(0.3).restart();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      canvas.style.cursor = 'grabbing';

      window.addEventListener('pointermove', onWindowPointerMove, { passive: false });
      window.addEventListener('pointerup', onWindowPointerUp);
      window.addEventListener('pointercancel', onWindowPointerUp);
    }

    function onCanvasHover(e) {
      if (isDraggingRef.current) return;
      const node = findNodeAt(e.clientX, e.clientY);
      if (node !== hoveredRef.current) {
        hoveredRef.current = node;
        setHoveredId(node?.id || null);
        canvas.style.cursor = node ? 'pointer' : 'grab';
        if (sim.alpha() < 0.01) draw();
      }
    }

    function onCanvasClick(e) {
      if (didMoveRef.current) {
        didMoveRef.current = false;
        return;
      }
      const node = findNodeAt(e.clientX, e.clientY);
      if (node) setSelectedId((cur) => (cur === node.id ? null : node.id));
      else setSelectedId(null);
    }

    canvas.addEventListener('pointermove', onCanvasHover);
    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    canvas.addEventListener('click', onCanvasClick);

    return () => {
      sim.stop();
      canvas.removeEventListener('pointermove', onCanvasHover);
      canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      canvas.removeEventListener('click', onCanvasClick);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, size.w, size.h]);

  /* ---- Live force tuning ---- */
  useEffect(() => {
    const s = simRef.current;
    if (!s) return;
    s.force('charge').strength(repel);
    s.force('link').distance((l) => (l.kind === 'tag' ? linkDist * 0.7 : linkDist));
    s.force('center').strength(centerStr);
    s.force('collide').strength(collideStr);
    s.alpha(0.3).restart();
  }, [repel, linkDist, centerStr, collideStr]);

  /* ---- Redraw when display state changes & sim settled ---- */
  useEffect(() => {
    if (drawRef.current && (simRef.current?.alpha() ?? 0) < 0.01) drawRef.current();
  }, [selectedId, showLabels, search]);

  /* ====================================================================
     Smooth pan: when selection changes, slide the view so the node
     lands at the geometric center of the canvas. Zoom is preserved.

     Three things had to be right to avoid drift to the right:

     1. ALWAYS interrupt the previous transition before starting a new
        one. Otherwise consecutive selections accumulate drift because
        d3-zoom's internal transform keeps moving.

     2. Read the CURRENT zoom transform via d3.zoomTransform(canvas).
        transformRef.current is just a render-side cache; during an
        in-flight transition it does not match what d3-zoom thinks the
        transform is.

     3. NO ad-hoc offsets. The selected card is semi-transparent and
        anchored to the screen, not the canvas, so true center is fine.
        If we add offsets they compound across calls.

     The math: to put a node at canvas pixel (cx, cy) we need
         cx = node.x * k + tx   →   tx = cx - node.x * k
         cy = node.y * k + ty   →   ty = cy - node.y * k
     where (tx, ty, k) is the new zoom transform.
     ==================================================================== */
  useEffect(() => {
    if (!selectedId) return;
    if (!canvasRef.current || !zoomRef.current) return;
    if (size.w === 0 || size.h === 0) return;

    const raf = requestAnimationFrame(() => {
      const node = graphRef.current.nodes.find((n) => n.id === selectedId);
      if (!node || node.x == null || node.y == null) return;

      const sel = d3.select(canvasRef.current);

      /* (1) Kill any in-flight transition so we don't compound */
      sel.interrupt();

      /* (2) Read the authoritative current transform */
      const t = d3.zoomTransform(canvasRef.current);
      const targetK = t.k;

      /* Pin the node so the sim can't move it mid-transition */
      const hadFx = node.fx, hadFy = node.fy;
      node.fx = node.x;
      node.fy = node.y;

      /* (3) True canvas-pixel center — no offsets */
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const tx = cx - node.x * targetK;
      const ty = cy - node.y * targetK;

      sel
        .transition()
        .duration(550)
        .ease(d3.easeCubicInOut)
        .call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(tx, ty).scale(targetK)
        )
        .on('end interrupt', () => {
          node.fx = hadFx;
          node.fy = hadFy;
        });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, size.w, size.h]);

  const reheat = useCallback(() => simRef.current?.alpha(1).restart(), []);
  const resetView = useCallback(() => {
    if (canvasRef.current && zoomRef.current) {
      d3.select(canvasRef.current)
        .transition().duration(400)
        .call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setActiveTypes({ daily: true, project: true, idea: true, note: true, tag: true });
    setActiveTags(new Set());
    setLocalDepth(0);
    setShowOrphans(true);
  }, []);

  const typeCounts = useMemo(() => {
    const c = {};
    graph.nodes.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, [graph]);

  const allTypeCounts = useMemo(() => {
    const c = {};
    DATA.nodes.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, []);

  const selectedNode = selectedId ? graph.nodes.find((n) => n.id === selectedId) : null;
  const selectedNeighbors = selectedId
    ? Array.from(adjacency.get(selectedId) || []).filter((id) => id !== selectedId)
    : [];

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (Object.values(activeTypes).every(Boolean) ? 0 : 1) +
    (activeTags.size > 0 ? 1 : 0) +
    (localDepth > 0 && selectedId ? 1 : 0) +
    (!showOrphans ? 1 : 0);

  return (
    <div
      className="w-full h-screen flex relative overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${C.base} 0%, ${C.mantle} 60%, ${C.crust} 100%)`,
        color: C.text,
        fontFamily: '"Geist", "Inter", ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        input[type=range]::-webkit-slider-thumb {
          appearance: none; width: 12px; height: 12px; border-radius: 50%;
          background: ${C.text}; cursor: pointer; border: 2px solid ${C.mauve};
          box-shadow: 0 0 0 0 ${C.mauve}40; transition: box-shadow .15s;
        }
        input[type=range]::-webkit-slider-thumb:hover { box-shadow: 0 0 0 4px ${C.mauve}40; }
        input[type=range]::-moz-range-thumb {
          width: 12px; height: 12px; border-radius: 50%;
          background: ${C.text}; cursor: pointer; border: 2px solid ${C.mauve};
        }
        .mono { font-family: 'JetBrains Mono', monospace; }
        input[type=text]:focus { border-color: ${C.mauve} !important; }
        canvas { touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div ref={wrapRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            cursor: 'grab',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
          }}
        />

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <div
            className="pointer-events-auto flex items-center gap-3 px-3.5 py-2 rounded-lg backdrop-blur"
            style={{ background: `${C.mantle}cc`, border: `1px solid ${C.surface0}` }}
          >
            <div className="w-2 h-2 rounded-full transition-colors" style={{ background: alpha > 0.01 ? C.green : C.overlay0, boxShadow: alpha > 0.01 ? `0 0 8px ${C.green}` : 'none' }} />
            <span className="text-[12px] tracking-wide" style={{ color: C.subtext1 }}>Point Graph</span>
            <span className="text-[11px] mono" style={{ color: C.overlay1 }}>
              {graph.nodes.length}/{DATA.nodes.length}n · {graph.links.length}e
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="text-[10px] mono px-1.5 py-0.5 rounded flex items-center gap-1 transition-colors"
                style={{ background: C.peach + '33', color: C.peach, border: `1px solid ${C.peach}40` }}
                title="Clear all filters"
              >
                <Filter size={9} />
                {activeFilterCount} <X size={9} />
              </button>
            )}
            <span className="text-[10px] mono" style={{ color: C.overlay0 }}>α {alpha.toFixed(3)}</span>
            <span className="text-[10px] mono" style={{ color: transformRef.current.k >= LABEL_ZOOM_THRESHOLD ? C.overlay1 : C.overlay0 }}>
              {(transformRef.current.k * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] mono flex items-center gap-1" style={{ color: fps >= 55 ? C.green : fps >= 30 ? C.yellow : C.red }}>
              <Cpu size={10} /> {fps} fps
            </span>
          </div>

          <div className="pointer-events-auto flex gap-1.5">
            <IconButton onClick={reheat} title="Reheat simulation"><RotateCcw size={14} /></IconButton>
            <IconButton onClick={resetView} title="Reset view"><Maximize2 size={14} /></IconButton>
            <IconButton onClick={() => setShowPanel(!showPanel)} title="Toggle panel" active={!showPanel}>
              {showPanel ? <X size={14} /> : <Settings2 size={14} />}
            </IconButton>
          </div>
        </div>

        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-2" style={{ color: C.overlay1 }}>
              <Filter size={32} className="mx-auto opacity-50" />
              <div className="text-[13px]">No nodes match the current filters</div>
              <button
                onClick={clearAllFilters}
                className="mt-2 px-3 py-1 rounded text-[11px] pointer-events-auto"
                style={{ background: C.surface0, border: `1px solid ${C.surface1}`, color: C.text }}
              >
                Clear filters
              </button>
            </div>
          </div>
        )}

        {selectedNode && (
          <div className="absolute bottom-4 left-4 w-80 rounded-lg backdrop-blur p-3.5 space-y-3" style={{ background: `${C.mantle}e6`, border: `1px solid ${C.surface0}` }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div
                  className="mt-0.5 w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  style={{
                    background: selectedNode.type === 'project'
                      ? '#000000'
                      : `${NODE_KIND[selectedNode.type].color}22`,
                    color: selectedNode.type === 'project'
                      ? C.text
                      : NODE_KIND[selectedNode.type].color,
                    border: selectedNode.type === 'project' ? `1px solid ${C.text}` : 'none',
                  }}
                >
                  {(() => { const I = NODE_KIND[selectedNode.type].icon; return <I size={14} />; })()}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: C.text }}>{selectedNode.label}</div>
                  <div className="text-[10px] mono truncate" style={{ color: C.overlay1 }}>{selectedNode.path || selectedNode.id}</div>
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} className="shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-white/5" style={{ color: C.overlay1 }}>
                <X size={12} />
              </button>
            </div>

            <div className="flex items-center gap-3 text-[10px]" style={{ color: C.subtext0 }}>
              <span>
                <Link2 size={10} className="inline mr-1" style={{ marginTop: -2 }} />
                {selectedNeighbors.filter((id) => !id.startsWith('tag:')).length} links
              </span>
              <span>
                <TagIcon size={10} className="inline mr-1" style={{ marginTop: -2 }} />
                {selectedNeighbors.filter((id) => id.startsWith('tag:')).length} tags
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] pt-1" style={{ borderTop: `1px solid ${C.surface0}` }}>
              <Crosshair size={10} style={{ color: C.lavender }} />
              <span style={{ color: C.subtext0 }}>Local graph:</span>
              {[0, 1, 2].map((d) => (
                <button
                  key={d}
                  onClick={() => setLocalDepth(d)}
                  className="px-1.5 py-0.5 rounded mono transition-colors"
                  style={{
                    background: localDepth === d ? C.lavender + '33' : 'transparent',
                    border: `1px solid ${localDepth === d ? C.lavender + '80' : C.surface1}`,
                    color: localDepth === d ? C.lavender : C.subtext0,
                  }}
                >
                  {d === 0 ? 'off' : `${d}-hop`}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: C.overlay0 }}>Connections</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                {selectedNeighbors.map((id) => {
                  const node = graph.nodes.find((n) => n.id === id) || DATA.nodes.find((n) => n.id === id);
                  if (!node) return null;
                  const k = NODE_KIND[node.type];
                  const I = k.icon;
                  const isProject = node.type === 'project';
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedId(id)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-left"
                    >
                      <I size={11} style={{ color: isProject ? C.text : k.color }} />
                      <span className="text-[11px] truncate" style={{ color: C.subtext1 }}>{node.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {!selectedNode && graph.nodes.length > 0 && (
          <div className="absolute bottom-4 left-4 px-3 py-2 rounded-md text-[10px] flex items-center gap-2 backdrop-blur" style={{ background: `${C.mantle}99`, border: `1px solid ${C.surface0}`, color: C.overlay1 }}>
            <Sparkles size={11} style={{ color: C.peach }} />
            Tap a node — view slides to center it. Drag freely. Pinch / scroll to zoom.
          </div>
        )}
      </div>

      {showPanel && (
        <aside className="w-80 shrink-0 flex flex-col gap-5 p-5 overflow-y-auto" style={{ background: `${C.mantle}d9`, borderLeft: `1px solid ${C.surface0}`, backdropFilter: 'blur(8px)' }}>
          <Section title="Search" icon={Search} accent={C.green} defaultOpen>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: C.overlay0 }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search nodes..."
                className="w-full pl-7 pr-7 py-1.5 rounded-md text-[12px] transition-colors"
                style={{ background: C.surface0, border: `1px solid ${C.surface1}`, color: C.text, outline: 'none' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded flex items-center justify-center hover:bg-white/5"
                  style={{ color: C.overlay1 }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {search && searchMatchSet && (
              <div className="text-[10px] mono px-1" style={{ color: searchMatchSet.size > 0 ? C.green : C.red }}>
                {searchMatchSet.size} match{searchMatchSet.size !== 1 ? 'es' : ''}
                {searchMatchSet.size > 0 && <span style={{ color: C.overlay0 }}> · neighbors shown</span>}
              </div>
            )}
          </Section>

          <Section title="Node Types" icon={Filter} accent={C.peach} defaultOpen>
            <div className="space-y-1">
              {Object.entries(NODE_KIND).map(([key, k]) => {
                const I = k.icon;
                const active = activeTypes[key];
                const visibleCount = typeCounts[key] || 0;
                const totalCount = allTypeCounts[key] || 0;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTypes((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors"
                    style={{
                      background: active ? C.surface0 + 'aa' : 'transparent',
                      border: `1px solid ${active ? C.surface1 : C.surface0}`,
                      opacity: active ? 1 : 0.45,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <LegendDot color={k.color} stroke={k.stroke === C.crust ? null : k.stroke} />
                      <I size={11} style={{ color: active ? (k.color === '#000000' ? C.text : k.color) : C.overlay1 }} />
                      <span className="text-[11px]" style={{ color: active ? C.text : C.subtext0 }}>{k.label}</span>
                    </span>
                    <span className="mono text-[10px]" style={{ color: C.overlay0 }}>
                      {visibleCount}/{totalCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Tags"
            icon={Hash}
            accent={C.peach}
            defaultOpen
            count={activeTags.size > 0 ? `${activeTags.size}/${ALL_TAGS.length}` : ALL_TAGS.length}
          >
            {activeTags.size > 0 && (
              <button
                onClick={() => setActiveTags(new Set())}
                className="text-[10px] underline"
                style={{ color: C.peach }}
              >
                clear selection
              </button>
            )}
            <div className="flex flex-wrap gap-1">
              {ALL_TAGS.map((t) => {
                const active = activeTags.has(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() =>
                      setActiveTags((prev) => {
                        const next = new Set(prev);
                        if (next.has(t.id)) next.delete(t.id);
                        else next.add(t.id);
                        return next;
                      })
                    }
                    className="px-1.5 py-0.5 rounded text-[10px] mono transition-colors"
                    style={{
                      background: active ? C.peach + '33' : C.surface0,
                      border: `1px solid ${active ? C.peach + '80' : C.surface1}`,
                      color: active ? C.peach : C.subtext0,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Local Graph" icon={Crosshair} accent={C.lavender}>
            {selectedId ? (
              <>
                <div className="text-[10px]" style={{ color: C.subtext0 }}>
                  From <span className="mono" style={{ color: C.lavender }}>{selectedNode?.label}</span>
                </div>
                <Slider label="Depth" value={localDepth} onChange={setLocalDepth} min={0} max={2} suffix={localDepth === 0 ? ' (off)' : '-hop'} />
              </>
            ) : (
              <div className="text-[10px] px-2 py-2 rounded" style={{ background: C.surface0 + '60', color: C.overlay1 }}>
                Select a node on the canvas to enable Local Graph mode
              </div>
            )}
          </Section>

          <Section title="Display" icon={Eye} accent={C.sky}>
            <Toggle label="Show orphans" value={showOrphans} onChange={setShowOrphans} icon={showOrphans ? Eye : EyeOff} />
            <Toggle label="Show labels" value={showLabels} onChange={setShowLabels} icon={FileText} />
          </Section>

          <Section title="Forces" icon={Activity} accent={C.mauve} defaultOpen={false}>
            <Slider label="Repel"         value={repel}      onChange={setRepel}      min={-600} max={-30}  />
            <Slider label="Link distance" value={linkDist}   onChange={setLinkDist}   min={10}   max={120}  suffix="px" />
            <Slider label="Center"        value={centerStr}  onChange={setCenterStr}  min={0}    max={0.3}  step={0.01} />
            <Slider label="Collide"       value={collideStr} onChange={setCollideStr} min={0}    max={2}    step={0.05} />
          </Section>

          <section className="mt-auto pt-3 text-[10px] mono leading-relaxed space-y-0.5" style={{ color: C.overlay0, borderTop: `1px solid ${C.surface0}` }}>
            <div>life-editor · Point View</div>
            <div>Canvas2D · d3-force · quadtree</div>
            <div>{DATA.nodes.length} nodes · {DATA.links.length} edges</div>
          </section>
        </aside>
      )}
    </div>
  );
}
