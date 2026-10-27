"use client";

import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Crosshair,
  Maximize,
  Minimize,
  Minus,
  Plus,
  Scan,
  Users,
} from "lucide-react";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { TreeNode } from "./OrgTree";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;
const STEP = 1.2;
/** A pointer that moves less than this is a click, not a pan. */
const CLICK_SLOP = 4;
/** Three or more reports with nobody under them stack in a column instead of a long row. */
const STACK_FROM = 3;

const GRID_COLS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

export interface CanvasDrag<T> {
  canDrag: (node: T) => boolean;
  canDrop: (source: T, target: T) => boolean;
  onDrop: (source: T, target: T) => void;
}

interface View {
  x: number;
  y: number;
  k: number;
}

/**
 * The org chart as a canvas: cards joined by lines, panned by dragging the
 * background (or the wheel), zoomed with the controls, ctrl + wheel or a pinch.
 *
 * Only the top level opens by default; a card's report count opens its branch,
 * and "Expand all" opens everything. A search match opens the path to it and
 * the canvas moves to it.
 *
 * The view (pan and zoom) lives in a ref and is written straight to the
 * transform, so dragging the canvas does not re-render two thousand cards.
 */
export function OrgCanvas<T extends TreeNode>({
  roots,
  renderCard,
  countsOf,
  highlight,
  forceOpen,
  focusId,
  drag,
  looseLabel,
  label,
}: {
  roots: T[];
  renderCard: (node: T) => React.ReactNode;
  /** The numbers on the pill under a card; defaults to direct reports only. */
  countsOf?: (node: T) => { direct: number; total: number };
  highlight?: Set<string>;
  /** Ids whose branch must be open: the ancestors of a search match. */
  forceOpen?: Set<string>;
  /** Move the canvas to this card whenever it changes. */
  focusId?: string | null;
  /** Drag a card onto another one (HR changing a manager). */
  drag?: CanvasDrag<T>;
  /** Heading over the group of top-level cards that have nobody above or below them. */
  looseLabel: string;
  label: string;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 24, k: 1 });
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);

  const branches = useMemo(() => {
    const ids: string[] = [];
    const walk = (node: TreeNode) => {
      if (node.children.length) ids.push(node.id);
      node.children.forEach(walk);
    };
    roots.forEach(walk);
    return ids;
  }, [roots]);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.map((r) => r.id)));
  // A fresh tree (first load, a reload after a move keeps what was open).
  const seenRoots = useRef(roots);
  useEffect(() => {
    if (seenRoots.current === roots) return;
    seenRoots.current = roots;
    setExpanded((current) => (current.size ? current : new Set(roots.map((r) => r.id))));
  }, [roots]);

  const isOpen = useCallback(
    (id: string) => expanded.has(id) || Boolean(forceOpen?.has(id)),
    [expanded, forceOpen],
  );
  const allOpen = branches.length > 0 && branches.every((id) => isOpen(id));

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── View ────────────────────────────────────────────────────────────────
  const apply = useCallback(() => {
    const { x, y, k } = view.current;
    if (contentRef.current) contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    setZoom(Math.round(k * 100));
  }, []);

  const zoomAt = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const { x, y, k } = view.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
      const px = at?.x ?? viewport.clientWidth / 2;
      const py = at?.y ?? viewport.clientHeight / 2;
      view.current = { k: next, x: px - ((px - x) * next) / k, y: py - ((py - y) * next) / k };
      apply();
    },
    [apply],
  );

  /** Where a card sits in the chart, unscaled. */
  const cardBox = useCallback((id: string) => {
    const content = contentRef.current;
    const card = content?.querySelector<HTMLElement>(`[data-org-card="${CSS.escape(id)}"]`);
    if (!content || !card) return null;
    const outer = content.getBoundingClientRect();
    const inner = card.getBoundingClientRect();
    // The scale on screen now, which may not yet be the one in `view`.
    const k = outer.width / content.offsetWidth || 1;
    return {
      left: (inner.left - outer.left) / k,
      top: (inner.top - outer.top) / k,
      width: inner.width / k,
      height: inner.height / k,
    };
  }, []);

  const centreOn = useCallback(
    (id: string, placement: "top" | "middle" = "middle") => {
      const viewport = viewportRef.current;
      const box = cardBox(id);
      if (!viewport || !box) return;
      const { k } = view.current;
      const x = viewport.clientWidth / 2 - (box.left + box.width / 2) * k;
      const y =
        placement === "top"
          ? 32 - box.top * k
          : viewport.clientHeight / 2 - (box.top + box.height / 2) * k;
      view.current = { k, x, y };
      apply();
    },
    [apply, cardBox],
  );

  /** The first top-level card, centred at the top, at the given zoom. */
  const reset = useCallback(
    (k = 1) => {
      const viewport = viewportRef.current;
      const box = roots[0] ? cardBox(roots[0].id) : null;
      view.current =
        viewport && box
          ? { k, x: viewport.clientWidth / 2 - (box.left + box.width / 2) * k, y: 32 - box.top * k }
          : { x: 0, y: 24, k };
      apply();
    },
    [apply, cardBox, roots],
  );

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const cw = content.offsetWidth;
    const ch = content.offsetHeight;
    const k = Math.min(
      1,
      Math.max(MIN_ZOOM, Math.min((viewport.clientWidth - 48) / cw, (viewport.clientHeight - 48) / ch)),
    );
    view.current = {
      k,
      x: (viewport.clientWidth - cw * k) / 2,
      y: Math.max(24, (viewport.clientHeight - ch * k) / 2),
    };
    apply();
  }, [apply]);

  // Open on the top of the chart, once there is one.
  const placed = useRef(false);
  useLayoutEffect(() => {
    if (placed.current || roots.length === 0) return;
    placed.current = true;
    // Zoomed out just enough for the first level to fit across, but never below readable.
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const k = viewport && content ? Math.min(1, Math.max(0.8, (viewport.clientWidth - 32) / content.offsetWidth)) : 1;
    reset(k);
  }, [roots, reset]);

  // Follow a search to its first match once its branch has rendered open.
  useEffect(() => {
    if (!focusId) return;
    const frame = requestAnimationFrame(() => centreOn(focusId));
    return () => cancelAnimationFrame(frame);
  }, [focusId, centreOn, forceOpen]);

  // Wheel pans; ctrl/⌘ + wheel (and a trackpad pinch, which arrives as one) zooms.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = viewport.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * 0.0025), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else {
        view.current = { ...view.current, x: view.current.x - event.deltaX, y: view.current.y - event.deltaY };
        apply();
      }
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [apply, zoomAt]);

  // ── Panning and pinching ─────────────────────────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startX: number; startY: number; pinch: number | null }>({
    moved: false,
    startX: 0,
    startY: 0,
    pinch: null,
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    // Buttons keep their click; a card HR can drag belongs to drag-and-drop.
    if (target.closest("button")) return;
    if (event.pointerType === "mouse" && target.closest("[draggable='true']")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { moved: false, startX: event.clientX, startY: event.clientY, pinch: null };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    const now = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, now);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = viewportRef.current!.getBoundingClientRect();
      if (gesture.current.pinch) {
        zoomAt(distance / gesture.current.pinch, {
          x: (a.x + b.x) / 2 - rect.left,
          y: (a.y + b.y) / 2 - rect.top,
        });
      }
      gesture.current.pinch = distance;
      gesture.current.moved = true;
      return;
    }

    const g = gesture.current;
    if (!g.moved && Math.hypot(now.x - g.startX, now.y - g.startY) < CLICK_SLOP) return;
    if (!g.moved) {
      g.moved = true;
      viewportRef.current?.setPointerCapture(event.pointerId);
    }
    view.current = { ...view.current, x: view.current.x + now.x - last.x, y: view.current.y + now.y - last.y };
    apply();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
  };

  // A pan that ends over a card is not a click on its link.
  const onClickCapture = (event: React.MouseEvent) => {
    if (gesture.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      gesture.current.moved = false;
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const pan = (dx: number, dy: number) => {
      view.current = { ...view.current, x: view.current.x + dx, y: view.current.y + dy };
      apply();
    };
    const keys: Record<string, () => void> = {
      ArrowLeft: () => pan(80, 0),
      ArrowRight: () => pan(-80, 0),
      ArrowUp: () => pan(0, 80),
      ArrowDown: () => pan(0, -80),
      "+": () => zoomAt(STEP),
      "=": () => zoomAt(STEP),
      "-": () => zoomAt(1 / STEP),
      "0": () => reset(),
      f: fit,
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  // ── Fullscreen ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shellRef.current?.requestFullscreen?.();
  };

  // ── Drag and drop ────────────────────────────────────────────────────────
  const byId = useMemo(() => {
    const map = new Map<string, T>();
    const walk = (node: T) => {
      map.set(node.id, node);
      (node.children as T[]).forEach(walk);
    };
    roots.forEach(walk);
    return map;
  }, [roots]);
  const dragging = useRef<T | null>(null);

  const dragProps = (node: T): React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean } => {
    if (!drag) return {};
    const source = drag.canDrag(node);
    return {
      draggable: source,
      onDragStart: source
        ? (event) => {
            dragging.current = node;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", node.id);
            event.currentTarget.dataset.dragging = "true";
          }
        : undefined,
      onDragEnd: (event) => {
        dragging.current = null;
        delete event.currentTarget.dataset.dragging;
      },
      onDragOver: (event) => {
        const from = dragging.current;
        if (!from || !drag.canDrop(from, node)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        event.currentTarget.dataset.drop = "ok";
      },
      onDragLeave: (event) => {
        delete event.currentTarget.dataset.drop;
      },
      onDrop: (event) => {
        delete event.currentTarget.dataset.drop;
        const from = dragging.current;
        dragging.current = null;
        if (!from || !drag.canDrop(from, node)) return;
        event.preventDefault();
        drag.onDrop(byId.get(from.id) ?? from, node);
      },
    };
  };

  // Top-level cards with nobody above or below go in one group, not a row a mile long.
  const trees = roots.filter((root) => root.children.length > 0);
  const loose = roots.filter((root) => root.children.length === 0);
  const groupLoose = loose.length > 1 || (loose.length === 1 && trees.length > 0);
  const cols = loose.length <= 3 ? 1 : loose.length <= 12 ? 2 : loose.length <= 40 ? 3 : 4;

  const card = (node: T) => (
    <div
      key={node.id}
      data-org-card={node.id}
      {...dragProps(node)}
      className={cn(
        "relative w-56 rounded-lg border border-border bg-card text-card-foreground shadow-xs transition-[box-shadow,opacity]",
        "hover:shadow-md",
        drag?.canDrag(node) && "cursor-grab active:cursor-grabbing",
        highlight?.has(node.id) && "ring-2 ring-accent ring-offset-2 ring-offset-background",
        "data-[drop=ok]:bg-secondary data-[drop=ok]:ring-2 data-[drop=ok]:ring-primary",
        "data-[dragging=true]:opacity-40",
      )}
    >
      {renderCard(node)}
    </div>
  );

  const branch = (node: T): React.ReactNode => {
    const children = node.children as T[];
    const open = isOpen(node.id);
    const counts = countsOf?.(node) ?? { direct: children.length, total: children.length };
    const stack = children.length >= STACK_FROM && children.every((child) => child.children.length === 0);
    return (
      <li key={node.id}>
        {card(node)}
        {children.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggle(node.id)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${counts.direct} direct report${counts.direct === 1 ? "" : "s"}`}
            className="relative z-10 mt-1.5 h-6 gap-1 rounded-full px-2 text-[11px] text-muted-foreground has-[>svg]:px-2"
          >
            <Users className="size-3" />
            {counts.direct}
            {counts.total > counts.direct && <span className="text-muted-foreground/80">· {counts.total}</span>}
            {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </Button>
        )}
        {children.length > 0 && open && (
          <ul className={cn(stack && "org-stack")}>{children.map((child) => branch(child))}</ul>
        )}
      </li>
    );
  };

  const control = (tip: string, onClick: () => void, icon: React.ReactNode, disabled = false) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={tip} disabled={disabled}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );

  return (
    <div
      ref={shellRef}
      className={cn(
        "relative flex flex-col bg-muted/40",
        fullscreen ? "h-screen bg-background" : "h-[calc(100dvh-17rem)] min-h-[28rem]",
      )}
    >
      <div
        ref={viewportRef}
        tabIndex={0}
        role="group"
        aria-roledescription="org chart canvas"
        aria-label={`${label}. Drag or use the arrow keys to move, plus and minus to zoom, 0 to reset, F to fit.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        className="org-canvas relative flex-1 cursor-grab touch-none overflow-hidden select-none focus-visible:outline-offset-[-2px] active:cursor-grabbing"
      >
        <div ref={contentRef} className="absolute top-0 left-0 w-max origin-top-left p-6">
          <ul className="org-tree">
            {(groupLoose ? trees : roots).map((root) => branch(root))}
            {groupLoose && (
              <li>
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    {looseLabel} · {loose.length}
                  </p>
                  <div className={cn("grid gap-3", GRID_COLS[cols - 1])}>{loose.map((node) => card(node))}</div>
                </div>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg border border-border bg-card p-1 shadow-sm">
        {control("Zoom in", () => zoomAt(STEP), <Plus />, zoom >= MAX_ZOOM * 100)}
        <span className="w-11 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {zoom}%
        </span>
        {control("Zoom out", () => zoomAt(1 / STEP), <Minus />, zoom <= MIN_ZOOM * 100)}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        {control("Fit to screen", fit, <Scan />)}
        {control("Back to the top", () => reset(), <Crosshair />)}
        {control(
          allOpen ? "Collapse all" : "Expand all",
          () => setExpanded(allOpen ? new Set(roots.map((r) => r.id)) : new Set(branches)),
          allOpen ? <ChevronsUp /> : <ChevronsDown />,
          branches.length === 0,
        )}
        {control(fullscreen ? "Exit full screen" : "Full screen", toggleFullscreen, fullscreen ? <Minimize /> : <Maximize />)}
      </div>
    </div>
  );
}
