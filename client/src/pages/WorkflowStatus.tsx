import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  X,
  MessageSquare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function WorkflowStatus() {
  const [location, setLocation] = useLocation();
  const { executionId } = useParams<{ executionId: string }>();
  const utils = trpc.useUtils();

  // State for approval UI
  const [approvalDecision, setApprovalDecision] = useState<
    "approve" | "reject"
  >("approve");
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);

  // Query to get execution state
  const executionQuery = trpc.workflow.getExecutionState.useQuery(
    { executionId: executionId! },
    {
      enabled: !!executionId,
      refetchInterval: 3000, // Poll every 3 seconds
      refetchIntervalInBackground: true,
    }
  );

  // Mutation to resume workflow
  const resumeMutation = trpc.workflow.resume.useMutation({
    onSuccess: () => {
      // Invalidate and refetch the execution state
      utils.workflow.getExecutionState.invalidate({ executionId });
      // Reset form state
      setApprovalDecision("approve");
      setComments("");
      setShowComments(false);
    },
  });

  // Handle back to new article
  const handleBackToNewArticle = () => {
    setLocation("/new-article");
  };

  // Handle start new workflow
  const handleStartNewWorkflow = () => {
    setLocation("/new-article");
  };

  // Handle approval submission
  const handleApprovalSubmit = (gate: "concepts" | "draft") => {
    resumeMutation.mutate({
      executionId,
      resumeData: {
        gate,
        approved: approvalDecision === "approve",
        comments: showComments ? comments : undefined,
      },
    });
  };

  // Determine current status and render appropriate UI
  const renderStatusContent = () => {
    if (executionQuery.isLoading) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading workflow status...</p>
        </div>
      );
    }

    if (executionQuery.isError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load workflow status: {executionQuery.error.message}
          </AlertDescription>
        </Alert>
      );
    }

    const execution = executionQuery.data;
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
                {suspension.stepId === "concepts"
                  ? "Concept Approval"
                  : "Draft Approval"}
              </CardTitle>
              <CardDescription>
                Please review and approve or reject the{" "}
                {suspension.stepId === "concepts" ? "concepts" : "draft"} below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display extracted concepts or draft content */}
              {suspension.stepId === "concepts" &&
                suspension.data?.concepts && (
                  <div>
                    <h4 className="font-semibold mb-2">Extracted Concepts:</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      {Array.isArray(suspension.data.concepts) ? (
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
                        <p className="text-sm">{suspension.data.concepts}</p>
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
                  onClick={() =>
                    handleApprovalSubmit(
                      suspension.stepId === "concepts" ? "concepts" : "draft"
                    )
                  }
                  disabled={resumeMutation.isPending}
                  className="flex items-center space-x-2"
                >
                  {resumeMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Resume Workflow</span>
                    </>
                  )}
                </Button>
              </div>
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
        <div className="flex space-x-4">
          <Button
            onClick={handleStartNewWorkflow}
            className="flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>Start New Workflow</span>
          </Button>
          <Button variant="outline" onClick={handleBackToNewArticle}>
            Back to New Article
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">{renderStatusContent()}</div>
    </div>
  );
}
