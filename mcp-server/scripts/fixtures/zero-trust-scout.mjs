export const services = [
  { name: 'Application Gateway (WAF)', type: 'Application Gateway', groupId: 'dmz' },
  { name: 'Azure Firewall', type: 'Azure Firewall', groupId: 'dmz' },
  { name: 'Azure Bastion', type: 'Azure Bastion', groupId: 'dmz' },
  { name: 'App Service', type: 'App Service', groupId: 'app' },
  { name: 'VM Scale Set', type: 'Virtual Machine Scale Set', groupId: 'app' },
  { name: 'Private Link Service', type: 'Private Link', groupId: 'app' },
  { name: 'SQL Database', type: 'SQL Database', groupId: 'data' },
  { name: 'Storage Account', type: 'Storage Account', groupId: 'data' },
  { name: 'Key Vault', type: 'Key Vault', groupId: 'data' },
  { name: 'Microsoft Entra ID', type: 'Microsoft Entra ID', groupId: 'identity' },
  { name: 'Microsoft Defender for Cloud', type: 'Microsoft Defender for Cloud', groupId: 'security' },
];

export const connections = [
  ['Application Gateway (WAF)', 'App Service', 'Forward inspected HTTPS traffic', 'sync'],
  ['Azure Firewall', 'Application Gateway (WAF)', 'Inspect inbound north-south traffic', 'sync'],
  ['Azure Firewall', 'VM Scale Set', 'Inspect outbound internet traffic', 'sync'],
  ['Azure Bastion', 'VM Scale Set', 'Provide secure RDP/SSH session', 'sync'],
  ['App Service', 'Private Link Service', 'Route private traffic to data tier', 'sync'],
  ['VM Scale Set', 'Private Link Service', 'Route private traffic to data tier', 'sync'],
  ['Private Link Service', 'SQL Database', 'Query over private endpoint', 'sync'],
  ['Private Link Service', 'Storage Account', 'Access blobs over private endpoint', 'sync'],
  ['Private Link Service', 'Key Vault', 'Retrieve secrets over private endpoint', 'sync'],
  ['Microsoft Entra ID', 'Application Gateway (WAF)', 'Enforce Conditional Access on sign-in', 'sync'],
  ['Microsoft Entra ID', 'Azure Bastion', 'Enforce Conditional Access for admin access', 'sync'],
  ['Microsoft Defender for Cloud', 'App Service', 'Monitor security posture', 'async'],
  ['Microsoft Defender for Cloud', 'VM Scale Set', 'Monitor security posture', 'async'],
  ['Microsoft Defender for Cloud', 'SQL Database', 'Monitor security posture', 'async'],
  ['Microsoft Defender for Cloud', 'Azure Firewall', 'Monitor security posture', 'async'],
].map(([from, to, label, type]) => ({ from, to, label, type }));

export const groups = [
  { id: 'dmz', label: 'DMZ Tier' },
  { id: 'app', label: 'Application Tier' },
  { id: 'data', label: 'Data Tier' },
  { id: 'identity', label: 'Identity' },
  { id: 'security', label: 'Security & Governance' },
];