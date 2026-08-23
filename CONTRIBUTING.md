# Contributing to Azure Architecture Diagram Builder

This project welcomes contributions and suggestions. Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

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
2. If you've added code that should be tested, add tests.
3. Ensure your code follows the existing coding style (TypeScript, React conventions).
4. Make sure the project builds successfully (`npm run build`).
5. Write a clear PR description explaining your changes.

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
