import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { 
  Loader2, 
  CheckCircle2, 
  X, 
  Clock, 
  AlertCircle,
  Play,
  Edit3,
  Save,
  XCircle,
  MessageSquare
} from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useWorkflowWebSocket } from "../hooks/useWorkflowWebSocket";
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group";

export default function WorkflowStatus() {
  const [location, setLocation] = useLocation();
  const { executionId } = useParams<{ executionId: string }>();
  
  // State for approval UI
  const [approvalDecision, setApprovalDecision] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // State for editable concepts
  const [isEditingConcepts, setIsEditingConcepts] = useState(false);
  const [editableConcepts, setEditableConcepts] = useState<string[]>([]);
  
  // Use WebSocket hook for real-time updates
  const {
    execution,
    isLoading,
    error,
    resumeWorkflow,
  } = useWorkflowWebSocket(executionId || '');
  
  // Update editable concepts when execution data changes
  useEffect(() => {
    if (execution?.suspension?.data?.concepts) {
      setEditableConcepts([...execution.suspension.data.concepts]);
    }
  }, [execution?.suspension?.data?.concepts]);
  
  // Handle concept editing
  const handleConceptChange = (index: number, value: string) => {
    const newConcepts = [...editableConcepts];
    newConcepts[index] = value;
    setEditableConcepts(newConcepts);
  };
  
  const addConcept = () => {
    setEditableConcepts([...editableConcepts, '']);
  };
  
  const removeConcept = (index: number) => {
    const newConcepts = editableConcepts.filter((_, i) => i !== index);
    setEditableConcepts(newConcepts);
  };
  
  // Handle approval submission with loading state
  const handleApprovalSubmit = async (gate: 'concepts' | 'draft') => {
    if (!executionId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    const success = await resumeWorkflow(
      gate,
      approvalDecision === 'approve',
      showComments ? comments : undefined
    );
    
    if (success) {
      // Reset form state on success
      setApprovalDecision('approve');
      setComments('');
      setShowComments(false);
    }
    
    setIsSubmitting(false);
  };

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
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">Extracted Concepts:</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingConcepts(!isEditingConcepts)}
                        className="text-sm"
                      >
                        {isEditingConcepts ? (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Save
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-4 w-4 mr-1" />
                            Edit
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {isEditingConcepts ? (
                        <div className="space-y-2">
                          {editableConcepts.map((concept, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Input
                                value={concept}
                                onChange={(e) => handleConceptChange(index, e.target.value)}
                                className="flex-1 text-sm"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeConcept(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addConcept}
                            className="mt-2 text-sm"
                          >
                            + Add Concept
                          </Button>
                        </div>
                      ) : Array.isArray(suspension.data.concepts) && suspension.data.concepts.length > 0 ? (
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

              {(suspension.stepId === "draft" || suspension.stepId === "gate-draft-approval") && suspension.data?.draft && (
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
                <div>Decision:</div>
                <div className="flex space-x-8">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="approve"
                      name="decision"
                      value="approve"
                      checked={approvalDecision === "approve"}
                      onChange={() => setApprovalDecision("approve")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="approve" className="cursor-pointer">
                      Approve
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="reject"
                      name="decision"
                      value="reject"
                      checked={approvalDecision === "reject"}
                      onChange={() => setApprovalDecision("reject")}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="reject" className="cursor-pointer">
                      Reject
                    </label>
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <button
                    type="button"
                    className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900"
                    onClick={() => setShowComments(!showComments)}
                  >
                    Add comments
                  </button>
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
                  onClick={() => {
                    const gate = (suspension.stepId === "concepts" || suspension.stepId === "gate-concept-approval") ? "concepts" : "draft";
                    handleApprovalSubmit(gate);
                  }}
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
