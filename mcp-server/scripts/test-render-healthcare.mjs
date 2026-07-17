// Scratch test harness: re-render the "Healthcare Imaging Eventing" graph
// (reconstructed from Scout's SVG) to verify P1 orthogonal edge routing.
import { computeLayout } from '../dist/layoutEngine.js';
import { renderSvg } from '../dist/svgRenderer.js';
import { renderHtml } from '../dist/htmlRenderer.js';
import { writeFileSync } from 'node:fs';

const groups = [
  { id: 'producers', label: 'Healthcare Sources' },
  { id: 'ingestion', label: 'Cloud Ingestion - 50K-75K events/sec' },
  { id: 'processing', label: 'Managed Routing and Processing' },
  { id: 'data', label: 'Imaging Data Platform - 250M studies' },
  { id: 'bridge', label: 'Cloud-to-On-Prem Bridge' },
  { id: 'observability', label: 'Monitoring and Operations' },
];

const services = [
  { name: 'DICOM Modalities and RIS/PACS', type: 'On-premises network', groupId: 'producers' },
  { name: 'Event Hubs Dedicated Cluster', type: 'Event Hubs', groupId: 'ingestion' },
  { name: 'Capture to Blob Storage', type: 'Storage Account', groupId: 'ingestion' },
  { name: 'Azure Functions Premium Plan', type: 'Function App', groupId: 'processing' },
  { name: 'Service Bus Premium Topics', type: 'Service Bus', groupId: 'processing' },
  { name: 'Blob Storage Imaging Payloads', type: 'Storage Account', groupId: 'data' },
  { name: 'Cosmos DB Metadata Store', type: 'Cosmos DB', groupId: 'data' },
  { name: 'VPN Gateway', type: 'VPN Gateway', groupId: 'bridge' },
  { name: 'On-prem Integration Endpoint', type: 'On-premises network', groupId: 'bridge' },
  { name: 'Log Analytics Workspace', type: 'Log Analytics', groupId: 'observability' },
  { name: 'Azure Monitor Alerts', type: 'Monitor', groupId: 'observability' },
];

const connections = [
  { from: 'DICOM Modalities and RIS/PACS', to: 'VPN Gateway', label: 'secure hybrid connectivity', type: 'sync' },
  { from: 'VPN Gateway', to: 'Event Hubs Dedicated Cluster', label: 'event ingress', type: 'async' },
  { from: 'Event Hubs Dedicated Cluster', to: 'Capture to Blob Storage', label: 'capture/replay stream', type: 'async' },
  { from: 'Event Hubs Dedicated Cluster', to: 'Azure Functions Premium Plan', label: 'ordered partition consumers', type: 'async' },
  { from: 'Azure Functions Premium Plan', to: 'Blob Storage Imaging Payloads', label: 'store/read 10MB+ payloads', type: 'sync' },
  { from: 'Azure Functions Premium Plan', to: 'Cosmos DB Metadata Store', label: 'metadata upsert/query', type: 'sync' },
  { from: 'Azure Functions Premium Plan', to: 'Service Bus Premium Topics', label: 'route commands and notifications', type: 'async' },
  { from: 'Service Bus Premium Topics', to: 'Azure Functions Premium Plan', label: 'session-ordered processing', type: 'async' },
  { from: 'Azure Functions Premium Plan', to: 'VPN Gateway', label: 'on-prem delivery adapter', type: 'async' },
  { from: 'VPN Gateway', to: 'On-prem Integration Endpoint', label: 'PACS/RIS/VNA bridge', type: 'sync' },
  { from: 'Event Hubs Dedicated Cluster', to: 'Log Analytics Workspace', label: 'diagnostics and lag metrics', type: 'async' },
  { from: 'Service Bus Premium Topics', to: 'Log Analytics Workspace', label: 'queue/session/DLQ metrics', type: 'async' },
  { from: 'Azure Functions Premium Plan', to: 'Log Analytics Workspace', label: 'traces and failures', type: 'async' },
  { from: 'Cosmos DB Metadata Store', to: 'Log Analytics Workspace', label: 'RU, latency, availability', type: 'async' },
  { from: 'Blob Storage Imaging Payloads', to: 'Log Analytics Workspace', label: 'capacity, transactions, audit', type: 'async' },
  { from: 'VPN Gateway', to: 'Log Analytics Workspace', label: 'tunnel health', type: 'async' },
  { from: 'Log Analytics Workspace', to: 'Azure Monitor Alerts', label: 'SLO and operational alerts', type: 'async' },
];

for (const direction of ['TB', 'LR']) {
  const layout = computeLayout(services, connections, groups, direction);
  const svg = renderSvg(layout, 'Healthcare Imaging Eventing Architecture - High Throughput Ordered Events', {
    author: 'Microsoft Scout', generatedBy: 'GPT-5.5', date: '2026-07-07',
  });
  const out = `scripts/out-healthcare-${direction}.svg`;
  writeFileSync(out, svg);
  console.log(`wrote ${out}  (${layout.width}x${layout.height}, ${direction})`);
}

// HTML (interactive) — TB only, to verify orthogonal routing parity.
{
  const layout = computeLayout(services, connections, groups, 'TB');
  const html = renderHtml(layout, 'Healthcare Imaging Eventing Architecture - High Throughput Ordered Events', {
    author: 'Microsoft Scout', generatedBy: 'GPT-5.5',
  });
  writeFileSync('scripts/out-healthcare-TB.html', html);
  console.log('wrote scripts/out-healthcare-TB.html');
}
