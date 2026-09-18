"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Indentation per depth, as whole classes so Tailwind can see them. Deeper than
 * the last step stays at the last step — by then the path is what matters.
 */
const INDENT = [
  "pl-2", "pl-8", "pl-14", "pl-20", "pl-26", "pl-32", "pl-38", "pl-44", "pl-50", "pl-56",
];

export interface TreeNode {
  id: string;
  children: TreeNode[];
}

/**
 * A collapsible, indented tree.
 *
 * An indented list rather than a boxes-and-lines canvas: it stays readable at
 * two thousand people, works with a keyboard and a screen reader, and prints.
 * The first two levels open by default; below that a person expands what they
 * are looking for, and a search result opens the path to it.
 */
export function OrgTree<T extends TreeNode>({
  roots,
  renderNode,
  forceOpen,
  highlight,
  defaultDepth = 2,
}: {
  roots: T[];
  renderNode: (node: T) => React.ReactNode;
  /** Ids whose branch must be open — the ancestors of a search match. */
  forceOpen?: Set<string>;
  highlight?: Set<string>;
  defaultDepth?: number;
}) {
  return (
    <ul role="tree" className="py-2">
      {roots.map((node) => (
        <Branch
          key={node.id}
          node={node}
          depth={0}
          renderNode={renderNode}
          forceOpen={forceOpen}
          highlight={highlight}
          defaultDepth={defaultDepth}
        />
      ))}
    </ul>
  );
}

function Branch<T extends TreeNode>({
  node,
  depth,
  renderNode,
  forceOpen,
  highlight,
  defaultDepth,
}: {
  node: T;
  depth: number;
  renderNode: (node: T) => React.ReactNode;
  forceOpen?: Set<string>;
  highlight?: Set<string>;
  defaultDepth: number;
}) {
  const [toggled, setToggled] = useState<boolean | null>(null);
  const hasChildren = node.children.length > 0;
  const open = forceOpen?.has(node.id) || (toggled ?? depth < defaultDepth - 1);

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined} aria-selected={false}>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md py-1.5 pr-3 hover:bg-muted/50",
          INDENT[Math.min(depth, INDENT.length - 1)],
          highlight?.has(node.id) && "bg-accent",
        )}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={open ? "Collapse" : "Expand"}
            onClick={() => setToggled(!open)}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">{renderNode(node)}</div>
      </div>
      {hasChildren && open && (
        <ul role="group">
          {(node.children as T[]).map((child) => (
            <Branch
              key={child.id}
              node={child}
              depth={depth + 1}
              renderNode={renderNode}
              forceOpen={forceOpen}
              highlight={highlight}
              defaultDepth={defaultDepth}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The ids on the path from each root to every match, so the tree can open them. */
export function ancestorsOf<T extends TreeNode>(roots: T[], matches: Set<string>): Set<string> {
  const open = new Set<string>();
  // True when the node or anything beneath it matches; a node opens when a child's subtree does.
  const walk = (node: TreeNode): boolean => {
    let below = false;
    for (const child of node.children) {
      if (walk(child)) below = true;
    }
    if (below) open.add(node.id);
    return below || matches.has(node.id);
  };
  if (matches.size > 0) roots.forEach(walk);
  return open;
}
