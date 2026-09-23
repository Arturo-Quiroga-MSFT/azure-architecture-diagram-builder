// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { SERVICE_ICON_MAP } from '../data/serviceIconMapping';

export interface AzureIcon {
  id: string;
  name: string;
  category: string;
  path: string;
  searchTerms?: string[];
}

export const iconCategories = [
  'ai + machine learning',
  'analytics',
  'app services',
  'azure ecosystem',
  'azure stack',
  'blockchain',
  'compute',
  'containers',
  'databases',
  'devops',
  'fabric',
  'general',
  'hybrid + multicloud',
  'identity',
  'integration',
  'intune',
  'iot',
  'management + governance',
  'menu',
  'migrate',
  'migration',
  'mixed reality',
  'mobile',
  'monitor',
  'networking',
  'new icons',
  'other',
  'security',
  'storage',
  'web',
];

// The Azure architecture icon pack retains filenames from older product
// brands. Keep the SVG assets, but never surface retired names in the palette.
// Prefer the curated replacement assets and suppress the duplicate legacy
// glyphs that would otherwise appear beside them.
const iconDisplayNameOverrides: Record<string, string> = {
  '02658-icon-service-FHIR-Service': 'Azure Health Data Services FHIR service',
  'azure-cognitive-search': 'Azure AI Search',
  'cognitive-services': 'Foundry Tools',
  'document-intelligence': 'Azure AI Document Intelligence',
};

const supersededIconFiles = new Set([
  '10212-icon-service-Azure-API-for-FHIR',
  '10044-icon-service-Cognitive-Search',
  '10162-icon-service-Cognitive-Services',
  '00819-icon-service-Form-Recognizers',
]);

export function getCurrentIconDisplayName(iconFile: string, derivedName: string): string {
  return iconDisplayNameOverrides[iconFile] || derivedName;
}

export function isSupersededIconFile(iconFile: string): boolean {
  return supersededIconFiles.has(iconFile);
}

export function matchesIconSearch(icon: AzureIcon, term: string): boolean {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return true;
  return [icon.name, ...(icon.searchTerms || [])]
    .some(value => value.toLowerCase().includes(normalized));
}

// This function will dynamically load icons from the file system
export function loadIconsFromCategory(category: string): AzureIcon[] {
  try {
    const icons: AzureIcon[] = [];
    
    // Use Vite's import.meta.glob to load SVG files
    const iconModules = import.meta.glob('/Azure_Public_Service_Icons/Icons/**/*.svg', { 
      eager: false,
      query: '?url',
      import: 'default'
    });
    
    for (const path in iconModules) {
      if (path.includes(`/${category}/`)) {
        const fileName = path.split('/').pop() || '';
        const iconFile = fileName.replace('.svg', '');
        if (isSupersededIconFile(iconFile)) continue;
        // Simplified: convert kebab-case filename to Title Case
        // Special handling for common acronyms: AI, CDN, SQL, IoT, API, etc.
        const derivedIconName = fileName
          .replace('.svg', '')
          .replace(/^\d+-icon-service-/, '')  // Keep for backwards compatibility
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => {
            const upper = word.toUpperCase();
            // Preserve common Azure acronyms
            if (['AI', 'ML', 'CDN', 'SQL', 'IOT', 'API', 'VM', 'VMS', 'AKS', 'ACR', 'ACI', 'DB'].includes(upper)) {
              return upper;
            }
            // For compound words like "openai", check if it should be "OpenAI"
            if (word.toLowerCase() === 'openai') return 'OpenAI';
            if (word.toLowerCase() === 'postgresql') return 'PostgreSQL';
            if (word.toLowerCase() === 'mysql') return 'MySQL';
            if (word.toLowerCase() === 'redis') return 'Redis';
            if (word.toLowerCase() === 'cosmos') return 'Cosmos';
            // Default: Title Case
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
          })
          .join(' ');
        const iconName = getCurrentIconDisplayName(iconFile, derivedIconName);
        const mapping = Object.values(SERVICE_ICON_MAP)
          .find(service => service.iconFile === iconFile);
        const searchTerms = mapping
          ? [mapping.displayName, ...mapping.aliases]
          : iconFile === '02658-icon-service-FHIR-Service'
            ? ['FHIR', 'FHIR Service', 'Azure API for FHIR', 'Azure Health Data Services FHIR']
            : [iconName];
        
        icons.push({
          id: iconFile,
          name: iconName,
          category,
          path,
          searchTerms,
        });
      }
    }
    
    return icons.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error(`Error loading icons from category ${category}:`, error);
    return [];
  }
}

export async function loadIcon(path: string): Promise<string> {
  try {
    const iconModules = import.meta.glob('/Azure_Public_Service_Icons/Icons/**/*.svg', { 
      eager: false,
      query: '?url',
      import: 'default'
    });
    
    if (iconModules[path]) {
      const url = await iconModules[path]();
      return url as string;
    }
    
    return '';
  } catch (error) {
    console.error('Error loading icon:', error);
    return '';
  }
}
