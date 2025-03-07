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
      let isRecordingEnabled = false;
      let monoTableHeader = "Elements";
  
      // Process all content blocks on the Notion page
      pageContentElement.querySelectorAll('[data-block-id]').forEach(block => {
        const heading2Element = block.querySelector('h2');
        const heading3Element = block.querySelector('h3');
        const heading4Element = block.querySelector('h4');

        let tableParentElement = block.classList.contains('notion-table-block') ? block : null;
        let quoteElement = block.classList.contains('notion-quote-block') ? block : null;
        let textElement = block.classList.contains('notion-text-block') ? block : null;
        let bulletElement = block.classList.contains('notion-bulleted_list-block') ? block : null;
  
        // Section detection in the Notion content
        if (heading2Element) {
          const heading2Text = heading2Element.innerText.trim().toLowerCase();

          switch (heading2Text) {
            case 'feature':
            case 'user story':
              isRecordingEnabled = true;
              break;
            default:
              isRecordingEnabled = false;
          }

        } else if (heading3Element && isRecordingEnabled) {
            const heading3Text = heading3Element.innerText.trim().toLowerCase();

            switch (heading3Text) {
              case 'background':
                currentSectionType = 'background';
                break;
              case 'scenarios':
                currentSectionType = 'scenarios';
                break;
              default:
                currentSectionType = null;
            }

        } else if (heading4Element && isRecordingEnabled && currentSectionType == 'scenarios') {
            // Within Feature: a new scenario section begins

            activeScenario = {
              name: heading4Element.innerText.trim(),
              elements: [] // Track both steps and tables in order for this scenario
            };
            content.scenarios.push(activeScenario);
        }
  
        // Content processing for each block
        if (quoteElement) {
          // If a quote block is found, treat it as a comment (for Gherkin, as a commented step)
          const cleanedQuote = cleanBlockquoteText(quoteElement);
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
              // Add to Background section if within the background context
              content.background.push(cleanedText);
            }

            else if (currentSectionType === 'scenarios' && activeScenario && cleanedText.match(/^(Given|When|Then|And)/i)) {
              // If in a scenario and text starts with a Gherkin step keyword, record it as a step
              activeScenario.elements.push({
                type: 'step',
                content: cleanedText
              });

              monoTableHeader = extractMonoTableHeader(cleanedText)
            }
          }

          else if (tableParentElement && isRecordingEnabled) {
            // If a table is found within a Feature section (likely part of a scenario or background)
            const tableElement = tableParentElement.querySelector('table');
            const rows = Array.from(tableElement.rows).map(row =>
              // Convert each table row into an array of trimmed cell text
              Array.from(row.cells).map(cell => cell.innerText.trim())
            );

            if (currentSectionType === 'scenarios' && activeScenario) {
              // Attach the table (as a 2D array) to the current scenario's elements
              activeScenario.elements.push({
                type: 'table',
                content: rows
              });
            }
          }

          else if (bulletElement && bulletElement.innerText !== '') {
          // If a bullet list item is found (single bullet, treated as a one-column table in Gherkin)
          const monoTableRow = [[monoTableHeader], [bulletElement.innerText.trim()]];
          // Create a single-column table with header 'Elements' and the bullet content as a row
          if (currentSectionType === 'scenarios' && activeScenario) {
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

function getCleanText(node) {
  let result = '';

  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      // Just add the text directly
      result += child.textContent;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();
      
      // Recursively get text from child nodes
      const childText = getCleanText(child);

      if (tagName === 'div' || tagName === 'p' || tagName === 'blockquote' || tagName === 'br') {
        // Add a line break after block-level elements or <br>
        result += childText + '\n';
      } else {
        // Inline elements (like <a>) just append their text without line breaks
        result += childText;
      }
    }
  });

  return result;
}

function cleanBlockquoteText(blockquote) {
  const text = getCleanText(blockquote);
  
  // Clean up multiple line breaks and trim
  return text.replace(/\n{2,}/g, '\n').replace(/\n/g, '\n  ');
}

function extractMonoTableHeader(step_sentence) {
  const regex = /\bfollowing\b\s+(.+)/i;
  const match = step_sentence.match(regex);

  if (!match) return "Elements"; // "following" not found

  const words = match[1].split(/\s+/); // Split the words after "following"
  const collectedWords = [];
  
  for (const word of words) {
    collectedWords.push(word);
    if (/s\b/i.test(word)) { // Stop if a word ends with "s"
      break;
    }
  }

  // If no words or no word ends with "s", return "Elements"
  if (collectedWords.length === 0 || !/s\b/i.test(collectedWords[collectedWords.length - 1])) {
    return "Elements";
  }

  // Capitalize first word
  collectedWords[0] = collectedWords[0][0].toUpperCase() + collectedWords[0].slice(1);

  return collectedWords.join(' ').replace(':', '');
}
  

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContent") {
    sendResponse(extractPageContent());
  }
});
