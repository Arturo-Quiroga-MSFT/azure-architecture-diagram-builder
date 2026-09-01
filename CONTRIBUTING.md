# Contributing to Azure Architecture Diagram Builder

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit [Microsoft CLA](https://cla.opensource.microsoft.com).

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## How to Contribute

### Reporting Issues

- Use the [GitHub Issues](../../issues) tab to report bugs or suggest features.
- Search existing issues before creating a new one to avoid duplicates.
- Include as much detail as possible: steps to reproduce, expected vs. actual behavior, screenshots, browser/OS info.

### Submitting Pull Requests

1. Fork the repository and create your branch from `main`.
2. Follow the [AADB Software Development Lifecycle](HVE-ADOPTION/SDLC.md):
	classify risk, define acceptance and non-goals, identify blast radius and
	rollback, and use the required Research/Plan/Implement/Review path.
3. For a bug, add a regression fence and show that old behavior fails and new
	behavior passes, or explain why no executable fence is possible.
4. Run focused checks while implementing, then run `npm run verify:release`.
5. Complete the pull request evidence template. Do not merge through unexplained
	failures or unresolved R4 gates.
6. Obtain explicit merge approval. Production deployment is a separate decision
	and requires a second explicit approval naming the intended version.

### Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/azure-architecture-diagram-builder.git
cd azure-architecture-diagram-builder

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Azure OpenAI credentials

# Start development server
npm run dev
```

### Coding Guidelines

- **Language**: TypeScript with React 18
- **Styling**: CSS modules (component-level `.css` files)
- **State Management**: React hooks and custom stores
- **Formatting**: Follow existing code patterns and indentation
- **Naming**: Use descriptive names; PascalCase for components, camelCase for functions/variables

### Versioning and Releases

The root `package.json` is the single source for the AADB product version. The build publishes that value in the header, telemetry, deployment registration, and `/version.json`; deployment scripts also set ACA `APP_VERSION` to the same value.

Install the pinned Playwright browser once, then run the complete release gate before merging or deploying:

```bash
npx playwright install chromium
npm run verify:release
```

The gate runs both TypeScript projects, full-repository ESLint, all deterministic regression scripts, the production build, package/build version consistency, and a Playwright smoke test. The smoke test builds into an isolated directory, mocks the AI proxy with a fixed architecture, and exercises page load, version display, Help, model selection, Generate Diagram, React Flow rendering, workflow rendering, and validation availability. It never calls Azure or a live model.

The initial JavaScript budget lives in `performance-budget.json`. To capture a cold-cache browser sample for a deployed or local URL:

```bash
npm run measure:performance -- https://<app-host>/
```

Compare bundle bytes from identical builds directly. Treat browser timings as samples tied to their network, host, runner, and viewport; do not compare a loopback timing to an Azure-hosted timing as if they were equivalent.

GitHub Actions runs the same command on pull requests, pushes to `main`, and before the manual Azure deployment workflow. The PR evidence check additionally enforces the required risk, acceptance, testing, limitation, blast-radius, rollback, and approval fields; it validates completeness, not the truth of narrative evidence.

Use semantic versioning:

- **Patch** (`1.1.0` → `1.1.1`): backward-compatible fixes and small refinements.
- **Minor** (`1.1.0` → `1.2.0`): backward-compatible features.
- **Major** (`1.1.0` → `2.0.0`): breaking saved-diagram, deployment, API, or architecture changes.

Before every release deployment, update both package files with one of:

```bash
npm version patch --no-git-tag-version
npm version minor --no-git-tag-version
npm version major --no-git-tag-version
npm run build
```

Commit and push the version change before deployment so the image is reproducible from `main`. Deploy through a supported path, verify the live header and `/version.json`, and only then create the release tag:

```bash
VERSION="$(node -p "require('./package.json').version")"
git tag -a "v$VERSION" -m "AADB v$VERSION"
git push origin main "v$VERSION"
```

Supported web deployment paths call `scripts/require-version-bump.sh` and stop before building when the live version is equal or newer. `ALLOW_VERSION_REDEPLOY=true` bypasses that check only to recover or recreate the exact same release; it is not the normal release process.

### Areas for Contribution

- Additional Azure service icon mappings
- New example architecture prompts
- Regional pricing data for additional Azure regions
- Accessibility improvements
- Documentation enhancements
- Bug fixes and performance optimizations

## Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
