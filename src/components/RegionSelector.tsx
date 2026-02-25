// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import { setActiveRegion, getActiveRegion, AVAILABLE_REGIONS, AzureRegion, RegionInfo } from '../services/regionalPricingService';
import './RegionSelector.css';

interface RegionSelectorProps {
  onRegionChange?: (region: AzureRegion) => void;
}

const RegionSelector: React.FC<RegionSelectorProps> = ({ onRegionChange }) => {
  const [selectedRegion, setSelectedRegion] = useState<AzureRegion>(getActiveRegion());
  const [isOpen, setIsOpen] = useState(false);

  const handleRegionSelect = (region: AzureRegion) => {
    setSelectedRegion(region);
    setActiveRegion(region);
    setIsOpen(false);
    
    if (onRegionChange) {
      onRegionChange(region);
    }
  };

  const currentRegionInfo = AVAILABLE_REGIONS.find(r => r.id === selectedRegion);

  return (
    <div className="region-selector">
      <button 
        className="region-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Select pricing region"
      >
        <span className="region-flag">{currentRegionInfo?.flag}</span>
        <span className="region-name">{currentRegionInfo?.displayName}</span>
        <span className="region-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      
      {isOpen && (
        <div className="region-dropdown">
          {AVAILABLE_REGIONS.map((region: RegionInfo) => (
            <button
              key={region.id}
              className={`region-option ${selectedRegion === region.id ? 'selected' : ''}`}
              onClick={() => handleRegionSelect(region.id)}
            >
              <span className="region-flag">{region.flag}</span>
              <div className="region-info">
                <div className="region-display-name">
                  {region.displayName}
                  <span className={`region-type-badge region-type-${region.regionType.toLowerCase()}`}>
                    {region.regionType}
                  </span>
                </div>
                <div className="region-location">{region.location}, {region.geography}</div>
              </div>
              {selectedRegion === region.id && <span className="checkmark">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegionSelector;
