import { useState } from "react";
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<Error | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [location, setLocation] = useLocation(); // Make sure this is at the top with other hooks

  const executeWorkflow = async (url: string) => {
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch('http://localhost:3000/api/workflow/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          competitorUrl: url,
          editorId: 'web-interface',
          model: 'phi4-mini-reasoning', // Default model
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
            Enter a competitor URL to start the content generation pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="url">Competitor URL</Label>
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
              disabled={isSubmitting}
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
