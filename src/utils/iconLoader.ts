// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface AzureIcon {
  id: string;
  name: string;
  category: string;
  path: string;
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

// This function will dynamically load icons from the file system
export async function loadIconsFromCategory(category: string): Promise<AzureIcon[]> {
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
        // Simplified: convert kebab-case filename to Title Case
        // Special handling for common acronyms: AI, CDN, SQL, IoT, API, etc.
        const iconName = fileName
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
        
        icons.push({
          id: fileName.replace('.svg', ''),
          name: iconName,
          category,
          path,
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
