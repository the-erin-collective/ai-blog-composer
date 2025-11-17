# Requirements Document

## Introduction

This document defines the requirements for a code demonstration of the Observer-Orchestrated Content Engine, a hub-and-spoke agentic system that generates original, SEO-optimized article drafts from competitor metadata. The demo will showcase the core workflow including metadata extraction, LLM-powered content generation, human-in-the-loop approval gates, and quality assurance mechanisms. The system emphasizes IP compliance, editorial control, and measurable quality metrics.

## Glossary

- **Observer Agent**: The central orchestration agent (hub) that manages pipeline state and routes execution through specialized spokes
- **Spoke Agent**: A specialized agent or tool that performs a specific task in the content generation pipeline
- **Human Gate**: A suspension point in the workflow where human approval is required before proceeding
- **Pipeline State**: The current execution status and data of a content generation workflow
- **Metadata**: Publicly visible HTML elements (title, headings, meta tags) extracted from competitor content, excluding body content
- **Distinctiveness Score**: A cosine distance metric (0-1 scale) measuring originality against competitor metadata
- **VoltAgent**: The TypeScript-first agent framework used for workflow orchestration and execution
- **Content Pipeline**: The complete workflow from competitor URL input to published article output

## Requirements

### Requirement 1

**User Story:** As an editor, I want to initiate a content generation pipeline by providing a competitor URL, so that the system can begin creating an original article based on competitor topics.

#### Acceptance Criteria

1. WHEN the editor submits a competitor URL, THE Content Pipeline SHALL initialize a new pipeline execution with a unique execution ID
2. THE Content Pipeline SHALL validate that the provided URL is accessible and returns valid HTML content
3. WHEN initialization succeeds, THE Content Pipeline SHALL store the pipeline state with status "INITIALIZED"
4. THE Content Pipeline SHALL return the execution ID to the editor within 2 seconds of submission
5. IF the URL is invalid or inaccessible, THEN THE Content Pipeline SHALL return an error message describing the validation failure

### Requirement 2

**User Story:** As the system, I want to extract only safe metadata from competitor pages, so that I maintain IP compliance by avoiding expressive body content.

#### Acceptance Criteria

1. WHEN the Metadata Extractor receives a competitor URL, THE Metadata Extractor SHALL retrieve only HTML title, meta description, and heading tags (h1-h3)
2. THE Metadata Extractor SHALL exclude all body paragraph content, article text, and expressive content from extraction
3. THE Metadata Extractor SHALL parse the HTML using deterministic parsing tools without LLM processing
4. WHEN extraction completes, THE Metadata Extractor SHALL return structured metadata as a JSON object
5. THE Metadata Extractor SHALL complete extraction within 5 seconds for standard web pages

### Requirement 3

**User Story:** As the system, I want to abstract competitor metadata into key concepts, so that I create a legal abstraction layer that informs topic selection without copying expression.

#### Acceptance Criteria

1. WHEN the Metadata Summarizer receives extracted metadata, THE Metadata Summarizer SHALL generate 5-7 high-level concept strings
2. THE Metadata Summarizer SHALL use a lightweight LLM model to identify themes and topics from metadata
3. THE Metadata Summarizer SHALL produce concepts that describe "what" topics are covered, not "how" they are expressed
4. THE Metadata Summarizer SHALL return concepts as a JSON array of strings
5. WHEN summarization completes, THE Content Pipeline SHALL update pipeline state to "OUTLINE_PENDING_APPROVAL"

### Requirement 4

**User Story:** As an editor, I want to review and approve extracted concepts before content generation begins, so that I maintain editorial control and ensure IP compliance.

#### Acceptance Criteria

1. WHEN the pipeline reaches concept approval state, THE Observer Agent SHALL suspend workflow execution
2. THE Observer Agent SHALL expose the extracted concepts and execution ID through the workflow state API
3. THE Content Pipeline SHALL wait indefinitely for editor approval without timing out
4. WHEN the editor submits approval with "approved: true", THE Observer Agent SHALL resume workflow execution from the suspension point
5. IF the editor submits rejection with "approved: false", THEN THE Observer Agent SHALL terminate the pipeline execution with status "REJECTED"

### Requirement 5

**User Story:** As the system, I want to generate a structured article outline from approved concepts, so that I create a blueprint for the final draft that follows SEO guidelines.

#### Acceptance Criteria

1. WHEN the Outline Generator receives approved concepts, THE Outline Generator SHALL create a structured outline with introduction, main sections, and conclusion
2. THE Outline Generator SHALL use a high-fidelity generation LLM model for outline creation
3. THE Outline Generator SHALL incorporate SEO best practices including keyword placement and heading hierarchy
4. THE Outline Generator SHALL return the outline as a structured JSON object with section titles and key points
5. WHEN outline generation completes, THE Content Pipeline SHALL update pipeline state to "OUTLINE_GENERATED"

### Requirement 6

**User Story:** As the system, I want to generate a full article draft from the approved outline, so that I produce high-quality, original long-form content.

#### Acceptance Criteria

1. WHEN the Draft Generator receives the outline, THE Draft Generator SHALL produce a complete article with introduction, body paragraphs, and conclusion
2. THE Draft Generator SHALL use a high-fidelity generation LLM model optimized for long-form content
3. THE Draft Generator SHALL maintain consistent tone and style throughout the article
4. THE Draft Generator SHALL generate content that is structurally and conceptually distinct from the competitor source
5. WHEN draft generation completes, THE Content Pipeline SHALL route the draft to the Reviewer Agent

### Requirement 7

**User Story:** As the system, I want to automatically review draft quality and originality, so that I ensure high standards before human review.

#### Acceptance Criteria

1. WHEN the Reviewer Agent receives a draft, THE Reviewer Agent SHALL generate a quality score from 0 to 100
2. THE Reviewer Agent SHALL provide structured critique in JSON format including score and comments
3. WHEN the Similarity Monitor receives a draft, THE Similarity Monitor SHALL compute a distinctiveness score against competitor metadata embeddings
4. THE Similarity Monitor SHALL use cosine distance calculation to measure originality on a 0-1 scale
5. IF the quality score is below 80 OR the distinctiveness score is below 0.7, THEN THE Observer Agent SHALL route the draft back to the Draft Generator for revision

### Requirement 8

**User Story:** As an editor, I want to review and approve the final draft before publication, so that I maintain editorial control over tone, accuracy, and brand fit.

#### Acceptance Criteria

1. WHEN the draft passes automated quality checks, THE Observer Agent SHALL suspend workflow execution at the draft approval gate
2. THE Observer Agent SHALL expose the draft content, quality score, and distinctiveness score through the workflow state API
3. THE Content Pipeline SHALL wait indefinitely for editor approval without timing out
4. WHEN the editor submits approval with "approved: true", THE Observer Agent SHALL resume workflow execution to finalization
5. IF the editor submits rejection with "approved: false", THEN THE Observer Agent SHALL route the draft back to the Draft Generator with editor comments

### Requirement 9

**User Story:** As the system, I want to format approved drafts into production-ready HTML, so that I deliver semantic, clean markup for publication.

#### Acceptance Criteria

1. WHEN the HTML Formatter receives an approved draft, THE HTML Formatter SHALL convert the draft structure to semantic HTML5 markup
2. THE HTML Formatter SHALL use deterministic templating without LLM processing
3. THE HTML Formatter SHALL include proper heading hierarchy, paragraph tags, and meta elements
4. THE HTML Formatter SHALL complete formatting within 1 second
5. WHEN formatting completes, THE Content Pipeline SHALL update pipeline state to "COMPLETED" with the final HTML output

### Requirement 10

**User Story:** As a developer, I want to interact with the content pipeline through a REST API, so that I can integrate the system with frontend applications and editorial tools.

#### Acceptance Criteria

1. THE VoltAgent Server SHALL expose a POST endpoint at "/workflows/content-pipeline/execute" to start new pipeline executions
2. THE VoltAgent Server SHALL expose a GET endpoint at "/workflows/content-pipeline/executions/{executionId}/state" to retrieve pipeline state
3. THE VoltAgent Server SHALL expose a POST endpoint at "/workflows/content-pipeline/executions/{executionId}/resume" to resume suspended workflows
4. WHEN a workflow is suspended, THE VoltAgent Server SHALL include suspension reason and step ID in the state response
5. THE VoltAgent Server SHALL return appropriate HTTP status codes (200 for success, 400 for validation errors, 404 for not found)

### Requirement 11

**User Story:** As an editor, I want to view the pipeline status and approval gates in a web interface, so that I can easily review and approve content at each human gate.

#### Acceptance Criteria

1. THE Frontend Application SHALL provide a form to submit competitor URLs and start new pipelines
2. THE Frontend Application SHALL display the current pipeline status including execution ID and workflow state
3. WHEN a pipeline is suspended at concept approval, THE Frontend Application SHALL display extracted concepts with approve/reject options
4. WHEN a pipeline is suspended at draft approval, THE Frontend Application SHALL display the draft content, quality score, and distinctiveness score with approve/reject options
5. THE Frontend Application SHALL poll the workflow state API every 3 seconds to update the displayed status

### Requirement 12

**User Story:** As a system administrator, I want to track pipeline metrics and costs, so that I can monitor system performance and optimize resource usage.

#### Acceptance Criteria

1. THE Observer Agent SHALL log all LLM API calls with token counts and estimated costs
2. THE Observer Agent SHALL track the total time from pipeline initialization to completion
3. THE Observer Agent SHALL record quality scores, distinctiveness scores, and human approval decisions
4. THE Observer Agent SHALL maintain an audit log of all state transitions and tool calls
5. WHERE cost tracking is enabled, THE Observer Agent SHALL alert when a single pipeline exceeds $15.00 in LLM costs
