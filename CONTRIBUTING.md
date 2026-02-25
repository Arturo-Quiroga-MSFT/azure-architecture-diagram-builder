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

### Areas for Contribution

- Additional Azure service icon mappings
- New example architecture prompts
- Regional pricing data for additional Azure regions
- Accessibility improvements
- Documentation enhancements
- Bug fixes and performance optimizations

## Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
