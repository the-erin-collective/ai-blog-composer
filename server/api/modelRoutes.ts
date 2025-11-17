import express from 'express';
import axios from 'axios';

export const router = express.Router();

// Get available Ollama models
router.get('/models', async (req, res) => {
  try {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await axios.get(`${baseUrl}/api/tags`);
    const models = response.data.models || [];
    
    // Add the phi4-mini-reasoning model if not already in the list
    const defaultModels = [
      { name: 'phi4-mini-reasoning', model: 'phi4-mini-reasoning' },
      { name: 'llama2', model: 'llama2' },
      { name: 'mistral', model: 'mistral' },
    ];

    // Merge and deduplicate models
    const allModels = [
      ...defaultModels,
      ...models.map((m: any) => ({
        name: m.name,
        model: m.model || m.name
      }))
    ].filter((m, i, self) => 
      i === self.findIndex(t => t.name === m.name)
    );

    res.json({ models: allModels });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
