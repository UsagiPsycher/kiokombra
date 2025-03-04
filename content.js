/**
 * Extract content from the current Notion page for Gherkin conversion.
 * Collects feature title, background steps, scenarios, comments, and tables.
 * Returns an object with title, background, scenarios, and comments.
 */
function extractPageContent() {
    try {
      const content = {
        title: [...document.querySelectorAll('h1')].at(-1).innerText,
        background: [],
        scenarios: [],
        comments: []
      };
      const pageContentElement = document.querySelector('.notion-page-content');
      if (!pageContentElement) return null;
  
      let currentSectionType = null;
      let activeScenario = null;
      let isFeatureSectionActive = false;
  
      // Process all content blocks on the Notion page
      pageContentElement.querySelectorAll('[data-block-id]').forEach(block => {
        const heading2Element = block.querySelector('h2');
        const heading3Element = block.querySelector('h3');
        const heading4Element = block.querySelector('h4');
        const tableElement = block.querySelector('.notion-table-block table');
        var quoteElement = block.classList.contains('notion-quote-block') ? block : null;
        var textElement = block.classList.contains('notion-text-block') ? block : null;
        var bulletElement = block.classList.contains('notion-bulleted_list-block') ? block : null;
  
        // Section detection in the Notion content
        if (heading2Element) {
          const headerText = heading2Element.innerText.trim();
          if (headerText === 'Feature') {
            // Entering the "Feature" section of the page
            isFeatureSectionActive = true;
          } else {
            // Leaving feature-related sections
            currentSectionType = null;
          }
        } else if (heading3Element && isFeatureSectionActive) {
          const newHeaderText = heading3Element.innerText.trim();
          if (newHeaderText === 'Background') {
            // Within Feature: start collecting "Background" steps
            currentSectionType = 'background';
          }
        } else if (heading4Element && isFeatureSectionActive) {
          // Within Feature: a new scenario section begins
          currentSectionType = 'scenario';
          activeScenario = {
            name: heading4Element.innerText.trim(),
            elements: [] // Track both steps and tables in order for this scenario
          };
          content.scenarios.push(activeScenario);
        }
  
        // Content processing for each block
        if (quoteElement) {
          // If a quote block is found, treat it as a comment (for Gherkin, as a commented step)
          const cleanedQuote = modifyText(quoteElement.innerText.trim());
          if (activeScenario) {
            // Attach comment to current scenario as a commented step
            activeScenario.elements.push({
              type: 'comment-step',
              content: cleanedQuote
            });
          } else {
            // If not in a scenario, add as a top-level comment (with two-space indent for Gherkin)
            content.comments.push(`  ${cleanedQuote}`);
          }
        } else if (textElement) {
          // If a regular text block is found
          const cleanedText = textElement.innerText
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove hyperlink formatting, keep text
            .replace(/\n/g, '')                       // Remove any newline characters
            .trim();
          if (currentSectionType === 'background') {
            // Add to Background section if within the background context (ignore section titles)
            if (!['Background', 'Scenarios'].includes(cleanedText)) {
              content.background.push(cleanedText);
            }
          } else if (activeScenario && cleanedText.match(/^(Given|When|Then|And)/i)) {
            // If in a scenario and text starts with a Gherkin step keyword, record it as a step
            activeScenario.elements.push({
              type: 'step',
              content: cleanedText
            });
          }
        } else if (tableElement && isFeatureSectionActive) {
          // If a table is found within a Feature section (likely part of a scenario or background)
          const rows = Array.from(tableElement.rows).map(row =>
            // Convert each table row into an array of trimmed cell text
            Array.from(row.cells).map(cell => cell.innerText.trim())
          );
          if (activeScenario) {
            // Attach the table (as a 2D array) to the current scenario's elements
            activeScenario.elements.push({
              type: 'table',
              content: rows
            });
          }
        } else if (bulletElement && bulletElement.innerText !== '') {
          // If a bullet list item is found (single bullet, treated as a one-column table in Gherkin)
          const monoTableRow = [["Elements"], [bulletElement.innerText.trim()]];
          // Create a single-column table with header 'Elements' and the bullet content as a row
          if (activeScenario) {
            // Attach this single-column table to the current scenario's elements
            activeScenario.elements.push({
              type: 'mono-table',
              content: monoTableRow
            });
          }
        }
      });
  
      return content;
    } catch (error) {
      // In case of extraction error, return null to indicate failure
      return null;
    }
  }
  
  /**
   * Format a text string from a Notion quote block for Gherkin output.
   * - Removes the first newline character.
   * - Adds two spaces after each remaining newline (for Gherkin comment indentation).
   */
  function modifyText(textElement) {
    // Remove the first newline character (if present)
    let firstNewlineIndex = textElement.indexOf('\n');
    if (firstNewlineIndex !== -1) {
      textElement = textElement.slice(0, firstNewlineIndex) + textElement.slice(firstNewlineIndex + 1);
    }
  
    // Prefix every newline in the text with two spaces (for nested comment formatting)
    textElement = textElement.replace(/\n/g, '\n  ');
  
    return textElement;
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getContent") {
      sendResponse(extractPageContent());
    }
  });
  