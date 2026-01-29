# GPT-5.2 Reasoning Levels Configuration

## Overview

Azure OpenAI with API version `2025-04-01-preview` supports configurable reasoning effort levels that control how deeply GPT-5.2 thinks before responding.

## Configuration

The reasoning level is controlled via the `VITE_REASONING_EFFORT` environment variable in your `.env` file:

```env
VITE_REASONING_EFFORT=medium
```

## Available Reasoning Levels

| Level | Speed | Cost | Use Case |
|-------|-------|------|----------|
| **none** | Fastest | Lowest | Quick iterations, simple 2-3 service diagrams |
| **low** | Fast | Low | Basic architectures, draft designs |
| **medium** | Balanced | Moderate | **Recommended default** - Production architectures with 5-10 services |
| **high** | Slower | Higher | Complex enterprise architectures (10-15+ services) |
| **xhigh** | Slowest | Highest | Mission-critical infrastructure, compliance-heavy designs |

## Current Implementation

✅ **WORKING** - The app uses:
- **API Version**: `2025-04-01-preview` (supports reasoning_effort)
- **Parameter**: `reasoning_effort` (flat parameter for Chat Completions API)
- **Default Setting**: `medium`

Benefits with `medium` reasoning:
- ✅ Better service grouping and logical organization
- ✅ Smarter Azure service selection
- ✅ Improved connection mapping
- ✅ Consistent labeling for groups

## Cost Impact

| Reasoning Level | Token Overhead | Recommended For |
|----------------|---------------|-----------------|
| none | Baseline (0%) | Testing/demos |
| low | +15-25% | Simple apps |
| **medium** | **+30-50%** | **Most production use** |
| high | +60-100% | Enterprise architectures |
| xhigh | +100-150% | Critical systems |

## When to Adjust

### Switch to `low` or `none` if:
- You're doing rapid prototyping
- Architecture has < 3 services
- Cost is a primary concern
- Speed is critical

### Switch to `high` if:
- Architecture has 15+ services
- Complex security/compliance requirements
- Multi-region deployments
- Hybrid cloud scenarios

### Switch to `xhigh` if:
- Mission-critical infrastructure
- Financial/healthcare systems
- Extensive regulatory requirements
- Zero-trust architectures

## Testing Different Levels

To test different reasoning levels, update your `.env` file:

```env
# Fast iteration
VITE_REASONING_EFFORT=low

# Recommended default
VITE_REASONING_EFFORT=medium

# Complex architectures
VITE_REASONING_EFFORT=high

# Maximum reasoning
VITE_REASONING_EFFORT=xhigh
```

Then restart your dev server:
```bash
npm run dev
```

## Technical Details

The reasoning parameter is passed to Azure OpenAI in `src/services/azureOpenAI.ts`:

```typescript
// Chat Completions API with 2025-04-01-preview
reasoning_effort: import.meta.env.VITE_REASONING_EFFORT || 'medium'
```

## API Version Requirement

⚠️ **Important**: The `reasoning_effort` parameter requires API version `2025-04-01-preview` or later.

The app is configured to use this API version.

## Testing

See `notebooks/reasoning_effort_test.ipynb` for comprehensive testing of all reasoning levels with both:
- Chat Completions API (`reasoning_effort` parameter)
- Responses API (`reasoning.effort` nested parameter)

## References

- [OpenAI GPT-5.2 Documentation](https://platform.openai.com/docs/guides/latest-model)
- [GPT-5.2 Reasoning Guide](https://platform.openai.com/docs/guides/reasoning)
- [Azure OpenAI Service Documentation](https://learn.microsoft.com/azure/ai-services/openai/)

---

**Last Updated:** January 14, 2026  
**Status:** ✅ Working with Azure OpenAI API version 2025-04-01-preview  
**Current Setting:** `medium` (recommended)
