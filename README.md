# AI Blog Composer - Setup & Usage Guide

This MVP demonstrates a **lightweight proof of concept** for integrating with LLM providers (local Ollama or hosted OpenRouter). It implements a simple linear workflow that extracts metadata from a URL and uses an LLM to generate high-level concepts.

## Architecture Overview

The MVP implements a minimal, linear workflow:

```
Start → Metadata Extractor → Metadata Summarizer (LLM) → End
```

### Components

1. **Metadata Extractor** (`server/agents/metadataExtractor.ts`)
   - Deterministically extracts title and headings (h1-h3) from a URL
   - Uses `cheerio` for HTML parsing
   - No LLM involvement

2. **LLM Clients** (`server/agents/ollamaClient.ts`, `server/agents/openRouterClient.ts`)
  - Manages connections to supported LLM providers (local Ollama or hosted OpenRouter)
  - Uses OpenAI-compatible API formats where applicable
  - Local Ollama default endpoint: `http://localhost:11434`

3. **Metadata Summarizer** (`server/agents/metadataSummarizer.ts`)
  - LLM-powered agent using the configured provider (Ollama or OpenRouter)
   - Generates 5-7 high-level concepts from extracted metadata
   - Parses structured JSON responses

4. **Observer Workflow** (`server/agents/observerWorkflow.ts`)
   - Orchestrates the linear pipeline
   - Handles error management
   - Returns structured output

## Prerequisites

### 1. Install an LLM provider

This project supports multiple LLM providers. Two common options are listed below — pick the one that fits your needs.

Ollama (local)

Download and install Ollama from [ollama.ai](https://ollama.ai):

```bash
# macOS
brew install ollama

# Linux
curl https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

Pull a local model (example):

```bash
ollama pull llama2
# or
ollama pull mistral
```

Start the local Ollama server:

```bash
ollama serve
```

Default local endpoint: `http://localhost:11434`.

OpenRouter (hosted)

OpenRouter is a hosted API that allows you to call models over HTTP. To use it:

1. Sign up at OpenRouter and create an API key.
2. Configure the API key in your server environment (for example, in `.env`).

OpenRouter does not require pulling models locally — models are invoked via the API.

## Setup Instructions

### 1. Install Dependencies

```bash
cd /home/ubuntu/ai-blog-composer
pnpm install
```

### 2. Configure Environment (Optional)

Set custom provider configuration. Examples:

```bash
# For local Ollama
export OLLAMA_BASE_URL=http://localhost:11434

# For OpenRouter (hosted)
export OPENROUTER_API_KEY=your_api_key_here
```

### 3. Start Development Server

```bash
pnpm dev
```

The web server will start on `http://localhost:3000`.

## Usage

### Option 1: Web Interface

1. Open `http://localhost:3000` in your browser
2. Navigate to the workflow section
3. Enter a URL to analyze
4. Click "Execute Workflow"
5. View the extracted concepts

### Option 2: CLI Script

Run the test script directly:

```bash
node scripts/test-workflow.mjs https://example.com llama2
```

**Arguments:**
- `<url>` (required): The URL to analyze
- `[model]` (optional): The model to use (provider-specific, default: `llama2` for local Ollama)

**Example:**

```bash
node scripts/test-workflow.mjs https://www.wikipedia.org/wiki/Artificial_intelligence mistral
```

### Option 3: API Endpoint

Use the tRPC API directly:

```bash
curl -X POST http://localhost:3000/api/trpc/workflow.execute \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## API Reference

### `workflow.execute`

Execute the complete workflow for a given URL.

**Input:**
```typescript
{
  url: string; // Valid URL to analyze
}
```

**Output:**
```typescript
{
  url: string;
  metadata: {
    title: string;
    headings: string[];
  };
  concepts: {
    concepts: string[];
    summary: string;
  };
  status: 'success' | 'error';
  error?: string;
  executedAt: string;
}
```

### `workflow.health`

Check the configured LLM provider is reachable and the model is available.

**Output:**
```typescript
{
  status: 'healthy' | 'unhealthy' | 'error';
  message: string;
}
```

## Troubleshooting

### "LLM provider is not responding"

1. If using local Ollama: verify the server is running and the model is loaded:
  ```bash
  curl http://localhost:11434/api/tags
  ```

2. If using OpenRouter: verify your API key and that the OpenRouter service is reachable. Example (replace `API_KEY`):
  ```bash
  curl -H "Authorization: Bearer API_KEY" https://openrouter.ai/api/v1/models
  ```

3. Check the server or service logs for errors and ensure relevant env vars are set (e.g., `OLLAMA_BASE_URL` or `OPENROUTER_API_KEY`).

### "Model is not loaded"

If running a local Ollama instance, pull the required model:

```bash
ollama pull llama2
```

List available local models:

```bash
ollama list
```

For hosted providers (OpenRouter), select an available model via the API — you do not need to pull models locally.

### "Timeout waiting for LLM response"

- Increase the timeout in `server/agents/ollamaClient.ts` (currently 60 seconds)
- Use a faster model (e.g., `mistral` instead of `llama2`)
- Reduce the complexity of the input URL

### "Invalid JSON in response"

The LLM may not be returning properly formatted JSON. Try:

1. Using a different model
2. Adjusting the prompt in `server/agents/metadataSummarizer.ts`
3. Checking the configured provider's logs for errors

## File Structure

```
server/
  agents/
    metadataExtractor.ts      # URL metadata extraction
    ollamaClient.ts           # Local Ollama connection & API
    openRouterClient.ts       # OpenRouter hosted API client
    metadataSummarizer.ts     # LLM-powered concept extraction
    observerWorkflow.ts       # Main workflow orchestration
  routers.ts                  # tRPC API endpoints
scripts/
  test-workflow.mjs           # CLI test script
README.md                     # This file
```

## Success Criteria

The MVP is considered successful when:

- ✅ The project initializes and runs (with or without provider API keys, depending on configuration)
- ✅ The Metadata Summarizer connects to and receives responses from a configured LLM provider (local Ollama or OpenRouter)
- ✅ The end-to-end workflow executes linearly and terminates successfully
- ✅ Concepts are generated and returned in structured format

## Next Steps

After validating the MVP, you can:

1. **Add more agents** (Outline Generator, Draft Generator, etc.)
2. **Implement revision loops** for iterative content generation
3. **Add database persistence** for workflow results
4. **Build a full frontend UI** for content management
5. **Integrate additional LLM providers** (OpenAI, Anthropic, etc.)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL for local Ollama (if used) |
| `OPENROUTER_API_KEY` | | API key for OpenRouter (hosted) |
| `NODE_ENV` | `development` | Node environment |

## Performance Notes

- **Metadata Extraction**: ~1-3 seconds (depends on page size)
- **Concept Extraction**: ~5-30 seconds (depends on model size and complexity)
- **Total Workflow**: ~10-40 seconds

## License

This MVP is part of the Content Engine Demo project.

---

**Created:** November 16, 2025  
**Version:** 1.0  
**Status:** MVP Prototype
