# Version History Feature

## Overview
The Version History feature provides automatic and manual version tracking for Azure architecture diagrams, enabling users to:
- Compare different iterations of their architecture
- Restore previous versions
- Track improvements over time
- Open multiple versions side-by-side for comparison

## Features

### 1. **Auto-Snapshot Before AI Regeneration**
- Automatically saves the current diagram before generating a new architecture with AI
- Preserves all diagram data including:
  - Services (nodes)
  - Connections (edges)
  - Workflow steps
  - Architecture prompt
  - Validation score (if available)
  - Metadata (name, author, version, date)

### 2. **Version History Modal**
Access via the **"History"** button in the toolbar (next to Save/Share/Load)

**Features:**
- View all saved versions sorted by date (newest first)
- See key metrics: number of services, connections, validation score
- View the prompt used for AI generation
- See improvements applied from validation recommendations
- Delete unwanted versions

### 3. **Open in New Tab**
Click the **"Open in New Tab"** icon (↗) on any version to:
- Open that version in a new browser tab
- Compare side-by-side with current diagram
- Use browser's split screen or multiple monitors
- Version data is encoded in URL hash for instant loading

### 4. **Restore Version**
Click **"Restore This Version"** to:
- Replace current diagram with the selected version
- Restore all services, connections, workflow, and metadata
- Confirmation prompt prevents accidental overwrites

### 5. **Storage Technology**
- Uses **IndexedDB** for local browser storage
- ~5-10MB storage limit (hundreds of versions)
- Data persists across browser sessions
- No backend required for basic versioning

## Usage Examples

### **Scenario 1: Iterative Architecture Refinement**
1. Generate initial architecture with AI
2. Run validation and get recommendations
3. Apply recommendations → Auto-snapshot saves previous version
4. Compare new vs old architecture using "Open in New Tab"
5. Repeat until satisfied

### **Scenario 2: What-If Analysis**
1. Save current architecture as version A
2. Try alternative approach with different services
3. Open both versions in separate tabs
4. Compare cost, complexity, resilience
5. Restore preferred version

### **Scenario 3: Presentation Preparation**
1. Create multiple design variations
2. Show evolution from v1 → v2 → v3 in presentation
3. Export each version as PNG/SVG
4. Demonstrate improvement progression

## Technical Details

### **Data Structure**
```typescript
interface DiagramVersion {
  versionId: string;           // Unique ID
  timestamp: number;           // Creation time
  diagramName: string;         // Architecture name
  architecturePrompt?: string; // AI prompt
  validationScore?: number;    // WAF score
  parentVersionId?: string;    // Previous version
  improvementsApplied?: string[]; // Changes from validation
  notes?: string;              // User notes
  nodes: any[];                // Services
  edges: any[];                // Connections
  metadata?: any;              // Title block data
  workflow?: any[];            // Architecture workflow
}
```

### **IndexedDB Schema**
- Database: `AzureDiagramVersions`
- Object Store: `versions`
- Primary Key: `versionId`
- Indexes: `timestamp`, `diagramName`

### **Files Created**
1. **`src/services/versionStorageService.ts`** - IndexedDB operations
2. **`src/components/VersionHistoryModal.tsx`** - UI component
3. **`src/components/VersionHistoryModal.css`** - Styles

### **Modified Files**
1. **`src/App.tsx`**
   - Added version history state
   - Added `saveSnapshot()` and `restoreVersion()` functions
   - Auto-snapshot before AI regeneration
   - History button in toolbar
   - Version restoration from URL hash

## Future Enhancements

### **Phase 2: Backend Sync**
- Sync versions to Cosmos DB
- Cross-device access
- Team collaboration
- Unlimited storage

### **Phase 3: Visual Diff**
- Side-by-side comparison view
- Highlight added/removed/modified services
- Show cost differences
- Validation score delta

### **Phase 4: Branching**
- Create named branches
- Merge branches
- Version tags/milestones
- Export version tree

### **Phase 5: Collaboration**
- Share specific versions
- Comment on versions
- Approval workflow
- Change notifications

## User Tips

1. **Naming Conventions**: Update the architecture name in Title Block before major changes to identify versions easily

2. **Regular Snapshots**: Manually save snapshots before major refactoring

3. **Cleanup**: Delete experimental versions to keep history manageable

4. **Browser Storage**: Versions are browser-specific; use Share feature for cross-device access

5. **Side-by-Side**: Use "Open in New Tab" + browser split screen for best comparison experience

## Troubleshooting

**Q: I don't see any versions in history**
- A: Versions are saved automatically before AI regeneration or can be manually created (future feature)

**Q: Can I access versions on another computer?**
- A: Currently versions are stored locally. Use the Share feature for cloud-based diagram access

**Q: How many versions can I store?**
- A: Browser IndexedDB typically allows 5-10MB, enough for hundreds of versions

**Q: Can I export version history?**
- A: Not yet, but planned for future updates. You can manually save each version as JSON

## Testing the Feature

1. **Generate Architecture**: Create diagram with AI
2. **Run Validation**: Get WAF recommendations
3. **Apply Improvements**: Regenerate with recommendations
4. **Open History**: Click History button to see auto-saved version
5. **Open in Tab**: Open previous version in new tab
6. **Compare**: View both versions side-by-side
7. **Restore**: Switch back to previous version if preferred
