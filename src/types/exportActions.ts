// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Export action descriptors
 *
 * One definition per export, shared by the toolbar dropdown and the Reports
 * pane so the two can never drift. See DOCS/APP-SHELL-NAVIGATION-PLAN.md.
 */

import type { LucideIcon } from 'lucide-react';

export type ExportActionGroup = 'images' | 'documents' | 'interchange' | 'cost' | 'deployment';

export const EXPORT_GROUP_LABELS: Record<ExportActionGroup, string> = {
  images: 'Diagram images',
  documents: 'Documents & decks',
  interchange: 'Editable formats',
  cost: 'Cost',
  deployment: 'Deployment',
};

export const EXPORT_GROUP_ORDER: ExportActionGroup[] = ['images', 'documents', 'interchange', 'cost', 'deployment'];

export interface ExportAction {
  id: string;
  label: string;
  group: ExportActionGroup;
  icon: LucideIcon;
  /** What the export produces. Shown as the card body and the enabled tooltip. */
  description: string;
  /** Why it cannot run right now. Presence of this string is what disables it. */
  disabledReason?: string;
  /** Generates rather than downloads, so the card reads as an action. */
  isGenerate?: boolean;
  run: () => void;
}

export function isExportDisabled(action: ExportAction): boolean {
  return Boolean(action.disabledReason);
}
