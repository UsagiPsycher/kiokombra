/**
 * Gherkin Converter Module
 *
 * Converts structured content into Gherkin syntax format
 */
const GherkinConverter = (() => {
  // Define indentation levels for Gherkin components
  const Indentation = {
    FEATURE: 0,
    SECTION: 2,
    STEP: 2,
    TABLE: 4,
    COMMENT: 2
  };

  /** Main conversion entry point */
  function convertToGherkin(content) {
    if (!content) {
      return getErrorMessage('missingContent');
    }
    else if (!isContentValid(content)) {
      return getErrorMessage('invalidContent');
    }
    return composeFeatureFile(content);
  }

  /** Construct the complete Gherkin feature structure from the content object */
  function composeFeatureFile(content) {
    return [
      createFeatureLine(content.title),
      createCommentsSection(content.comments),
      createBackgroundSection(content.background),
      createScenarioSections(content.scenarios)
    ].filter(Boolean).join('\n');
  }

  /** Build individual feature components lines */
  const createFeatureLine = title => `Feature: ${title}`;

  function createCommentsSection(comments) {
    return comments.length > 0 ? comments.join('\n') : null;
  }

  /** Build Background section with steps (if any) */
  function createBackgroundSection(background) {
    if (background.length === 0) return null;
    return [
      '\nBackground:',
      ...background.map(line => indent(line, Indentation.STEP))
    ].join('\n');
  }

  /** Build Scenario sections for each scenario in content */
  function createScenarioSections(scenarios) {
    return scenarios.map(scenario => [
      `\nScenario: ${scenario.name}`,
      ...formatScenarioElements(scenario.elements)
    ].join('\n')).join('\n');
  }

  /** Format each scenario element and merge consecutive duplicate tables */
  function formatScenarioElements(elements) {
    return mergeConsecutiveDuplicateTables(elements).map((element, index) => {
      switch (element.type) {
        case 'step':
          // Gherkin step (Given/When/Then/And)
          return indent(element.content, Indentation.STEP);
        case 'table':
          // Format multi-column table
          return formatTable(element.content, Indentation.TABLE);
        case 'mono-table':
          const isConsecutive = mergeConsecutiveDuplicateTables(elements)[Math.max(0, index - 1)].type === 'mono-table'
          // Format single-column table (from bullet list item)
          return formatSingleColumnTable(element.content, Indentation.TABLE, isConsecutive);
        case 'comment-step':
          // Prepend comment symbol (#) to the comment step
          return indent(`#${element.content}`, Indentation.COMMENT);
        default:
          return '';
      }
    });
  }

  // Utility function to add indentation
  const indent = (content, spaces) => ' '.repeat(spaces) + content;

  /** Format a multi-column table row array into a Gherkin table string */
  function formatTable(rows, indentation) {
    return rows.map(row =>
      indent(`| ${row.join(' | ')} |`, indentation)
    ).join('\n');
  }

  /** Format a single-column table (e.g., bullet list) into a Gherkin table string */
  function formatSingleColumnTable(rows, indentation, isConsecutive = false) {
    if (isConsecutive) {
      return indent(`| ${rows.pop()} |`, indentation)
    }
    else {
      return rows.map(row =>
        indent(`| ${row.join(' | ')} |`, indentation)
      ).join('\n');
    }
  }

  /** Validate that content has a title and at least a background or scenario */
  function isContentValid(content) {
    return content.title && (
      content.background.length > 0 || content.scenarios.length > 0
    );
  }

  /** Retrieve a user-friendly error message based on error type */
  function getErrorMessage(type) {
    const messages = {
      invalidContent: (
        'Error: Content has invalid values\n\n'
      ),
      missingContent: (
        'Error: Could not retrieve content from current page\n\n' +
        '1. Ensure you\'re on a valid Notion page\n' +
        '2. Refresh the page and try again'
      ),
      default: 'Error: Unknown conversion error'
    };
    return messages[type] || messages.default;
  }

  /** Remove consecutive duplicate tables from elements */
  function mergeConsecutiveDuplicateTables(elements) {
    return elements.reduce((acc, current) => {
      if (current.type === 'table') {
        const lastElement = acc[acc.length - 1];
        if (lastElement?.type === 'table' && areTablesEqual(lastElement.content, current.content)) {
          // Skip adding this table if it is a duplicate of the last one
          return acc;
        }
      }
      acc.push(current);
      return acc;
    }, []);
  }

  /** Check if two tables (2D arrays) have identical content */
  function areTablesEqual(table1, table2) {
    return JSON.stringify(table1) === JSON.stringify(table2);
  }

  // Expose the converter function
  return { convertToGherkin };
})();

/** Extension Popup UI Controller 
 * Handles UI interactions and content loading in the popup 
 */
const PopupController = (() => {
  /** Initialize the popup: set up copy button and load content */
  function initialize() {
    setupCopyButton();
    loadContent();
  }

  /** Attach event listener to the copy button */
  function setupCopyButton() {
    document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
  }

  async function copyToClipboard() {
    const output = document.getElementById('output');
    const copyBtn = document.getElementById('copyBtn');
    const originalText = copyBtn.textContent;
  
    try {
      await navigator.clipboard.writeText(output.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000); // 2 seconds
    } catch (err) {
      // Optionally handle errors
    }
  }

  /** Retrieve content from the current active Notion tab */
  function loadContent() {
    chrome.tabs.query({ active: true, currentWindow: true }, handleTabQueryResponse);
  }

  /** Inject content script into active tab and request content */
  function handleTabQueryResponse(tabs) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        files: ['content.js']
      },
      () => fetchPageContent(tabs[0].id)
    );
  }

  /** Send a message to the content script to fetch page content */
  function fetchPageContent(tabId) {
    chrome.tabs.sendMessage(tabId, { action: "getContent" }, displayFeatureContent);
  }

  function alignGherkinTablesInGherkinText(gherkinText) {
    const lines = gherkinText.split('\n');
    const resultLines = [];
    let currentTable = [];
    let currentIndentation = '';
  
    const isTableLine = line => line.trim().startsWith('|') && line.trim().endsWith('|');
  
    const processTable = () => {
      if (currentTable.length === 0) return;
  
      // Extract cells and calculate max width for each column
      const rows = currentTable.map(line =>
        line.trim().slice(1, -1).split('|').map(cell => cell.trim())
      );
  
      const colWidths = [];
      rows.forEach(row => {
        row.forEach((cell, index) => {
          colWidths[index] = Math.max(colWidths[index] || 0, cell.length);
        });
      });
  
      // Rebuild aligned table
      const alignedRows = rows.map(row =>
        `${currentIndentation}| ${row.map((cell, i) => cell.padEnd(colWidths[i], ' ')).join(' | ')} |`
      );
  
      resultLines.push(...alignedRows);
      currentTable = [];
    };
  
    for (const line of lines) {
      if (isTableLine(line)) {
        if (currentTable.length === 0) {
          currentIndentation = line.match(/^\s*/)[0];
        }
        currentTable.push(line);
      } else {
        processTable();
        resultLines.push(line);
      }
    }
  
    processTable(); // Process any table left at the end
    return resultLines.join('\n');
  }

  /** Convert content to Gherkin and display in the output textarea */
  function displayFeatureContent(response) {
    const output = document.getElementById('output');
    const gherkinText = GherkinConverter.convertToGherkin(response);
    const alignedGherkinText = alignGherkinTablesInGherkinText(gherkinText);

    output.textContent = alignedGherkinText; // Use textContent to avoid HTML injection
    Prism.highlightElement(output);
  }

  return { initialize };
})();

// Initialize extension popup when DOM is loaded
document.addEventListener('DOMContentLoaded', PopupController.initialize);
