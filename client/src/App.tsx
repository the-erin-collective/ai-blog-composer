import { Route, Switch, useLocation } from 'wouter';
import React, { useEffect, useState } from 'react';
import WorkflowStatus from './pages/WorkflowStatus';
import DraftApproval from './pages/DraftApproval';
import NewArticle from './pages/NewArticle';
import GlobalWebSocketListener from './components/GlobalWebSocketListener';

interface Model {
  name: string;
  model: string;
}

// Home component with URL input and submit button
function Home() {
  const [url, setUrl] = useState('');
  const [providers] = useState([
    { id: 'ollama', name: 'Ollama (Local)' },
    { id: 'openrouter', name: 'OpenRouter' }
  ]);
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState("");
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('phi4-mini-reasoning');
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState('');
  const [, setLocation] = useLocation();

  // Fetch available models based on selected provider
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsModelsLoading(true);
        
        if (selectedProvider === 'ollama') {
          // Fetch models from local Ollama (for hosted models, use OpenRouter provider)
          const response = await fetch('/api/workflow/models');
          
          if (!response.ok) {
            throw new Error('Failed to fetch models from local Ollama (use OpenRouter provider for hosted models)');
          }
          
          const data = await response.json();
          if (data.success && data.data?.models) {
            setAvailableModels(data.data.models.map((model: string) => ({ name: model, model })));
            // Set default model if it exists in the list
            if (data.data.models.includes('phi4-mini-reasoning')) {
              setSelectedModel('phi4-mini-reasoning');
            } else if (data.data.models.length > 0) {
              setSelectedModel(data.data.models[0]);
            }
          }
        } else if (selectedProvider === 'openrouter') {
          // For OpenRouter, we'll set a default list and let the backend fetch the actual models
          // when the user provides an API key
          setAvailableModels([]);
          setSelectedModel("");
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        // Fallback to default model list for local Ollama (for hosted models, use OpenRouter provider)
        if (selectedProvider === 'ollama') {
          setAvailableModels([
            { name: 'phi4-mini-reasoning', model: 'phi4-mini-reasoning' },
            { name: 'gemma3:270m', model: 'gemma3:270m' },
            { name: 'llama2', model: 'llama2' },
            { name: 'mistral', model: 'mistral' }
          ]);
          setSelectedModel('phi4-mini-reasoning');
        } else {
          setAvailableModels([]);
          setSelectedModel("");
        }
      } finally {
        setIsModelsLoading(false);
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, [selectedProvider]);

  // Fetch OpenRouter models when API key is provided
  useEffect(() => {
    const fetchOpenRouterModels = async () => {
      if (selectedProvider !== 'openrouter' || !apiKey.trim()) {
        return;
      }

      try {
        setIsModelsLoading(true);
        const response = await fetch('/api/workflow/openrouter-models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to fetch OpenRouter models');
        }

        const data = await response.json();
        if (data.success && data.data?.models) {
          setAvailableModels(data.data.models.map((model: string) => ({ name: model, model })));
          if (data.data.models.length > 0) {
            setSelectedModel(data.data.models[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error);
        setResult(`Error: ${error instanceof Error ? error.message : 'Failed to fetch OpenRouter models'}`);
        setAvailableModels([]);
        setSelectedModel("");
      } finally {
        setIsModelsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchOpenRouterModels, 500); // Debounce API calls
    return () => clearTimeout(timeoutId);
  }, [selectedProvider, apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setResult('Please enter a URL');
      return;
    }
    
    if (!selectedModel) {
      setResult('Please select a model');
      return;
    }
    
    // Validate API key for OpenRouter
    if (selectedProvider === 'openrouter' && !apiKey.trim()) {
      setResult('API key is required for OpenRouter provider');
      return;
    }
    
    // Ensure URL has http:// or https://
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    setIsSubmitting(true);
    setResult('');
    
    try {
      console.log('Sending request to /api/workflow/start', { 
        inspirationUrl: formattedUrl,
        editorId: 'web-interface',
        model: selectedModel,
        provider: selectedProvider,
        apiKey: selectedProvider === 'openrouter' ? apiKey : undefined,
      });
      
      const response = await fetch('/api/workflow/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          inspirationUrl: formattedUrl,
          editorId: 'web-interface',
          model: selectedModel,
          provider: selectedProvider,
          apiKey: selectedProvider === 'openrouter' ? apiKey : undefined,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response not OK:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Response from server:', data);
      
      if (data.data?.executionId) {
        // Navigate to the workflow status page
        setLocation(`/workflow/${data.data.executionId}`);
      } else {
        setResult(data.message || 'URL processing started successfully');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error processing URL';
      setResult(`Error: ${errorMessage}`);
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingModels) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-8">Content Analysis Tool</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700">
              Enter URL to analyze
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Provider Selection */}
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
              Provider
            </label>
            <select
              id="provider"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              disabled={isSubmitting}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Input for OpenRouter */}
          {selectedProvider === 'openrouter' && (
            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                OpenRouter API Key
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your OpenRouter API key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isSubmitting}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your API key is stored only in memory and never saved to disk.
                </p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700">
              Select Model
            </label>
            {isModelsLoading ? (
              <div className="mt-1 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-600">Loading models...</span>
              </div>
            ) : availableModels.length === 0 && selectedProvider === 'openrouter' && !apiKey.trim() ? (
              <div className="mt-1 p-2 text-sm text-gray-500 border border-gray-300 rounded-md">
                Enter your OpenRouter API key to see available models
              </div>
            ) : availableModels.length === 0 ? (
              <div className="mt-1 p-2 text-sm text-gray-500 border border-gray-300 rounded-md">
                No models available
              </div>
            ) : (
              <select
                id="model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                disabled={isSubmitting || (selectedProvider === 'openrouter' && !apiKey.trim())}
              >
                {availableModels.map((model) => (
                  <option key={model.model} value={model.model}>
                    {model.name} {model.model === 'phi4-mini-reasoning' ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || isModelsLoading || (selectedProvider === 'openrouter' && (!apiKey.trim() || !selectedModel))}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting || isModelsLoading || (selectedProvider === 'openrouter' && (!apiKey.trim() || !selectedModel))
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : 'Analyze URL'}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h3 className="text-sm font-medium text-gray-900">
              {result.startsWith('Error') ? 'Error' : 'Status'}:
            </h3>
            <p className={`mt-1 text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-gray-600'}`}>
              {result}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Router component with all routes
function Router() {
  const [location] = useLocation();
  
  // Log route changes for debugging
  useEffect(() => {
    console.log('Route changed to:', location);
  }, [location]);
  
  return (
    <Switch>
      <Route path="/new-article" component={NewArticle} />
      <Route path="/" component={Home} />
      <Route path="/workflow/:executionId" component={WorkflowStatus} />
      <Route path="/draft-approval/:executionId" component={DraftApproval} />
      <Route>404, Not Found! {location}</Route>
    </Switch>
  );
}

// Simple Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-500">Something went wrong. Please refresh the page.</div>;
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <GlobalWebSocketListener />
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Router />
      </div>
    </ErrorBoundary>
  );
}

export default App;
