import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function NewArticle() {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [providers] = useState([
    { id: 'ollama', name: 'Ollama (Local)' },
    { id: 'openrouter', name: 'OpenRouter' }
  ]);
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("phi4-mini-reasoning");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [location, setLocation] = useLocation();

  // Fetch available models based on selected provider
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsModelsLoading(true);
        
        if (selectedProvider === 'ollama') {
          // Fetch Ollama models
          const response = await fetch('/api/workflow/models');
          
          if (!response.ok) {
            throw new Error('Failed to fetch Ollama models');
          }
          
          const data = await response.json();
          if (data.success && data.data?.models) {
            setModels(data.data.models);
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
          setModels([]);
          setSelectedModel("");
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        // Fallback to default model list for Ollama
        if (selectedProvider === 'ollama') {
          setModels(['phi4-mini-reasoning', 'gemma3:270m', 'llama2', 'mistral']);
          setSelectedModel('phi4-mini-reasoning');
        } else {
          setModels([]);
          setSelectedModel("");
        }
      } finally {
        setIsModelsLoading(false);
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
          setModels(data.data.models);
          if (data.data.models.length > 0) {
            setSelectedModel(data.data.models[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch OpenRouter models:', error);
        setSubmitError(error instanceof Error ? error : new Error('Failed to fetch OpenRouter models'));
        setModels([]);
        setSelectedModel("");
      } finally {
        setIsModelsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchOpenRouterModels, 500); // Debounce API calls
    return () => clearTimeout(timeoutId);
  }, [selectedProvider, apiKey]);

  const executeWorkflow = async (url: string) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('/api/workflow/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inspirationUrl: url,
          editorId: 'web-interface',
          model: selectedModel,
          provider: selectedProvider,
          apiKey: selectedProvider === 'openrouter' ? apiKey : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to start workflow');
      }

      const data = await response.json();
      console.log('API Response:', data);
      if (data.data?.executionId) {
        const execId = data.data.executionId;
        console.log('Setting execution ID and showing success');
        setExecutionId(execId);
        setShowSuccess(true);
        
        // Redirect to workflow status page after a short delay
        const redirectPath = `/workflow/${execId}`;
        console.log('Will redirect to:', redirectPath);
        
        setTimeout(() => {
          console.log('Attempting to navigate to:', redirectPath);
          setLocation(redirectPath);
        }, 1000);
      } else {
        console.error('No execution ID in response:', data);
      }
    } catch (error) {
      console.error('Failed to start workflow:', error);
      setSubmitError(error instanceof Error ? error : new Error('Failed to start workflow'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateUrl = (value: string): boolean => {
    if (!value.trim()) {
      setUrlError("URL is required");
      return false;
    }

    try {
      new URL(value);
      setUrlError("");
      return true;
    } catch {
      setUrlError("Please enter a valid URL (e.g., https://example.com)");
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateUrl(url)) {
      return;
    }

    // Validate API key for OpenRouter
    if (selectedProvider === 'openrouter' && !apiKey.trim()) {
      setSubmitError(new Error('API key is required for OpenRouter provider'));
      return;
    }

    executeWorkflow(url);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);
    
    // Clear error when user starts typing
    if (urlError) {
      setUrlError("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Create New Article</CardTitle>
          <CardDescription>
            Enter an inspiration URL to start the content generation pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">Inspiration URL</Label>
              <Input
                id="url"
                type="text"
                placeholder="https://example.com/article"
                value={url}
                onChange={handleUrlChange}
                disabled={isSubmitting}
                className={urlError ? "border-red-500" : ""}
              />
              {urlError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {urlError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedProvider === 'openrouter' && (
              <div className="space-y-2">
                <Label htmlFor="apiKey">OpenRouter API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your OpenRouter API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-sm text-gray-500">
                  Your API key is stored only in memory and never saved to disk.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="model">LLM Model</Label>
              {isModelsLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading models...</span>
                </div>
              ) : models.length === 0 && selectedProvider === 'openrouter' && !apiKey.trim() ? (
                <div className="text-gray-500 p-2 border border-gray-300 rounded-md">
                  Enter your OpenRouter API key to see available models
                </div>
              ) : models.length === 0 ? (
                <div className="text-gray-500 p-2 border border-gray-300 rounded-md">
                  No models available
                </div>
              ) : (
                <select
                  id="model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isSubmitting || (selectedProvider === 'openrouter' && !apiKey.trim())}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {submitError.message}
                </AlertDescription>
              </Alert>
            )}

            {showSuccess && executionId && (
              <Alert className="border-green-500 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <p>Pipeline started successfully! Redirecting to workflow status...</p>
                  <p className="text-xs mt-1">Execution ID: {executionId}</p>
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isModelsLoading || (selectedProvider === 'openrouter' && (!apiKey.trim() || !selectedModel))}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Start Pipeline"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}