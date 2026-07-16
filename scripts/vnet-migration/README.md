# Deployment targets — TWO Container Apps (read before deploying)

This project runs **two** Azure Container Apps. Deploy to the correct one.

## NEW app — VNet-integrated (current primary)

- **App:** `azure-diagram-builder-vnet`
- **Resource group:** `azure-diagrams-rg` · **Region:** `eastus2`
- **ACA environment:** `aca-env-azure-diagrams-vnet` — VNet-integrated, reaches
  Cosmos DB (`aqcosmosdb007`) over a **private endpoint / private link**.
- **Deploy / update with:**

  ```bash
  ./scripts/vnet-migration/03-deploy-webapp.sh
  ```

  Builds image tag `:vnet` in ACR `acrazurediagrams1767583743`, auto-passes every
  `VITE_*` from the repo-root `.env` as a build arg, and forces a fresh revision
  suffix each run (the `:vnet` tag string is stable, so ACA would otherwise skip
  creating a revision).

## OLD app — legacy, non-VNet (rollback only)

- ACA environment **not** connected to a VNet.
- **Deploy / update with:**

  ```bash
  ./scripts/update_aca.sh
  ```

- Kept as a rollback target for ~1 month after cutover — **do not delete yet.**

## Notes shared by both

- The Dockerfile bakes MSAL client config (`VITE_AZURE_AD_CLIENT_ID`,
  `VITE_AZURE_AD_AUTHORITY`, `VITE_ARM_SCOPE`) at build time. `VITE_AZURE_AD_REDIRECT_URI`
  is intentionally **not** baked — the client defaults to `window.location.origin`,
  so each host uses its own URL automatically.
- Every deployed host FQDN must be registered as a **SPA redirect URI** on the
  Entra app registration (client id `11920e90-fafe-44d8-a42a-71a32d1f2f1c`) for
  delegated "Import from Azure" sign-in to work.
