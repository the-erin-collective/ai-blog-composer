# Ollama Integration MVP - Setup & Usage Guide

This MVP prototype demonstrates a **lightweight proof of concept** for validating integration with a **local Ollama LLM provider**. It implements a simple linear workflow that extracts metadata from a URL and uses Ollama to generate high-level concepts.

## Architecture Overview

The MVP implements a minimal, linear workflow:

```
Start → Metadata Extractor → Metadata Summarizer (Ollama) → End
```

### Components

1. **Metadata Extractor** (`server/agents/metadataExtractor.ts`)
   - Deterministically extracts title and headings (h1-h3) from a URL
   - Uses `cheerio` for HTML parsing
   - No LLM involvement

2. **Ollama Client** (`server/agents/ollamaClient.ts`)
   - Manages connection to local Ollama instance
   - Supports OpenAI-compatible API format
   - Default endpoint: `http://localhost:11434`

3. **Metadata Summarizer** (`server/agents/metadataSummarizer.ts`)
   - LLM-powered agent using Ollama
   - Generates 5-7 high-level concepts from extracted metadata
   - Parses structured JSON responses

4. **Observer Workflow** (`server/agents/observerWorkflow.ts`)
   - Orchestrates the linear pipeline
   - Handles error management
   - Returns structured output

## Prerequisites

### 1. Install Ollama

Download and install Ollama from [ollama.ai](https://ollama.ai):

```bash
# macOS
brew install ollama

# Linux
curl https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 2. Pull a Model

Pull a lightweight model (recommended: `llama2` or `mistral`):

```bash
ollama pull llama2
# or
ollama pull mistral
```

### 3. Start Ollama Server

```bash
ollama serve
```

The server will start on `http://localhost:11434` by default.

## Setup Instructions

### 1. Install Dependencies

```bash
cd /home/ubuntu/ollama-mvp-prototype
pnpm install
```

### 2. Configure Environment (Optional)

Set custom Ollama endpoint if not using default:

```bash
export OLLAMA_BASE_URL=http://localhost:11434
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
- `[ollama_model]` (optional): The Ollama model to use (default: `llama2`)

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

Check if Ollama is running and the model is available.

**Output:**
```typescript
{
  status: 'healthy' | 'unhealthy' | 'error';
  message: string;
}
```

## Troubleshooting

### "Ollama is not responding"

1. Verify Ollama is running:
   ```bash
   curl http://localhost:11434/api/tags
   ```

2. Check the Ollama server logs for errors

3. Ensure the correct base URL is set:
   ```bash
   export OLLAMA_BASE_URL=http://localhost:11434
   ```

### "Model is not loaded"

Pull the required model:

```bash
ollama pull llama2
```

List available models:

```bash
ollama list
```

### "Timeout waiting for LLM response"

- Increase the timeout in `server/agents/ollamaClient.ts` (currently 60 seconds)
- Use a faster model (e.g., `mistral` instead of `llama2`)
- Reduce the complexity of the input URL

### "Invalid JSON in response"

The LLM may not be returning properly formatted JSON. Try:

1. Using a different model
2. Adjusting the prompt in `server/agents/metadataSummarizer.ts`
3. Checking Ollama logs for errors

## File Structure

```
server/
  agents/
    metadataExtractor.ts      # URL metadata extraction
    ollamaClient.ts           # Ollama connection & API
    metadataSummarizer.ts     # LLM-powered concept extraction
    observerWorkflow.ts       # Main workflow orchestration
  routers.ts                  # tRPC API endpoints
scripts/
  test-workflow.mjs           # CLI test script
OLLAMA_MVP_README.md          # This file
```

## Success Criteria

The MVP is considered successful when:

- ✅ The project initializes and runs without external API keys
- ✅ The Metadata Summarizer connects to and receives responses from local Ollama
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
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Base URL for Ollama API |
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
