// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Shared helper that turns the live canvas state + a natural-language request
 * into a "MODIFY EXISTING ARCHITECTURE" prompt for the architecture generator.
 *
 * Used by both the one-shot AI Architecture Generator modal and the persistent
 * Architecture Chat panel so the two surfaces produce identical context and
 * stay in sync over time.
 */

export interface CurrentArchitecture {
  nodes: any[];
  edges: any[];
  architectureName: string;
}

/**
 * Build the prompt sent to `generateArchitectureWithAI`.
 *
 * When the canvas is empty, the user's request is returned verbatim (a fresh
 * generation). When the canvas has content, the request is wrapped with a
 * compact snapshot of the current services, groups, and connections plus
 * instructions to return the COMPLETE architecture with only the requested
 * change applied.
 *
 * @param current        Live canvas nodes/edges/name.
 * @param request        The new natural-language instruction from the user.
 * @param recentRequests Optional prior user instructions (most recent last),
 *                       included so references like "make it bigger" or "undo
 *                       that" can be resolved against the conversation.
 */
export function buildModificationPrompt(
  current: CurrentArchitecture | undefined,
  request: string,
  recentRequests: string[] = [],
): string {
  if (!current || current.nodes.length === 0) {
    return request;
  }

  const groups = current.nodes
    .filter((n) => n.type === 'groupNode')
    .map((n) => ({ name: n.data.label, id: n.id }));

  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

  const services = current.nodes
    .filter((n) => n.type === 'azureNode')
    .map((n) => {
      const groupName = n.parentNode ? groupNameMap.get(n.parentNode) : null;
      return {
        name: n.data.label,
        group: groupName || null,
      };
    });

  const connections = current.edges.map((e) => {
    const fromNode = current.nodes.find((n) => n.id === e.source);
    const toNode = current.nodes.find((n) => n.id === e.target);
    const relationship = e.data?.connectionType === 'association'
      ? 'associated with'
      : e.data?.connectionType === 'containment'
        ? 'contains'
        : '→';
    const type = e.data?.connectionType ? ` [${e.data.connectionType}]` : '';
    return `${fromNode?.data.label || e.source} ${relationship} ${toNode?.data.label || e.target}${e.label ? ` (${e.label})` : ''}${type}`;
  });

  const servicesList = services
    .map((s) => `${s.name}${s.group ? ` [${s.group}]` : ''}`)
    .join(', ');

  const recentBlock = recentRequests.length > 0
    ? `\nRecent requests (oldest to newest): ${recentRequests.map((r) => `"${r}"`).join('; ')}`
    : '';

  return `MODIFY EXISTING ARCHITECTURE: "${current.architectureName}"
Services: ${servicesList}
${groups.length > 0 ? `Groups: ${groups.map((g) => g.name).join(', ')}` : ''}
${connections.length > 0 ? `Connections: ${connections.join('; ')}` : ''}${recentBlock}

CHANGE REQUESTED: ${request}

REFINEMENT MODE — MINIMAL-DIFF CONTRACT:
1. The latest CHANGE REQUESTED is the only authorization to change the diagram. Recent requests provide conversational context, not permission to add more services.
2. Preserve every existing service, group, and connection unless changing it is necessary for the latest request.
3. Add a new Azure service type ONLY when the latest request explicitly names that service or a direct alias. Do not silently add best-practice, security, reliability, observability, caching, or performance services.
4. Optional improvements belong in follow-up suggestions, not in the returned architecture.
5. Return the COMPLETE architecture JSON (all services, groups, connections, workflow), with only the requested minimal change applied.
6. Preserve semantic associations as connection type "association". A WAF policy associated with Front Door is NOT a directional request-flow hop.
7. Do not model a per-resource "Private Endpoint - <resource>" node or a Virtual Network → Private Endpoint containment edge. Private connectivity is a single "Virtual Network" node (plus a "Private DNS Zone" node when DNS resolution matters), grouped by the application into one "Private Connectivity" boundary and annotated with the protected resource names; do not connect either node to the protected resources.
8. Do not add an App Service → Virtual Network "VNet Integration" edge per resource; App Service's own private access is expressed the same way, through the Private Connectivity group's note, not a drawn edge.
9. Never add Azure Private Link as middleware between application and data services. Reserve a standalone Private Link node for an explicitly requested provider-side Private Link Service.
10. Interpret "add WAF in front of Front Door" as "associate a Front Door WAF Policy with Azure Front Door" while preserving Azure Front Door → origin traffic. If no ingress platform exists, do not guess between Front Door and Application Gateway; return the existing topology unchanged so the UI can ask which scope is intended.`;
}

/**
 * Produce a short human-readable summary of what changed between the previous
 * canvas services and a freshly generated architecture, by diffing service
 * labels. Used by the chat panel to post an assistant reply.
 */
export function summarizeArchitectureChange(
  previous: CurrentArchitecture | undefined,
  nextArchitecture: any,
): string {
  const prevNames = new Set(
    (previous?.nodes || [])
      .filter((n) => n.type === 'azureNode')
      .map((n) => String(n.data.label).trim()),
  );

  const nextServices: any[] = Array.isArray(nextArchitecture?.services)
    ? nextArchitecture.services
    : [];
  const nextNames = nextServices
    .map((s) => String(s.label ?? s.name ?? s.service ?? '').trim())
    .filter(Boolean);
  const nextSet = new Set(nextNames);

  const added = nextNames.filter((n) => !prevNames.has(n));
  const removed = [...prevNames].filter((n) => !nextSet.has(n));

  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`added ${added.slice(0, 8).join(', ')}${added.length > 8 ? `, +${added.length - 8} more` : ''}`);
  }
  if (removed.length > 0) {
    parts.push(`removed ${removed.slice(0, 8).join(', ')}${removed.length > 8 ? `, +${removed.length - 8} more` : ''}`);
  }

  if (parts.length === 0) {
    return `Updated the diagram (${nextSet.size} service${nextSet.size === 1 ? '' : 's'}). Reconnections or labels may have changed.`;
  }

  // Capitalize first word.
  const sentence = parts.join('; ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}
