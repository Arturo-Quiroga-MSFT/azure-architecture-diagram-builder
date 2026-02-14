import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { iconCategories, loadIconsFromCategory, AzureIcon, loadIcon } from '../utils/iconLoader';
import './IconPalette.css';

interface IconPaletteProps {
  forceCollapsed?: boolean;
}

const IconPalette: React.FC<IconPaletteProps> = ({ forceCollapsed }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (forceCollapsed) setIsCollapsed(true);
  }, [forceCollapsed]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['ai + machine learning']));
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryIcons, setCategoryIcons] = useState<Map<string, AzureIcon[]>>(new Map());
  const [iconUrls, setIconUrls] = useState<Map<string, string>>(new Map());

  const toggleCategory = async (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
      
      // Load icon URLs for this category if not already loaded
      const icons = categoryIcons.get(category) || [];
      for (const icon of icons) {
        if (!iconUrls.has(icon.path)) {
          const url = await loadIcon(icon.path);
          setIconUrls(prev => new Map(prev).set(icon.path, url));
        }
      }
    }
    setExpandedCategories(newExpanded);
  };

  // Load all icon metadata on mount so search works across all categories
  useEffect(() => {
    const loadAllIconMetadata = async () => {
      const newCategoryIcons = new Map<string, AzureIcon[]>();
      for (const category of iconCategories) {
        const icons = await loadIconsFromCategory(category);
        newCategoryIcons.set(category, icons);
      }
      setCategoryIcons(newCategoryIcons);

      // Load icon URLs for the initially expanded category
      const initialIcons = newCategoryIcons.get('ai + machine learning') || [];
      for (const icon of initialIcons) {
        const url = await loadIcon(icon.path);
        setIconUrls(prev => new Map(prev).set(icon.path, url));
      }
    };
    
    loadAllIconMetadata();
  }, []);

  const onDragStart = (event: React.DragEvent, icon: AzureIcon) => {
    event.dataTransfer.setData('application/reactflow', 'azureNode');
    event.dataTransfer.setData('iconPath', icon.path);
    event.dataTransfer.setData('iconName', icon.name);
    event.dataTransfer.setData('iconCategory', icon.category);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredCategories = iconCategories.filter(cat => {
    if (searchTerm === '') return true;
    const term = searchTerm.toLowerCase();
    if (cat.toLowerCase().includes(term)) return true;
    // Also show category if any of its icons match the search
    const icons = categoryIcons.get(cat) || [];
    return icons.some(icon => icon.name.toLowerCase().includes(term));
  });

  // Auto-expand categories with matching icons when searching, load their icon URLs
  useEffect(() => {
    if (searchTerm === '') return;
    const term = searchTerm.toLowerCase();
    const categoriesToExpand: string[] = [];
    filteredCategories.forEach(cat => {
      const icons = categoryIcons.get(cat) || [];
      if (icons.some(icon => icon.name.toLowerCase().includes(term))) {
        if (!expandedCategories.has(cat)) {
          categoriesToExpand.push(cat);
        }
        // Load icon URLs for visible matched icons
        icons.forEach(async (icon) => {
          if (icon.name.toLowerCase().includes(term) && !iconUrls.has(icon.path)) {
            const url = await loadIcon(icon.path);
            setIconUrls(prev => new Map(prev).set(icon.path, url));
          }
        });
      }
    });
    if (categoriesToExpand.length > 0) {
      setExpandedCategories(prev => {
        const next = new Set(prev);
        categoriesToExpand.forEach(c => next.add(c));
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  return (
    <div className={`icon-palette ${isCollapsed ? 'collapsed' : ''}`}>
      <button 
        className="collapse-toggle" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {isCollapsed ? (
          <>
            <ChevronRight size={20} />
            <span className="collapse-label">Azure Services</span>
          </>
        ) : (
          <ChevronLeft size={20} />
        )}
      </button>
      {!isCollapsed && (
        <>
          <div className="palette-header">
            <h2>Azure Services</h2>
            <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search services..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="palette-content">
        {filteredCategories.map((category) => {
          const isExpanded = expandedCategories.has(category);
          const icons = categoryIcons.get(category) || [];
          const filteredIcons = icons.filter(icon =>
            searchTerm === '' || icon.name.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <div key={category} className="category-section">
              <div
                className="category-header"
                onClick={() => toggleCategory(category)}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="category-title">{category}</span>
                {isExpanded && <span className="icon-count">({filteredIcons.length})</span>}
              </div>
              
              {isExpanded && (
                <div className="icons-grid">
                  {filteredIcons.length > 0 ? (
                    filteredIcons.map((icon) => {
                      const iconUrl = iconUrls.get(icon.path);
                      return (
                        <div
                          key={icon.id}
                          className="icon-item"
                          draggable
                          onDragStart={(e) => onDragStart(e, icon)}
                          title={icon.name}
                        >
                          {iconUrl ? (
                            <img src={iconUrl} alt={icon.name} className="icon-image" />
                          ) : (
                            <div className="icon-placeholder">Loading...</div>
                          )}
                          <span className="icon-label">{icon.name}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="no-icons">Loading icons...</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
};

export default IconPalette;
