import { DraftOutput } from './draftGenerator';

/**
 * Input interface for HTML formatting
 * Contains the approved draft to be converted to HTML
 */
export interface FormatterInput {
  draft: DraftOutput;
}

/**
 * Output interface for formatted HTML
 * Contains the final HTML output with metadata
 */
export interface FormatterOutput {
  html: string;
  wordCount: number;
  formattedAt: string;
}

/**
 * HTML Formatter
 * Converts approved drafts to production-ready HTML with semantic markup
 * Uses deterministic templating without LLM processing
 * Requirements: 9.1, 9.2, 9.3
 */
export class HtmlFormatter {
  /**
   * Format a draft into semantic HTML5 markup
   * @param input - Contains the draft to format
   * @returns HTML output with word count and timestamp
   */
  formatToHtml(input: FormatterInput): FormatterOutput {
    const { draft } = input;

    // Validate input
    this.validateInput(draft);

    // Generate HTML
    const html = this.generateHtml(draft);

    // Validate generated HTML structure
    // Requirements: 9.3, 9.4
    this.validateHtml(html);

    return {
      html,
      wordCount: draft.wordCount,
      formattedAt: new Date().toISOString()
    };
  }

  /**
   * Validate that the draft has all required fields
   */
  private validateInput(draft: DraftOutput): void {
    if (!draft.title || typeof draft.title !== 'string' || draft.title.trim().length === 0) {
      throw new Error('Draft must have a valid title');
    }

    if (!draft.metaDescription || typeof draft.metaDescription !== 'string' || draft.metaDescription.trim().length === 0) {
      throw new Error('Draft must have a valid meta description');
    }

    if (!Array.isArray(draft.bodyParagraphs) || draft.bodyParagraphs.length === 0) {
      throw new Error('Draft must have at least one body paragraph');
    }
  }

  /**
   * Validate HTML structure and required meta tags
   * Verifies proper HTML5 structure (html, head, body tags)
   * Checks for required meta tags (charset, viewport, description)
   * Requirements: 9.3, 9.4
   */
  private validateHtml(html: string): void {
    // Check for DOCTYPE declaration
    if (!html.includes('<!DOCTYPE html>')) {
      throw new Error('HTML validation failed: Missing DOCTYPE declaration');
    }

    // Check for required structural tags
    const requiredTags = [
      { tag: '<html', name: 'html' },
      { tag: '<head>', name: 'head' },
      { tag: '</head>', name: 'closing head' },
      { tag: '<body>', name: 'body' },
      { tag: '</body>', name: 'closing body' },
      { tag: '</html>', name: 'closing html' }
    ];

    for (const { tag, name } of requiredTags) {
      if (!html.includes(tag)) {
        throw new Error(`HTML validation failed: Missing required ${name} tag`);
      }
    }

    // Check for required meta tags
    const requiredMetaTags = [
      { pattern: /<meta charset="UTF-8">/, name: 'charset meta tag' },
      { pattern: /<meta name="viewport"/, name: 'viewport meta tag' },
      { pattern: /<meta name="description"/, name: 'description meta tag' }
    ];

    for (const { pattern, name } of requiredMetaTags) {
      if (!pattern.test(html)) {
        throw new Error(`HTML validation failed: Missing required ${name}`);
      }
    }

    // Check for title tag
    if (!/<title>.*<\/title>/.test(html)) {
      throw new Error('HTML validation failed: Missing or empty title tag');
    }

    // Verify proper tag order (head before body)
    const headIndex = html.indexOf('<head>');
    const bodyIndex = html.indexOf('<body>');
    if (headIndex === -1 || bodyIndex === -1 || headIndex > bodyIndex) {
      throw new Error('HTML validation failed: Invalid tag order (head must come before body)');
    }

    // Verify closing tags come after opening tags
    const htmlOpenIndex = html.indexOf('<html');
    const htmlCloseIndex = html.indexOf('</html>');
    if (htmlOpenIndex === -1 || htmlCloseIndex === -1 || htmlOpenIndex > htmlCloseIndex) {
      throw new Error('HTML validation failed: Invalid html tag structure');
    }
  }

  /**
   * Generate semantic HTML5 markup from draft
   * Implements proper heading hierarchy and meta tags
   * Requirements: 9.1, 9.2, 9.3
   */
  private generateHtml(draft: DraftOutput): string {
    // Escape HTML special characters in content
    const escapeHtml = (text: string): string => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const escapedTitle = escapeHtml(draft.title);
    const escapedMetaDescription = escapeHtml(draft.metaDescription);

    // Generate body paragraphs with proper semantic markup
    const bodyHtml = draft.bodyParagraphs
      .map(paragraph => `    <p>${escapeHtml(paragraph)}</p>`)
      .join('\n');

    // Build complete HTML document with semantic structure
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${escapedMetaDescription}">
  <title>${escapedTitle}</title>
</head>
<body>
  <article>
    <h1>${escapedTitle}</h1>
${bodyHtml}
  </article>
</body>
</html>`;
  }
}
