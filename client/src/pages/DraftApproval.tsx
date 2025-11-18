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
import { Textarea } from "../components/ui/textarea";
import { 
  Loader2, 
  CheckCircle2, 
  X, 
  MessageSquare
} from "lucide-react";
import { Alert, AlertDescription } from "../components/ui/alert";
import { useWorkflowWebSocket } from "../hooks/useWorkflowWebSocket";

export default function DraftApproval() {
  const [location, setLocation] = useLocation();
  const { executionId } = useParams<{ executionId: string }>();
  
  // State for approval UI
  const [approvalDecision, setApprovalDecision] = useState<"approve" | "reject">("approve");
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Use WebSocket hook for real-time updates
  const {
    execution,
    isLoading,
    error,
    resumeWorkflow,
  } = useWorkflowWebSocket(executionId || '');
  
  // Handle approval submission with loading state
  const handleApprovalSubmit = async () => {
    if (!executionId) return;
    
    setIsSubmitting(true);
    setSubmitError(null);
    
    const success = await resumeWorkflow(
      'draft',
      approvalDecision === 'approve',
      showComments ? comments : undefined
    );
    
    if (success) {
      // Reset form state on success
      setApprovalDecision('approve');
      setComments('');
      setShowComments(false);
      
      // Redirect back to workflow status page to show the result
      setLocation(`/workflow/${executionId}`);
    }
    
    setIsSubmitting(false);
  };

  // Handle back to workflow status
  const handleBackToWorkflow = () => {
    if (executionId) {
      setLocation(`/workflow/${executionId}`);
    } else {
      setLocation("/new-article");
    }
  };

  // Determine current status and render appropriate UI
  const renderStatusContent = () => {
    if (isLoading) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading draft for approval...</p>
        </div>
      );
    }

    if (error) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load draft for approval: {error}
          </AlertDescription>
        </Alert>
      );
    }

    if (!execution) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Workflow execution not found
          </AlertDescription>
        </Alert>
      );
    }

    const { status, suspension } = execution;
    
    // Check if we're at the right suspension point
    if (status !== "suspended" || !suspension || suspension.stepId !== "gate-draft-approval") {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            Workflow is not suspended at draft approval gate
          </AlertDescription>
        </Alert>
      );
    }

    const draftData = suspension.data?.draft;
    
    if (!draftData) {
      return (
        <Alert variant="destructive">
          <AlertDescription>
            No draft data found for approval
          </AlertDescription>
        </Alert>
      );
    }

    // Status display
    const renderStatus = () => {
      switch (status) {
        case "suspended":
          return (
            <div className="flex items-center gap-2 text-orange-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Suspended - Awaiting Draft Approval</span>
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
            <CardTitle className="text-xl">Draft Approval</CardTitle>
            <CardDescription>Execution ID: {executionId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Status:</p>
                {renderStatus()}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Source URL:</p>
                <p className="text-sm">
                  {execution.input?.inspirationUrl || "Unknown URL"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Draft Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Generated Draft</CardTitle>
            <CardDescription>
              Please review the generated draft and approve or reject it below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">{draftData.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{draftData.metaDescription}</p>
              <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {draftData.bodyParagraphs?.map((paragraph: string, index: number) => (
                    <p key={index} className="text-sm">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Approval Decision */}
            <div className="space-y-4">
              <div className="font-medium">Decision:</div>
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
                onClick={handleApprovalSubmit}
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
                    <span>Submit Decision</span>
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={handleBackToWorkflow}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
            
            {/* Show any submission errors */}
            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {renderStatusContent()}
      </div>
    </div>
  );
}