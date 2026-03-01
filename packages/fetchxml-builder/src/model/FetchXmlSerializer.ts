import { type FetchNode } from "./FetchXmlNode";

/** Serialize a FetchNode tree to a formatted FetchXML string. */
export function serialize(node: FetchNode, indent = 0): string {
  const pad = "  ".repeat(indent);
  const tag = node.kind;

  const attrsStr = Object.entries(node.attrs)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}='${escapeXml(v)}'`)
    .join(" ");

  const openTag = attrsStr ? `${pad}<${tag} ${attrsStr}>` : `${pad}<${tag}>`;

  if (node.children.length === 0 && !node.text) {
    return attrsStr
      ? `${pad}<${tag} ${attrsStr} />`
      : `${pad}<${tag} />`;
  }

  if (node.text && node.children.length === 0) {
    return `${openTag}${escapeXml(node.text)}</${tag}>`;
  }

  const inner = node.children.map((c) => serialize(c, indent + 1)).join("\n");
  return `${openTag}\n${inner}\n${pad}</${tag}>`;
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&apos;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Minimal stack-based parser for well-formed FetchXML.
 * Handles the limited element vocabulary of FetchXML.
 * Returns null if parsing fails.
 */
export function parseFetchXml(xml: string): FetchNode | null {
  const { createFetchNode } = require("./FetchXmlNode");
  const trimmed = xml.trim();
  try {
    return parseElement(trimmed, createFetchNode);
  } catch {
    return null;
  }
}

function parseElement(
  xml: string,
  factory: (kind: string, attrs: Record<string, string>) => FetchNode
): FetchNode | null {
  // Self-closing tag
  const selfClose = xml.match(/^<([\w-]+)((?:\s+[\w-]+=(?:'[^']*'|"[^"]*"))*)\s*\/>/);
  if (selfClose) {
    return factory(selfClose[1], parseAttrs(selfClose[2]));
  }

  // Opening tag
  const open = xml.match(/^<([\w-]+)((?:\s+[\w-]+=(?:'[^']*'|"[^"]*"))*)\s*>/);
  if (!open) { return null; }

  const tag = open[1];
  const attrs = parseAttrs(open[2]);
  const node = factory(tag, attrs);

  // Find corresponding closing tag (greedy to last occurrence)
  const closeTag = `</${tag}>`;
  const closeIdx = xml.lastIndexOf(closeTag);
  if (closeIdx === -1) { return null; }

  const inner = xml.slice(open[0].length, closeIdx);

  // Parse children from inner content
  let pos = 0;
  while (pos < inner.length) {
    // Skip whitespace
    while (pos < inner.length && /\s/.test(inner[pos])) { pos++; }
    if (pos >= inner.length) { break; }

    if (inner[pos] !== "<") {
      // Text content (e.g. inside <value>123</value>)
      const textEnd = inner.indexOf("<", pos);
      const text = textEnd === -1 ? inner.slice(pos) : inner.slice(pos, textEnd);
      node.text = text.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      if (textEnd === -1) { break; }
      pos = textEnd;
      continue;
    }

    // Find the end of this child element
    const childXml = extractElement(inner, pos);
    if (!childXml) { break; }

    const child = parseElement(childXml.trim(), factory);
    if (child) { node.children.push(child); }
    pos += childXml.length;
  }

  return node;
}

function parseAttrs(attrsStr: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w-]+)=(?:'([^']*)'|"([^"]*)")/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrsStr)) !== null) {
    attrs[m[1]] = (m[2] ?? m[3] ?? "").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  }
  return attrs;
}

/**
 * Extract a complete XML element (with all nested content) starting at `pos`.
 * Returns the raw XML string for that element.
 */
function extractElement(xml: string, pos: number): string | null {
  const tagMatch = xml.slice(pos).match(/^<([\w-]+)/);
  if (!tagMatch) { return null; }
  const tag = tagMatch[1];

  // Self-closing?
  const selfCloseRe = new RegExp(`^<${tag}(?:\\s[^>]*)?\\/>`);
  const scMatch = xml.slice(pos).match(selfCloseRe);
  if (scMatch) { return scMatch[0]; }

  // Find balanced open/close
  let depth = 0;
  let i = pos;
  const len = xml.length;
  while (i < len) {
    if (xml[i] !== "<") { i++; continue; }
    const openMatch = xml.slice(i).match(new RegExp(`^<${tag}(?:\\s[^>]*)?>`));
    if (openMatch) { depth++; i += openMatch[0].length; continue; }
    const closeMatch = xml.slice(i).match(new RegExp(`^<\\/${tag}>`));
    if (closeMatch) {
      depth--;
      i += closeMatch[0].length;
      if (depth === 0) { return xml.slice(pos, i); }
      continue;
    }
    i++;
  }
  return null;
}
