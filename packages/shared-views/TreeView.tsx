import * as React from "react";
import { useState, useCallback } from "react";
import "./treeview.css";
import { Codicon } from "./Codicon";

export interface TreeNode {
  id: string;
  /** Primary label — any React node (string, styled span, etc.). */
  label: React.ReactNode;
  /** Muted secondary text shown after the label. */
  secondary?: React.ReactNode;
  /** Badges rendered at the far right of the row. */
  badges?: React.ReactNode;
  /** Child nodes. Absence (or empty array) makes the node a leaf. */
  children?: TreeNode[];
  /** Whether this node starts expanded. Default false. */
  defaultExpanded?: boolean;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildInitialExpanded(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>();
  function walk(list: TreeNode[]) {
    for (const n of list) {
      if (n.defaultExpanded) { ids.add(n.id); }
      if (n.children?.length) { walk(n.children); }
    }
  }
  walk(nodes);
  return ids;
}

// ── TreeNodeView ───────────────────────────────────────────────────────────

interface TreeNodeViewProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

function TreeNodeView({ node, depth, expanded, onToggle }: TreeNodeViewProps): React.ReactElement {
  const hasChildren = !!node.children?.length;
  const isExpanded = expanded.has(node.id);

  const handleClick = useCallback(() => {
    if (hasChildren) { onToggle(node.id); }
  }, [hasChildren, node.id, onToggle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (hasChildren && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onToggle(node.id);
    }
  }, [hasChildren, node.id, onToggle]);

  return (
    <div className="tv-node">
      <div
        className={`tv-row${hasChildren ? " tv-row--expandable" : ""}`}
        style={{ "--tv-depth": depth } as React.CSSProperties}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
      >
        {hasChildren ? (
          <Codicon name={isExpanded ? "chevron-down" : "chevron-right"} className="tv-chevron" />
        ) : (
          <span className="tv-leaf-dot" />
        )}
        <span className="tv-label">{node.label}</span>
        {node.secondary !== undefined && (
          <span className="tv-secondary">{node.secondary}</span>
        )}
        {node.badges !== undefined && (
          <span className="tv-badges">{node.badges}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div className="tv-children" role="group">
          {node.children!.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── TreeView ───────────────────────────────────────────────────────────────

export function TreeView({ nodes, className }: TreeViewProps): React.ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(() => buildInitialExpanded(nodes));

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  return (
    <div className={`tv-root${className ? ` ${className}` : ""}`} role="tree">
      {nodes.map((node) => (
        <TreeNodeView key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} />
      ))}
    </div>
  );
}
