# Azure icon provenance and refresh

The checked-in Azure icon baseline is Microsoft's **V24** architecture icon
package, published July 9, 2026. Normal builds are offline: they validate the
checked-in SVGs and generated MCP sidecars but never download an archive.

## Provenance

- Documentation and usage terms:
  <https://learn.microsoft.com/azure/architecture/icons/>
- Pinned archive:
  <https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip>
- Archive SHA-256:
  `921594ccd1bf3d9c0a1bd7b6d924e050551a59342f2b353bb74bdcf761c35141`
- Official V24 inventory: 714 SVGs
- Supplemental inventory: 32 SVGs
  - 20 official Microsoft Fabric product icons
  - 12 conservatively retained repository assets not superseded by V24

`scripts/azure-icons-v24.source.json` pins the source, terms hashes, merge
classification, and superseded paths. `scripts/azure-icons-v24.manifest.json`
pins every retained SVG by path and SHA-256. The two Microsoft PDF files remain
in `Azure_Public_Service_Icons`.

The Microsoft terms permit these icons in architecture diagrams, training
materials, and documentation. Do not crop, flip, rotate, distort, recolor, or
use a Microsoft product icon to represent a different product.

## Deterministic workflow

Validate the current tree and generated catalog:

```powershell
npm run icons:check
```

Refresh from the pinned HTTPS archive:

```powershell
npm run icons:refresh:v24
```

For an already verified local extraction:

```powershell
node scripts/refresh-azure-icons.mjs --apply --source C:\path\to\extraction
npm run icons:sync
```

Updating the pinned manifest is a deliberate maintainer operation:

```powershell
node scripts/refresh-azure-icons.mjs --update-manifest --source C:\path\to\extraction
```

The importer verifies the archive byte length, archive SHA-256, terms hashes,
all 714 official path/hash pairs, and safe ZIP paths. It copies the complete
official package, preserves only classified supplemental assets, and deletes
only explicitly pinned superseded paths.

Regenerate the audit against the pinned pre-refresh baseline commit:

```powershell
npm run icons:audit:v24
```

The checked-in `scripts/azure-icons-pre-v24-baseline.json` pins the old icon and
service-mapping inventories so normal builds and source archives do not require
Git history. `npm run icons:check` reproduces the exact-match, relocation,
missing, repository-only, duplicate, mapped, and unmapped inventories from the
V24 manifest and baseline, then verifies their reviewed counts and digests.
Pass `--official C:\path\to\extraction` to re-verify extracted upstream files,
or `--output C:\path\to\audit.json` to emit the full audit report locally.

## Service catalog

`src/data/serviceIconMapping.ts` is the service metadata source of truth.
`mcp-server/scripts/sync-icon-map.mjs` deterministically generates:

- `iconMap.generated.json`
- `iconSvgs.generated.json`
- `serviceCatalog.generated.json`
- `legacyIconTypes.generated.json`
- `src/data/iconPathRedirects.generated.json`

The MCP server reads the generated catalog directly; it no longer maintains a
second hand-written service list. Generation fails for missing or wrongly
cased SVGs, duplicate canonical services, ambiguous aliases, conflicting icon
stems, unsafe SVG content, or a missing required Foundry service. `--check`
also fails when any generated sidecar is stale.
