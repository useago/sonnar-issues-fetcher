# SonarCloud Issues Exporter

Export SonarCloud issues into chunked Markdown files, organized by severity, for easy distribution and processing with AI tools like Claude Code.

## Why Use This Tool?

When working with large codebases that have hundreds or thousands of SonarCloud issues, it can be overwhelming to tackle them all at once. This tool helps by:

- **Organizing issues by severity**: Separate files for BLOCKER, CRITICAL, MAJOR, MINOR, and INFO issues
- **Chunking large issue lists**: Splits issues into manageable chunks (20 issues per file by default)
- **Easy distribution**: Share specific issue files with team members or AI assistants
- **Optimized for Claude Code**: Perfect for feeding issues to Claude Code in digestible portions
- **Markdown format**: Human-readable tables with links directly to SonarCloud

## How It Works

The script fetches all unresolved issues from a SonarCloud project using the SonarCloud API, then:

1. Groups issues by severity (BLOCKER, CRITICAL, MAJOR, MINOR, INFO)
2. Sorts issues by file path, line number, and key for consistency
3. Splits each severity into chunks of 20 issues
4. Outputs Markdown files with tables containing:
   - Issue key (linked to SonarCloud)
   - Type, Rule, Severity, Status
   - File path and line number
   - Issue message and creation date

## Setup

### Prerequisites

- Node.js 18+ (uses native fetch API)
- SonarCloud account with access to your project
- SonarCloud user token

### Installation

1. Clone this repository:
```bash
git clone <your-repo-url>
cd sonnar-issues
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your SonarCloud token:
```bash
SONAR_TOKEN=your-sonarcloud-token-here
```

To create a SonarCloud token:
- Go to SonarCloud
- Navigate to My Account > Security
- Generate a new token

4. Update the configuration in `get-issues.js`:
```javascript
const ORG = "your-org";           // Your SonarCloud organization
const PROJECT_KEY = "your-project"; // Your project key
```

## Usage

### Basic Usage

Fetch all unresolved issues:
```bash
node get-issues.js
```

### Filter by Branch

Fetch issues for a specific branch:
```bash
BRANCH=main node get-issues.js
```

### Output

The script generates Markdown files in the current directory:

- `BLOCKER1.md`, `BLOCKER2.md`, etc. - Blocker severity issues
- `CRITICAL1.md`, `CRITICAL2.md`, etc. - Critical severity issues
- `MAJOR1.md`, `MAJOR2.md`, etc. - Major severity issues
- `MINOR1.md`, `MINOR2.md`, etc. - Minor severity issues
- `INFO1.md`, `INFO2.md`, etc. - Info severity issues

Each file contains up to 20 issues in a formatted table.

## Using with Claude Code

This tool is designed to work seamlessly with Claude Code:

1. Export your SonarCloud issues:
```bash
node get-issues.js
```

2. Share specific issue files with Claude Code:
```bash
# Fix blocker issues
claude-code "Fix all issues in BLOCKER1.md"

# Or work through them systematically
claude-code "Review and fix issues in CRITICAL1.md"
```

3. Process issues in batches to maintain context and focus

## Customization

### Adjust Chunk Size

Modify the `ISSUES_PER_FILE` constant in `get-issues.js`:
```javascript
const ISSUES_PER_FILE = 20; // Change to your preferred number
```

### Filter Issue Types

Uncomment and modify the filters in the `buildUrl` function:
```javascript
params.set("types", "BUG,VULNERABILITY,CODE_SMELL");
```

### Add More Filters

The SonarCloud API supports many filters. See the [SonarCloud Web API documentation](https://sonarcloud.io/web_api/api/issues) for available options.

## Example Output

```markdown
# BLOCKER issues for myorg/myproject (Part 1/3)

| Key | Type | Rule | Severity | Status | File | Line | Message | Created |
| --- | ---- | ---- | -------- | ------ | ---- | ---- | ------- | ------- |
| [AX1234](https://sonarcloud.io/...) | BUG | typescript:S1234 | BLOCKER | OPEN | src/auth.ts | 42 | Remove this use of eval() | 2024-01-15 |
...
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.