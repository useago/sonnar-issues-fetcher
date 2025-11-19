/**
 * SonarCloud Issues Exporter by severity
 * --------------------------------------
 * Requirements: Node 18+ (uses global fetch), a SonarCloud user token
 *
 * Usage:
 *   node export-sonarcloud-issues.js
 *   # optional branch filter:
 *   BRANCH=main node export-sonarcloud-issues.js
 *
 * Configuration:
 *   Create a .env file with SONAR_TOKEN=<your-token>
 *   (create a token in SonarCloud > My Account > Security)
 *
 * Outputs in the current directory:
 *   BLOCKER.md, CRITICAL.md, MAJOR.md, MINOR.md, INFO.md
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Load .env file from the same directory as this script
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const SONAR_TOKEN = process.env.SONAR_TOKEN;
const ORG = "useago";
const PROJECT_KEY = "useago_ago-chat";
const BRANCH = process.env.BRANCH || ""; // optional

if (!SONAR_TOKEN) {
    console.error("Missing SONAR_TOKEN env var.");
    process.exit(1);
}

const BASE_URL = "https://sonarcloud.io/api/issues/search";
const PAGE_SIZE = 500;
const SEVERITIES = ["BLOCKER", "CRITICAL", "MAJOR", "MINOR", "INFO"];

// simple wait to be nice to the API if needed
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildUrl(page) {
    const params = new URLSearchParams();
    params.set("organization", ORG);
    // Sonar APIs accept componentKeys for project scoping across SonarQube and SonarCloud
    params.set("componentKeys", PROJECT_KEY);
    params.set("resolved", "false");
    params.set("ps", String(PAGE_SIZE));
    params.set("p", String(page));
    if (BRANCH) params.set("branch", BRANCH);
    // you can uncomment and tune filters if needed
    // params.set("severities", "BLOCKER,CRITICAL,MAJOR,MINOR,INFO");
    // params.set("types", "BUG,VULNERABILITY,CODE_SMELL");
    return `${BASE_URL}?${params.toString()}`;
}

function extractFilePath(component) {
    // component example: "useago_ago-chat:src/index.ts"
    const idx = component.indexOf(":");
    return idx >= 0 ? component.slice(idx + 1) : component;
}

function mdEscape(text = "") {
    return String(text).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function issueUrl(issueKey) {
    // deeplink to a specific issue inside the project issues view
    // works on SonarCloud
    const params = new URLSearchParams();
    params.set("id", PROJECT_KEY);
    params.set("issues", issueKey);
    params.set("open", issueKey);
    return `https://sonarcloud.io/project/issues?${params.toString()}`;
}

function headerFor(severity) {
    return `# ${severity} issues for ${ORG}/${PROJECT_KEY}${BRANCH ? ` on branch ${BRANCH}` : ""}\n`;
}

function renderTable(issues) {
    if (!issues.length) return "_No unresolved issues._\n";
    const header =
        "| Key | Type | Rule | Severity | Status | File | Line | Message | Created |\n" +
        "| --- | ---- | ---- | -------- | ------ | ---- | ---- | ------- | ------- |\n";
    const rows = issues
        .map((it) => {
            const file = extractFilePath(it.component);
            const line = it.line ?? "";
            const created = it.creationDate ? new Date(it.creationDate).toISOString().slice(0, 10) : "";
            const keyLink = `[${it.key}](${issueUrl(it.key)})`;
            return `| ${keyLink} | ${mdEscape(it.type)} | ${mdEscape(it.rule)} | ${mdEscape(
                it.severity
            )} | ${mdEscape(it.status)} | ${mdEscape(file)} | ${mdEscape(line)} | ${mdEscape(
                it.message
            )} | ${mdEscape(created)} |`;
        })
        .join("\n");
    return header + rows + "\n";
}

async function fetchAllIssues() {
    const all = [];
    let page = 1;
    let total = Infinity;

    while ((page - 1) * PAGE_SIZE < total) {
        const url = buildUrl(page);
        const res = await fetch(url, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${SONAR_TOKEN}:`).toString("base64")}`,
            },
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`SonarCloud API error ${res.status}: ${text}`);
        }
        const data = await res.json();
        // paging fields commonly include total, p, ps
        total = data.total ?? data.paging?.total ?? 0;
        const issues = data.issues ?? [];
        all.push(...issues);
        // light throttle in case of very large projects
        if (issues.length === PAGE_SIZE) await sleep(100);
        page += 1;
    }
    return all;
}

async function writeBySeverity(issues) {
    const ISSUES_PER_FILE = 20;

    // group
    const bySeverity = new Map(SEVERITIES.map((s) => [s, []]));
    for (const it of issues) {
        if (!bySeverity.has(it.severity)) bySeverity.set(it.severity, []);
        bySeverity.get(it.severity).push(it);
    }

    // stable sort inside each severity by file then line then key
    for (const sev of bySeverity.keys()) {
        const arr = bySeverity.get(sev);
        arr.sort((a, b) => {
            const af = extractFilePath(a.component);
            const bf = extractFilePath(b.component);
            if (af !== bf) return af.localeCompare(bf);
            const al = a.line ?? 0;
            const bl = b.line ?? 0;
            if (al !== bl) return al - bl;
            return a.key.localeCompare(b.key);
        });
    }

    // write files (split into chunks of ISSUES_PER_FILE)
    for (const sev of SEVERITIES) {
        const allIssues = bySeverity.get(sev) || [];
        const totalIssues = allIssues.length;

        if (totalIssues === 0) {
            // Still write one file even if empty
            const filename = path.resolve(process.cwd(), `${sev}.md`);
            const content = headerFor(sev) + "\n" + renderTable([]);
            await fs.writeFile(filename, content, "utf8");
            console.log(`Wrote ${path.basename(filename)} (0 issues)`);
            continue;
        }

        // Split into chunks
        const numFiles = Math.ceil(totalIssues / ISSUES_PER_FILE);

        for (let i = 0; i < numFiles; i++) {
            const start = i * ISSUES_PER_FILE;
            const end = Math.min(start + ISSUES_PER_FILE, totalIssues);
            const chunk = allIssues.slice(start, end);

            const fileNumber = i + 1;
            const filename = path.resolve(process.cwd(), `${sev}${fileNumber}.md`);
            const header = `# ${sev} issues for ${ORG}/${PROJECT_KEY}${BRANCH ? ` on branch ${BRANCH}` : ""} (Part ${fileNumber}/${numFiles})\n`;
            const content = header + "\n" + renderTable(chunk);

            await fs.writeFile(filename, content, "utf8");
            console.log(`Wrote ${path.basename(filename)} (${chunk.length} issues)`);
        }
    }
}

async function main() {
    try {
        console.log(
            `Fetching unresolved issues from SonarCloud for ${ORG}/${PROJECT_KEY}${BRANCH ? ` on branch ${BRANCH}` : ""}...`
        );
        const issues = await fetchAllIssues();
        console.log(`Fetched ${issues.length} issues. Writing Markdown files...`);
        await writeBySeverity(issues);
        console.log("Done.");
    } catch (err) {
        console.error(err.message || err);
        process.exit(1);
    }
}

main();
