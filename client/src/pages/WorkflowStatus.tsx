import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  X,
  MessageSquare,
} from "lucide-react";
import { Textarea } from "../components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";
import { Label } from "../components/ui/label";

export default function WorkflowStatus() {
  const [location, setLocation] = useLocation();
  const { executionId } = useParams<{ executionId: string }>();
  // State for execution data and loading state
  const [execution, setExecution] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for approval UI
  const [approvalDecision, setApprovalDecision] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle resuming a workflow
  const handleResumeWorkflow = async (gate: 'concepts' | 'draft') => {
    if (!executionId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const response = await fetch(`http://localhost:3000/api/workflow/executions/${executionId}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gate,
          approved: approvalDecision === 'approve',
          comments: showComments ? comments : undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to resume workflow');
      }
      
      // Reset form state
      setApprovalDecision('approve');
      setComments('');
      setShowComments(false);
      
      // Refresh the execution state
      await fetchExecutionState();
    } catch (err) {
      console.error('Failed to resume workflow:', err);
      setSubmitError(err instanceof Error ? err.message : 'Failed to resume workflow');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle approval submission
  const handleApprovalSubmit = (gate: 'concepts' | 'draft') => {
    handleResumeWorkflow(gate);
  };

  // Fetch execution state
  const fetchExecutionState = async () => {
    if (!executionId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:3000/api/workflow/executions/${executionId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to fetch execution state');
      }
      
      const data = await response.json();
      setExecution(data.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch execution state:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch execution state');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up polling
  useEffect(() => {
    if (!executionId) return;
    
    // Initial fetch
    fetchExecutionState();
    
    // Set up interval for polling
    const intervalId = setInterval(fetchExecutionState, 3000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [executionId]);

  // Handle back to new article
  const handleBackToNewArticle = () => {
    setLocation("/new-article");
  };

  // Handle start new workflow
  const handleStartNewWorkflow = () => {
    setLocation("/new-article");
  };

  // Determine current status and render appropriate UI
  const renderStatusContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading workflow status...</p>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load workflow status: {error}
          </AlertDescription>
        </Alert>
      );
    }

    if (!execution) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Workflow execution not found
          </AlertDescription>
        </Alert>
      );
    }
    if (!execution) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Workflow execution not found</AlertDescription>
        </Alert>
      );
    }

    const { status, suspension } = execution;

    // Status display
    const renderStatus = () => {
      switch (status) {
        case "running":
          return (
            <div className="flex items-center gap-2 text-yellow-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Running...</span>
            </div>
          );
        case "suspended":
          return (
            <div className="flex items-center gap-2 text-orange-600">
              <Clock className="h-4 w-4" />
              <span>Suspended - Awaiting Approval</span>
            </div>
          );
        case "completed":
          return (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed Successfully</span>
            </div>
          );
        case "rejected":
          return (
            <div className="flex items-center gap-2 text-red-600">
              <X className="h-4 w-4" />
              <span>Rejected</span>
            </div>
          );
        case "failed":
          return (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Failed</span>
            </div>
          );
        default:
          return <span>{status}</span>;
      }
    };

    return (
      <div className="space-y-6">
        {/* Status Header */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Workflow Status</CardTitle>
            <CardDescription>Execution ID: {executionId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Status:</p>
                {renderStatus()}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Started:</p>
                <p className="text-sm">
                  {execution.input?.competitorUrl || "Unknown URL"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Suspended State - Approval UI */}
        {status === "suspended" && suspension && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                {suspension.stepId === "concepts" || suspension.stepId === "gate-concept-approval"
                  ? "Concept Approval"
                  : "Draft Approval"}
              </CardTitle>
              <CardDescription>
                Please review and approve or reject the{" "}
                {suspension.stepId === "concepts" || suspension.stepId === "gate-concept-approval" 
                  ? "concepts" 
                  : "draft"} below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display extracted concepts or draft content */}
              {(suspension.stepId === "concepts" || suspension.stepId === "gate-concept-approval") &&
                suspension.data?.concepts && (
                  <div>
                    {suspension.data.metadata?.title && (
                      <h3 className="text-lg font-medium mb-2">{suspension.data.metadata.title}</h3>
                    )}
                    <h4 className="font-semibold mb-2">Extracted Concepts:</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {Array.isArray(suspension.data.concepts) && suspension.data.concepts.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {suspension.data.concepts.map(
                            (concept: string, index: number) => (
                              <li key={index} className="text-sm">
                                {concept}
                              </li>
                            )
                          )}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500">No concepts were extracted from this content.</p>
                      )}
                    </div>
                  </div>
                )}

              {suspension.stepId === "draft" && suspension.data?.draft && (
                <div>
                  <h4 className="font-semibold mb-2">Generated Draft:</h4>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <div
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: suspension.data.draft,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Approval Decision */}
              <div className="space-y-4">
                <Label>Decision:</Label>
                <RadioGroup
                  value={approvalDecision}
                  onValueChange={(value: "approve" | "reject") =>
                    setApprovalDecision(value)
                  }
                  className="flex space-x-8"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="approve" id="approve" />
                    <Label htmlFor="approve" className="cursor-pointer">
                      Approve
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="reject" id="reject" />
                    <Label htmlFor="reject" className="cursor-pointer">
                      Reject
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Comments Section */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <Label
                    htmlFor="comments"
                    className="cursor-pointer"
                    onClick={() => setShowComments(!showComments)}
                  >
                    Add comments
                  </Label>
                </div>
                {showComments && (
                  <Textarea
                    id="comments"
                    placeholder="Enter your comments here..."
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    rows={4}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4">
                <Button
                  onClick={() => handleApprovalSubmit(
                    (suspension.stepId === "concepts" || suspension.stepId === "gate-concept-approval") ? "concepts" : "draft"
                  )}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Submit Approval</span>
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={handleBackToNewArticle}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
              
              {/* Show any submission errors */}
              {submitError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Completed State - Final Output */}
        {status === "completed" && execution.context?.finalOutput && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Final Output</CardTitle>
              <CardDescription>
                Workflow completed successfully. Here's the generated content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: execution.context.finalOutput,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {status === "failed" && execution.context?.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {execution.context.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Navigation Actions */}
        <div className="flex space-x-4 mt-6">
          <Button
            onClick={handleStartNewWorkflow}
            className="flex items-center space-x-2"
            variant="outline"
          >
            <Play className="h-4 w-4" />
            <span>Start New Workflow</span>
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleBackToNewArticle}
          >
            Back to New Article
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {renderStatusContent()}
      </div>
    </div>
  );
}
