import type { GraphNode, NodeShape } from '../types/linkdraw';

export type OsintEntityType = 'ipv4' | 'cidr' | 'domain' | 'email' | 'bitcoin' | 'sha256' | 'phone';

export interface OsintEntity {
  id: string;
  type: OsintEntityType;
  value: string;
  sourceNodeId?: string;
  enrichment?: string[];
}

const REGEX_MAP: { type: OsintEntityType; pattern: RegExp }[] = [
  { type: 'sha256', pattern: /\b[A-Fa-f0-9]{64}\b/g },
  { type: 'cidr', pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\/(?:3[0-2]|[12]?\d)\b/g },
  { type: 'ipv4', pattern: /\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)){3}\b/g },
  { type: 'email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { type: 'bitcoin', pattern: /\b(?:1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}\b|\bbc1[a-z0-9]{25,59}\b/g },
  { type: 'domain', pattern: /\b(?:[a-zA-Z0-9-]+\.)+(?:com|net|org|io|dev|ai|gov|edu|co|uk|de|ru|cn|info|biz|app|xyz)\b/gi },
  { type: 'phone', pattern: /\+?[1-9]\d{9,13}\b/g },
];

export const ENTITY_STYLES: Record<
  OsintEntityType,
  { label: string; icon: string; shape: NodeShape; color: string }
> = {
  ipv4: { label: 'IPv4 Address', icon: '📡', shape: 'diamond', color: '#ffedd5' },
  cidr: { label: 'CIDR Subnet', icon: '🌐', shape: 'parallelogram', color: '#fef3c7' },
  domain: { label: 'Domain', icon: '🕸️', shape: 'hexagon', color: '#fee2e2' },
  email: { label: 'Email', icon: '✉️', shape: 'rounded', color: '#dbeafe' },
  bitcoin: { label: 'Bitcoin Wallet', icon: '₿', shape: 'callout', color: '#fef08a' },
  sha256: { label: 'SHA-256 Hash', icon: '🧬', shape: 'rectangle', color: '#ede9fe' },
  phone: { label: 'Phone Number', icon: '📱', shape: 'rounded', color: '#dcfce7' },
};

export function extractOsintEntities(text: string, sourceNodeId?: string): OsintEntity[] {
  const found = new Map<string, OsintEntity>();

  // First extract emails so we don't duplicate email domains accidentally unless desired,
  // actually keeping both or filtering email substrings is cleaner:
  const emailMatches = new Set<string>();
  const emailRegex = new RegExp(REGEX_MAP.find((r) => r.type === 'email')!.pattern);
  for (const m of text.matchAll(emailRegex)) {
    emailMatches.add(m[0].toLowerCase());
  }

  for (const { type, pattern } of REGEX_MAP) {
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      const value = match[0];
      if (type === 'domain') {
        const lower = value.toLowerCase();
        // Avoid matching pure email suffix if exact token is part of email match without @
        const idx = match.index ?? 0;
        if (idx > 0 && text[idx - 1] === '@') {
          continue;
        }
        if (emailMatches.has(lower)) continue;
      }
      const key = `${type}:${value}`;
      if (!found.has(key)) {
        found.set(key, {
          id: `osint_${type}_${found.size + 1}`,
          type,
          value,
          sourceNodeId,
        });
      }
    }
  }
  return [...found.values()];
}

export function scanGraphForEntities(nodes: GraphNode[]): OsintEntity[] {
  const combined = new Map<string, OsintEntity>();
  for (const node of nodes) {
    const metaText = Object.entries(node.metadata || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' ');
    const fullText = `${node.text} ${node.tags.join(' ')} ${metaText}`;
    const items = extractOsintEntities(fullText, node.id);
    for (const item of items) {
      const key = `${item.type}:${item.value}`;
      if (!combined.has(key)) {
        combined.set(key, item);
      }
    }
  }
  return [...combined.values()];
}

export interface TransformResult {
  parentEntity: OsintEntity;
  relationLabel: string;
  derivedEntities: OsintEntity[];
}

export function runOsintEnrichment(entity: OsintEntity): TransformResult {
  const derived: OsintEntity[] = [];
  let relationLabel = 'Enriched';

  if (entity.type === 'email') {
    const [, domain] = entity.value.split('@');
    if (domain) {
      relationLabel = 'Email → Domain';
      derived.push({
        id: `tr_dom_${Date.now()}`,
        type: 'domain',
        value: domain.toLowerCase(),
        sourceNodeId: entity.sourceNodeId,
      });
    }
  } else if (entity.type === 'ipv4') {
    const parts = entity.value.split('.');
    if (parts.length === 4) {
      relationLabel = 'IP → /24 Subnet';
      derived.push({
        id: `tr_cidr_${Date.now()}`,
        type: 'cidr',
        value: `${parts[0]}.${parts[1]}.${parts[2]}.0/24`,
        sourceNodeId: entity.sourceNodeId,
      });
    }
  } else if (entity.type === 'domain') {
    relationLabel = 'Domain → Subdomains';
    const clean = entity.value.toLowerCase();
    derived.push(
      {
        id: `tr_sub1_${Date.now()}`,
        type: 'domain',
        value: `api.${clean}`,
        sourceNodeId: entity.sourceNodeId,
      },
      {
        id: `tr_sub2_${Date.now() + 1}`,
        type: 'domain',
        value: `mail.${clean}`,
        sourceNodeId: entity.sourceNodeId,
      }
    );
  } else if (entity.type === 'cidr') {
    relationLabel = 'Subnet → Gateway IP';
    const base = entity.value.split('/')[0];
    const parts = base.split('.');
    if (parts.length === 4) {
      derived.push({
        id: `tr_gw_${Date.now()}`,
        type: 'ipv4',
        value: `${parts[0]}.${parts[1]}.${parts[2]}.1`,
        sourceNodeId: entity.sourceNodeId,
      });
    }
  } else if (entity.type === 'sha256') {
    relationLabel = 'Hash → Intel Tag';
    derived.push({
      id: `tr_hash_${Date.now()}`,
      type: 'domain',
      value: `intel-${entity.value.slice(0, 8)}.threat-db.local`,
      sourceNodeId: entity.sourceNodeId,
    });
  } else if (entity.type === 'bitcoin') {
    relationLabel = 'Wallet → Cluster';
    derived.push({
      id: `tr_btc_${Date.now()}`,
      type: 'domain',
      value: `cluster-${entity.value.slice(0, 6)}.chain-intel.local`,
      sourceNodeId: entity.sourceNodeId,
    });
  } else if (entity.type === 'phone') {
    relationLabel = 'Phone → Prefix';
    const prefix = entity.value.slice(0, 4);
    derived.push({
      id: `tr_ph_${Date.now()}`,
      type: 'domain',
      value: `carrier-${prefix.replace('+', '')}.telco-lookup.local`,
      sourceNodeId: entity.sourceNodeId,
    });
  }

  return { parentEntity: entity, relationLabel, derivedEntities: derived };
}

export async function resolveDomainToIpLive(domain: string): Promise<string[]> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
    if (!res.ok) return [];
    const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
    return (data.Answer ?? []).filter((a) => a.type === 1).map((a) => a.data);
  } catch {
    return [];
  }
}
