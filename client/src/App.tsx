import { Route, Switch, useLocation } from 'wouter';
import React, { useEffect, useState } from 'react';
import WorkflowStatus from './pages/WorkflowStatus';

interface Model {
  name: string;
  model: string;
}

// Home component with URL input and submit button
function Home() {
  const [url, setUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState('phi4-mini-reasoning');
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState('');
  const [, setLocation] = useLocation();

  // Load available models on component mount
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }
        const data = await response.json();
        setAvailableModels(data.models || []);
        
        // Set default model if available
        if (data.models && data.models.length > 0) {
          const defaultModel = data.models.find((m: Model) => m.model === 'phi4-mini-reasoning') || data.models[0];
          setSelectedModel(defaultModel.model);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        setResult('Warning: Could not load models. Using default model.');
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

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
    
    // Ensure URL has http:// or https://
    const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    setIsSubmitting(true);
    setResult('');
    
    try {
      console.log('Sending request to /api/workflow/start', { 
        competitorUrl: formattedUrl,
        editorId: 'web-interface' 
      });
      
      const response = await fetch('/api/workflow/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          competitorUrl: formattedUrl,
          editorId: 'web-interface',
          model: selectedModel
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

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700">
              Select Model
            </label>
            <select
              id="model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              disabled={isSubmitting}
            >
              {availableModels.map((model) => (
                <option key={model.model} value={model.model}>
                  {model.name} {model.model === 'phi4-mini-reasoning' ? '(Recommended)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || !url || !selectedModel}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting || !url || !selectedModel
                  ? 'bg-blue-300 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isSubmitting ? 'Processing...' : 'Analyze URL'}
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
      <Route path="/" component={Home} />
      <Route path="/workflow/:executionId" component={WorkflowStatus} />
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
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Router />
      </div>
    </ErrorBoundary>
  );
}

export default App;
