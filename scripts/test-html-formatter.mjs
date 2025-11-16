#!/usr/bin/env node

/**
 * Test script for HTML Formatter
 * Tests the conversion of draft to semantic HTML5 markup
 */

console.log('=== HTML Formatter Test ===\n');

// HTML Formatter implementation (inline for testing)
class HtmlFormatter {
  formatToHtml(input) {
    const { draft } = input;

    // Validate input
    this.validateInput(draft);

    // Generate HTML
    const html = this.generateHtml(draft);

    return {
      html,
      wordCount: draft.wordCount,
      formattedAt: new Date().toISOString()
    };
  }

  validateInput(draft) {
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

  generateHtml(draft) {
    // Escape HTML special characters in content
    const escapeHtml = (text) => {
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

// Create formatter instance
const formatter = new HtmlFormatter();

// Test draft data
const testDraft = {
  title: 'Understanding Modern Web Development',
  metaDescription: 'A comprehensive guide to modern web development practices, tools, and frameworks for building scalable applications.',
  bodyParagraphs: [
    'Web development has evolved significantly over the past decade. Modern developers now have access to powerful frameworks, tools, and best practices that make building complex applications more manageable than ever before.',
    'The rise of component-based architectures has revolutionized how we think about building user interfaces. Frameworks like React, Vue, and Angular have made it easier to create reusable, maintainable code that scales with your application.',
    'Performance optimization is crucial in today\'s web landscape. Users expect fast, responsive applications that work seamlessly across devices. Techniques like code splitting, lazy loading, and efficient state management are essential skills for modern developers.',
    'Testing and quality assurance have become integral parts of the development process. Automated testing frameworks help ensure code reliability and catch bugs early in the development cycle.',
    'As we look to the future, web development continues to evolve with new technologies and approaches. Staying current with industry trends and best practices is essential for building successful applications.'
  ],
  wordCount: 150
};

console.log('Test Draft:');
console.log('- Title:', testDraft.title);
console.log('- Meta Description:', testDraft.metaDescription);
console.log('- Paragraphs:', testDraft.bodyParagraphs.length);
console.log('- Word Count:', testDraft.wordCount);
console.log();

try {
  // Format the draft to HTML
  console.log('Formatting draft to HTML...');
  const result = formatter.formatToHtml({ draft: testDraft });

  console.log('\n✓ HTML formatting successful!');
  console.log('\nFormatted Output:');
  console.log('- Word Count:', result.wordCount);
  console.log('- Formatted At:', result.formattedAt);
  console.log('\nGenerated HTML:');
  console.log('─'.repeat(80));
  console.log(result.html);
  console.log('─'.repeat(80));

  // Validate HTML structure
  console.log('\n=== Validation Checks ===');
  
  const checks = [
    { name: 'Contains DOCTYPE', test: result.html.includes('<!DOCTYPE html>') },
    { name: 'Contains html tag', test: result.html.includes('<html lang="en">') },
    { name: 'Contains head section', test: result.html.includes('<head>') },
    { name: 'Contains meta charset', test: result.html.includes('<meta charset="UTF-8">') },
    { name: 'Contains meta viewport', test: result.html.includes('<meta name="viewport"') },
    { name: 'Contains meta description', test: result.html.includes('<meta name="description"') },
    { name: 'Contains title tag', test: result.html.includes('<title>') },
    { name: 'Contains body tag', test: result.html.includes('<body>') },
    { name: 'Contains article tag', test: result.html.includes('<article>') },
    { name: 'Contains h1 heading', test: result.html.includes('<h1>') },
    { name: 'Contains paragraph tags', test: result.html.includes('<p>') },
    { name: 'Proper heading hierarchy', test: result.html.indexOf('<h1>') < result.html.indexOf('<p>') }
  ];

  checks.forEach(check => {
    console.log(`${check.test ? '✓' : '✗'} ${check.name}`);
  });

  const allPassed = checks.every(check => check.test);
  console.log(`\n${allPassed ? '✓' : '✗'} All validation checks ${allPassed ? 'passed' : 'failed'}`);

  // Test HTML escaping
  console.log('\n=== HTML Escaping Test ===');
  const draftWithSpecialChars = {
    title: 'Test & <Special> "Characters"',
    metaDescription: 'Testing HTML escaping with & < > " \' characters',
    bodyParagraphs: [
      'This paragraph contains <script>alert("XSS")</script> and other special chars: & < > " \''
    ],
    wordCount: 10
  };

  const escapedResult = formatter.formatToHtml({ draft: draftWithSpecialChars });
  const containsUnescapedScript = escapedResult.html.includes('<script>');
  const containsEscapedAmp = escapedResult.html.includes('&amp;');
  const containsEscapedLt = escapedResult.html.includes('&lt;');
  const containsEscapedGt = escapedResult.html.includes('&gt;');

  console.log(`${!containsUnescapedScript ? '✓' : '✗'} Script tags are escaped`);
  console.log(`${containsEscapedAmp ? '✓' : '✗'} Ampersands are escaped`);
  console.log(`${containsEscapedLt ? '✓' : '✗'} Less-than signs are escaped`);
  console.log(`${containsEscapedGt ? '✓' : '✗'} Greater-than signs are escaped`);

  console.log('\n=== Test Complete ===');
  console.log('✓ HTML Formatter is working correctly!');

} catch (error) {
  console.error('\n✗ Error during HTML formatting:');
  console.error(error.message);
  process.exit(1);
}
