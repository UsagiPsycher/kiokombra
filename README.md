# Kiokombra – Notion to Gherkin Converter 🧠➡️📜

**Kiokombra** is a lightweight Chrome extension that extracts structured content from your Notion pages and converts it into well-formatted, syntax-highlighted **Gherkin** code.

Perfect for Behavior-Driven Development (BDD) workflows, Kiokombra helps you effortlessly document your Notion features as ready-to-use Gherkin syntax, directly from your browser.

---

## ✨ Features
- Extract **Features**, **Backgrounds**, **Scenarios**, **Steps**, **Tables**, and **Comments** from Notion pages.
- Automatically formats the extracted content into beautiful, readable **Gherkin code**.
- Aligns tables perfectly for IDE-quality readability.
- Syntax highlighting for easier copy-pasting into your favorite editors.
- One-click copy to clipboard.

---

## ⚡ Installation

### 1. Download the extension
- Clone or download this repository to your computer.

### 2. Load the extension into Chrome or any Chromium-based browser (Edge, Brave, Opera):
1. Open your browser and go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle switch in the top right).
3. Click **Load unpacked**.
4. Select the folder containing this extension's files (the one with the `manifest.json`).
5. The extension should now appear in your toolbar.

### 3. Configure permissions
Kiokombra is designed to work on specific sites, like Notion. Make sure the extension has permission to run on those pages. This is handled via the `manifest.json` file with `"host_permissions"`, preconfigured for Notion pages.

---

## 🛠️ How to Use
1. Open any supported Notion page (Documentation on how to write features on Notion will come soon)
2. Click the **Kiokombra** icon in your toolbar.
3. A popup will appear displaying the extracted Gherkin code.
4. Review the output with proper syntax highlighting.
5. Click **Copy** to save the code to your clipboard.
6. Paste directly into your `.feature` file or editor of choice.

---