// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Nav rail
 *
 * Slim left rail that switches the top-level pane. Distinct from IconPalette,
 * which sits immediately to its right and carries draggable service icons:
 * the rail is navigation, the palette is content.
 *
 * Items are limited to panes that genuinely do not need the diagram visible.
 * Anything that annotates the diagram belongs in the right dock instead — see
 * DOCS/APP-SHELL-NAVIGATION-PLAN.md.
 */

import { LayoutGrid, FolderOpen, FileBarChart, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppView, type AppView } from '../stores/appViewStore';
import './NavRail.css';

interface NavItem {
  view: AppView;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { view: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { view: 'library', label: 'Library', icon: FolderOpen },
  { view: 'reports', label: 'Reports', icon: FileBarChart },
  { view: 'settings', label: 'Settings', icon: Settings },
];

export function NavRail() {
  const [activeView, setActiveView] = useAppView();

  return (
    <nav className="nav-rail" aria-label="Main">
      {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
        const isActive = view === activeView;
        return (
          <button
            key={view}
            type="button"
            className={`nav-rail-item${isActive ? ' is-active' : ''}`}
            onClick={() => setActiveView(view)}
            title={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="nav-rail-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default NavRail;
