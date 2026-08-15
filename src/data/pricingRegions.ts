// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export type AzureRegion =
  | 'eastus2'
  | 'centralus'
  | 'westus2'
  | 'australiaeast'
  | 'canadacentral'
  | 'brazilsouth'
  | 'mexicocentral'
  | 'westeurope'
  | 'northeurope'
  | 'uksouth'
  | 'swedencentral'
  | 'southeastasia'
  | 'japaneast'
  | 'centralindia';

export type RegionType = 'HERO' | 'HUB' | 'SATELLITE' | 'MICRO';

export interface RegionInfo {
  id: AzureRegion;
  displayName: string;
  location: string;
  flag: string;
  regionType: RegionType;
  geography: string;
  fallbackMultiplier: number;
}

export const AVAILABLE_REGIONS: RegionInfo[] = [
  { id: 'eastus2', displayName: 'East US 2', location: 'Virginia', flag: '🇺🇸', regionType: 'HERO', geography: 'United States', fallbackMultiplier: 1.0 },
  { id: 'centralus', displayName: 'Central US', location: 'Iowa', flag: '🇺🇸', regionType: 'HERO', geography: 'United States', fallbackMultiplier: 1.0 },
  { id: 'westus2', displayName: 'West US 2', location: 'Washington', flag: '🇺🇸', regionType: 'HERO', geography: 'United States', fallbackMultiplier: 1.0 },
  { id: 'australiaeast', displayName: 'Australia East', location: 'Sydney', flag: '🇦🇺', regionType: 'HERO', geography: 'Australia', fallbackMultiplier: 1.15 },
  { id: 'canadacentral', displayName: 'Canada Central', location: 'Toronto', flag: '🇨🇦', regionType: 'HUB', geography: 'Canada', fallbackMultiplier: 1.04 },
  { id: 'brazilsouth', displayName: 'Brazil South', location: 'São Paulo', flag: '🇧🇷', regionType: 'HUB', geography: 'Brazil', fallbackMultiplier: 1.20 },
  { id: 'mexicocentral', displayName: 'Mexico Central', location: 'Querétaro', flag: '🇲🇽', regionType: 'HUB', geography: 'Mexico', fallbackMultiplier: 1.0 },
  { id: 'westeurope', displayName: 'West Europe', location: 'Netherlands', flag: '🇳🇱', regionType: 'HUB', geography: 'Europe', fallbackMultiplier: 1.08 },
  { id: 'northeurope', displayName: 'North Europe', location: 'Ireland', flag: '🇮🇪', regionType: 'HUB', geography: 'Europe', fallbackMultiplier: 1.05 },
  { id: 'uksouth', displayName: 'UK South', location: 'London', flag: '🇬🇧', regionType: 'HUB', geography: 'United Kingdom', fallbackMultiplier: 1.06 },
  { id: 'swedencentral', displayName: 'Sweden Central', location: 'Gävle', flag: '🇸🇪', regionType: 'HUB', geography: 'Europe', fallbackMultiplier: 1.0 },
  { id: 'southeastasia', displayName: 'Southeast Asia', location: 'Singapore', flag: '🇸🇬', regionType: 'HUB', geography: 'Asia Pacific', fallbackMultiplier: 1.05 },
  { id: 'japaneast', displayName: 'Japan East', location: 'Tokyo', flag: '🇯🇵', regionType: 'HUB', geography: 'Japan', fallbackMultiplier: 1.12 },
  { id: 'centralindia', displayName: 'Central India', location: 'Pune', flag: '🇮🇳', regionType: 'HUB', geography: 'India', fallbackMultiplier: 1.0 },
];
