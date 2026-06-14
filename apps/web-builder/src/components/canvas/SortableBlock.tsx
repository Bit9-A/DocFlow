'use client';

import type { DocBlock } from '@docflow/core';
import { GripVertical, Lock } from 'lucide-react';
import { BlockRenderer } from './BlockRenderer';
import { BlockActions } from './BlockActions';
import { useDocumentStore } from '@/store/useDocumentStore';
import { PAGE_SIZES } from '@docflow/core/constants';
import { useRef, useState, useEffect } from 'react';

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), Math.max(min, max));

const SNAP_STEP = 10;         // px grid snap
const GUIDE_THRESHOLD = 5;    // px to magnetize
const GUIDE_OVERLAP_MIN = 30; // min px of perpendicular overlap to show guide

// ─── Alignment Guide ────────────────────────────────────
interface Guide {
  orientation: 'horizontal' | 'vertical';
  position: number;
  side: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y';
}

// ─── BlockRect for geometry math ────────────────────────
interface BlockRect {
  id: string;
  l: number; r: number; t: number; b: number;
  cx: number; cy: number;
}

const toRect = (b: DocBlock): BlockRect => {
  const l = b.x ?? 0;
  const r = l + (b.width ?? 100);
  const t = b.y ?? 0;
  const bot = t + (b.height ?? 30);
  return { id: b.id, l, r, t, b: bot, cx: (l + r) / 2, cy: (t + bot) / 2 };
};

// ─── Props ──────────────────────────────────────────────
interface Props {
  block: DocBlock;
  isSelected: boolean;
  onSelect: () => void;
  parentType?: 'header' | 'footer' | 'columns';
  isNested?: boolean;
}

// ─── Component ──────────────────────────────────────────
export function SortableBlock({ block, isSelected, onSelect, parentType, isNested = false }: Props) {
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const metadata = useDocumentStore((s) => s.metadata);
  const ast = useDocumentStore((s) => s.ast);
  const blockRef = useRef<HTMLDivElement>(null);

  // ── Paper geometry (recomputed on render) ─────────────
  const pt = PAGE_SIZES[metadata.pageSize] || PAGE_SIZES.LETTER;
  const paperW = metadata.orientation === 'landscape' ? pt[1] : pt[0];
  const paperH = metadata.orientation === 'landscape' ? pt[0] : pt[1];
  const mg = metadata.margins;
  const isHSub = parentType === 'header';
  const isFSub = parentType === 'footer';
  const noMarg = block.ignoreMargins ?? false;
  const locked = block.isLocked ?? false;

  const bW = block.width ?? 100;
  const bH = block.height ?? 30;
  const minX = noMarg ? 0 : mg.left;
  const maxX = paperW - (noMarg ? 0 : mg.right) - bW;
  const minY = (isHSub || isFSub) ? 0 : (noMarg ? 0 : mg.top);
  const maxY = isHSub
    ? mg.top - bH
    : isFSub
      ? mg.bottom - bH
      : paperH - (noMarg ? 0 : mg.bottom) - bH;

  // ── Visual state (renders only) ───────────────────────
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  // ── Mutable refs for values needed inside window listeners ──
  const posRef = useRef({ dx: 0, dy: 0 });
  const shiftRef = useRef(false);
  const movingRef = useRef<((e: PointerEvent) => void) | null>(null);
  const uppingRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);

  // ── Shift key detector ────────────────────────────────
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      if (e.key === 'Shift') { shiftRef.current = true; setIsSnapping(true); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift') { shiftRef.current = false; setIsSnapping(false); }
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (movingRef.current) window.removeEventListener('pointermove', movingRef.current);
    if (uppingRef.current) window.removeEventListener('pointerup', uppingRef.current);
  }, []);

  // ── Drag start ────────────────────────────────────────
  const handleDragStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    onSelect();
    if (locked || isNested) return;

    const ann = document.getElementById('canvas-announcer');
    if (ann) ann.textContent = `Picked up ${block.type} block`;

    const startX = e.clientX;
    const startY = e.clientY;
    const startBX = block.x ?? minX;
    const startBY = block.y ?? minY;

    posRef.current = { dx: 0, dy: 0 };
    shiftRef.current = e.shiftKey;
    setIsDragging(true);
    setIsSnapping(e.shiftKey);
    setDx(0);
    setDy(0);
    setGuides([]);

    // ── onMove (raf-throttled) ────────────────────────────
    const onMove = (me: PointerEvent) => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        const rawDx = me.clientX - startX;
        const rawDy = me.clientY - startY;
        let tx = clamp(startBX + rawDx, minX, maxX);
        let ty = clamp(startBY + rawDy, minY, maxY);

        // Snap to grid
        if (shiftRef.current) {
          tx = Math.round(tx / SNAP_STEP) * SNAP_STEP;
          ty = Math.round(ty / SNAP_STEP) * SNAP_STEP;
        }

        // Alignment guides
        const dragged: BlockRect = {
          id: block.id, l: tx, r: tx + bW, t: ty, b: ty + bH,
          cx: tx + bW / 2, cy: ty + bH / 2,
        };
        const others = ast
          .filter((b) => b.id !== block.id && b.type !== 'header' && b.type !== 'footer')
          .map(toRect);

        const found: Guide[] = [];
        const add = (cond: boolean, g: Guide) => { if (cond) found.push(g); };
        for (const o of others) {
          const vOverlap = Math.max(0, Math.min(dragged.b, o.b) - Math.max(dragged.t, o.t));
          const hOverlap = Math.max(0, Math.min(dragged.r, o.r) - Math.max(dragged.l, o.l));

          if (vOverlap > GUIDE_OVERLAP_MIN) {
            add(Math.abs(dragged.l - o.l) < GUIDE_THRESHOLD, { orientation: 'vertical', position: o.l, side: 'left' });
            add(Math.abs(dragged.l - o.r) < GUIDE_THRESHOLD, { orientation: 'vertical', position: o.r, side: 'left' });
            add(Math.abs(dragged.r - o.r) < GUIDE_THRESHOLD, { orientation: 'vertical', position: o.r, side: 'right' });
            add(Math.abs(dragged.r - o.l) < GUIDE_THRESHOLD, { orientation: 'vertical', position: o.l, side: 'right' });
            add(Math.abs(dragged.cx - o.cx) < GUIDE_THRESHOLD, { orientation: 'vertical', position: o.cx, side: 'center-x' });
          }
          if (hOverlap > GUIDE_OVERLAP_MIN) {
            add(Math.abs(dragged.t - o.t) < GUIDE_THRESHOLD, { orientation: 'horizontal', position: o.t, side: 'top' });
            add(Math.abs(dragged.t - o.b) < GUIDE_THRESHOLD, { orientation: 'horizontal', position: o.b, side: 'top' });
            add(Math.abs(dragged.b - o.b) < GUIDE_THRESHOLD, { orientation: 'horizontal', position: o.b, side: 'bottom' });
            add(Math.abs(dragged.b - o.t) < GUIDE_THRESHOLD, { orientation: 'horizontal', position: o.t, side: 'bottom' });
            add(Math.abs(dragged.cy - o.cy) < GUIDE_THRESHOLD, { orientation: 'horizontal', position: o.cy, side: 'center-y' });
          }
        }

        // Magnetic snap to guides
        for (const g of found) {
          if (g.orientation === 'vertical') {
            if (g.side === 'left') tx = g.position;
            else if (g.side === 'right') tx = g.position - bW;
            else if (g.side === 'center-x') tx = g.position - bW / 2;
          } else {
            if (g.side === 'top') ty = g.position;
            else if (g.side === 'bottom') ty = g.position - bH;
            else if (g.side === 'center-y') ty = g.position - bH / 2;
          }
        }
        tx = clamp(tx, minX, maxX);
        ty = clamp(ty, minY, maxY);

        const ndx = tx - startBX;
        const ndy = ty - startBY;
        posRef.current = { dx: ndx, dy: ndy };
        setDx(ndx);
        setDy(ndy);
        setGuides(found);
      });
    };

    // ── onUp ──────────────────────────────────────────────
    const onUp = () => {
      movingRef.current = null;
      uppingRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      const { dx: fdx, dy: fdy } = posRef.current;
      const fx = clamp(startBX + fdx, minX, maxX);
      const fy = clamp(startBY + fdy, minY, maxY);
      updateBlock(block.id, { x: fx, y: fy });

      const ann = document.getElementById('canvas-announcer');
      if (ann) ann.textContent = `Dropped ${block.type} block at ${Math.round(fx)}, ${Math.round(fy)}`;

      setIsDragging(false);
      setIsSnapping(false);
      setDx(0);
      setDy(0);
      setGuides([]);
    };

    movingRef.current = onMove;
    uppingRef.current = onUp;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Resize (improved hit target) ──────────────────────
  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (locked) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const sw = bW;
    const sh = bH;
    const bx = block.x ?? minX;
    const by = block.y ?? minY;
    const mw = paperW - (noMarg ? 0 : mg.right) - bx;
    const mh = paperH - (noMarg ? 0 : mg.bottom) - by;

    const onMove = (me: PointerEvent) => {
      const nw = clamp(sw + (me.clientX - startX), 30, mw);
      const nh = clamp(sh + (me.clientY - startY), 20, mh);
      updateBlock(block.id, { width: nw, height: nh });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ── Keyboard nudge ────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;

    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
    if (!isSelected || locked) return;

    const step = e.shiftKey ? 20 : 5;
    let ddx = 0, ddy = 0;
    if (e.key === 'ArrowLeft') ddx = -step;
    else if (e.key === 'ArrowRight') ddx = step;
    else if (e.key === 'ArrowUp') ddy = -step;
    else if (e.key === 'ArrowDown') ddy = step;
    if (ddx === 0 && ddy === 0) return;

    e.preventDefault();
    const cx = block.x ?? minX;
    const cy = block.y ?? minY;
    const nx = clamp(cx + ddx, minX, maxX);
    const ny = clamp(cy + ddy, minY, maxY);
    updateBlock(block.id, { x: nx, y: ny });

    const ann = document.getElementById('canvas-announcer');
    if (ann) ann.textContent = `Moved block to ${Math.round(nx)}, ${Math.round(ny)}`;
  };

  // ── Render ────────────────────────────────────────────
  const blockX = block.x ?? minX;
  const blockY = block.y ?? minY;

  return (
    <>
      {/* Alignment guide lines */}
      {isDragging && guides.length > 0 && !isNested && (
        <svg
          className="pointer-events-none absolute inset-0 z-[200]"
          style={{ left: 0, top: 0, width: paperW, height: paperH }}
          aria-hidden="true"
        >
          {guides.map((g, i) =>
            g.orientation === 'vertical' ? (
              <line key={i} x1={g.position} y1={0} x2={g.position} y2={paperH}
                stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" opacity={0.85} />
            ) : (
              <line key={i} x1={0} y1={g.position} x2={paperW} y2={g.position}
                stroke="#6366f1" strokeWidth={1} strokeDasharray="4 3" opacity={0.85} />
            ),
          )}
        </svg>
      )}

      {/* Block */}
      <div
        ref={blockRef}
        style={isNested ? {
          position: 'relative',
          width: '100%',
          minHeight: '28px',
        } : {
          position: 'absolute',
          left: blockX,
          top: blockY,
          width: bW,
          height: bH,
          transform: isDragging ? `translate(${dx}px, ${dy}px)` : undefined,
          zIndex: isDragging ? 100 : undefined,
        }}
        role="listitem"
        tabIndex={0}
        aria-label={`${block.type} block${isSelected ? ', selected' : ''}`}
        aria-selected={isSelected}
        className={`
          ${isNested ? 'relative' : 'absolute'} group outline-none rounded
          ${isSelected
            ? 'ring-2 ring-indigo-500 ring-offset-2'
            : 'hover:ring-1 hover:ring-indigo-300/40 hover:ring-offset-1 focus-visible:ring-1 focus-visible:ring-indigo-400 focus-visible:ring-offset-1'}
          ${isDragging
            ? 'opacity-90 shadow-2xl shadow-indigo-500/20 scale-[1.02] cursor-grabbing transition-none'
            : 'transition-shadow duration-100'}
          ${isSnapping ? 'snap-active' : ''}
        `}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onKeyDown={handleKeyDown}
      >
        {/* Drag handle */}
        {locked ? (
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 z-10 p-1 text-red-500/80 bg-red-500/5 rounded border border-red-500/10"
            title="Block is locked" aria-label="Block is locked">
            <Lock size={12} />
          </div>
        ) : isNested ? null : (
          <button
            onPointerDown={handleDragStart}
            className={`
              absolute -left-7 top-1/2 -translate-y-1/2 z-10 p-1 rounded
              cursor-grab active:cursor-grabbing transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
              ${isDragging
                ? 'opacity-100 bg-indigo-100 text-indigo-600 shadow-md'
                : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 hover:bg-gray-100'}
            `}
            aria-label={`Drag to position ${block.type} block`}
            tabIndex={0}
          >
            <GripVertical size={14} />
          </button>
        )}

        {/* Content */}
        <div className="w-full h-full overflow-hidden">
          <BlockRenderer block={block} isSelected={isSelected} />
        </div>

        {/* Resize handle — bigger, always visible on select */}
        {isSelected && !locked && !isNested && (
          <div
            onPointerDown={handleResizeStart}
            className={`
              absolute bottom-0 right-0 z-20 flex items-center justify-center
              w-6 h-6 cursor-se-resize
              bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
              border-2 border-white rounded-tl-lg shadow-md transition-all duration-100
              ${isDragging ? '!opacity-0' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}
            `}
            title="Drag to resize"
            aria-label="Resize block"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M1 9L9 1M4 9L9 4M7 9L9 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}

        {/* Actions toolbar */}
        {isSelected && (
          <BlockActions blockId={block.id} blockType={block.type} isLocked={locked} />
        )}
      </div>
    </>
  );
}
