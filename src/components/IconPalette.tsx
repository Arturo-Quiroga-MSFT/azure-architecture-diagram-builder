import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { iconCategories, loadIconsFromCategory, AzureIcon, loadIcon } from '../utils/iconLoader';
import './IconPalette.css';

const IconPalette: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
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
      
      // Load icons for this category if not already loaded
      if (!categoryIcons.has(category)) {
        const icons = await loadIconsFromCategory(category);
        setCategoryIcons(prev => new Map(prev).set(category, icons));
        
        // Load URLs for all icons in category
        for (const icon of icons) {
          const url = await loadIcon(icon.path);
          setIconUrls(prev => new Map(prev).set(icon.path, url));
        }
      }
    }
    setExpandedCategories(newExpanded);
  };

  // Load initial category
  useEffect(() => {
    const loadInitialCategory = async () => {
      const category = 'ai + machine learning';
      const icons = await loadIconsFromCategory(category);
      setCategoryIcons(new Map().set(category, icons));
      
      for (const icon of icons) {
        const url = await loadIcon(icon.path);
        setIconUrls(prev => new Map(prev).set(icon.path, url));
      }
    };
    
    loadInitialCategory();
  }, []);

  const onDragStart = (event: React.DragEvent, icon: AzureIcon) => {
    event.dataTransfer.setData('application/reactflow', 'azureNode');
    event.dataTransfer.setData('iconPath', icon.path);
    event.dataTransfer.setData('iconName', icon.name);
    event.dataTransfer.setData('iconCategory', icon.category);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filteredCategories = iconCategories.filter(cat =>
    searchTerm === '' || cat.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
