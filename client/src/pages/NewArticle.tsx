import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function NewArticle() {
  const [, setLocation] = useLocation();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const executeMutation = trpc.workflow.execute.useMutation({
    onSuccess: (data) => {
      // Navigate to workflow status page with execution ID
      if (data.executionId) {
        setLocation(`/workflow/${data.executionId}`);
      }
    },
  });

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

    executeMutation.mutate({ url });
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
                disabled={executeMutation.isPending}
                className={urlError ? "border-red-500" : ""}
              />
              {urlError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {urlError}
                </p>
              )}
            </div>

            {executeMutation.error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {executeMutation.error.message}
                </AlertDescription>
              </Alert>
            )}

            {executeMutation.isSuccess && (
              <Alert className="border-green-500 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Pipeline started successfully! Execution ID: {executeMutation.data.executionId}
                </AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Pipeline...
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
