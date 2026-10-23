# 8_Deploy-It — storyboard

**Length:** ~2:45 · **Recorded on:** production AADB v2.1.12 · **Music:** lift · **Narrator:** Andrew HD

**Asset:** `assets/clinic-booking-first-draft.json` (same clinic draft as Ep 3, 5, 6).
The guide is written live by the model, so step counts, template names and the compile result vary per take:
narration never quotes them; callouts read the real values from the page.

| # | On screen | Narration |
|---|---|---|
| 1 | Cold open: "A diagram is a plan." · "Deployment is the proof." | n01-open |
| 2 | Title card: Episode 8 · "Deploy It" | n02-title |
| 3 | Load the clinic draft | n03-draft |
| 4 | Share or Build → **Generate Deployment Guide**; progress line shows grounding → writing → compiling (sped up) | n04-generate |
| 5 | Guide header: title, overview, model and timing; callout on the prerequisites | n05-overview |
| 6 | Expand a step: its Azure CLI commands and the copy button | n06-steps |
| 7 | Configuration table and validation checklist | n07-config |
| 8 | Microsoft Learn sources the guide was grounded on | n08-grounding |
| 9 | **Bicep section: the compile badge** ("Compiled with the Bicep CLI: 0 errors", CLI version, warnings — or "N compiler errors fixed by the model"), read live into the callout | n09-compiled |
| 10 | Expand `main.bicep`, the code scrolls; the module list | n10-modules |
| 11 | **Download All Bicep** + **Download** the guide (Markdown) | n11-download |
| 12 | Terminal card (off-camera, real run on the downloaded files): `az bicep build` → success, then `az deployment group what-if` against an empty resource group → the list of resources it would create. If what-if needs inputs it can't get, the card shows the build only | n12-terminal |
| 13 | Troubleshooting tips at the end of the guide | n13-troubleshoot |
| 14 | End card | n14-close |
