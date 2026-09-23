import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const CHROME_PATH = "/home/joare/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const PORT = 9222;

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runAudit() {
  const chrome = spawn(CHROME_PATH, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    "--window-size=1440,900",
    "about:blank"
  ]);

  try {
    let wsUrl = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
        if (res.ok) {
          const data = await res.json();
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      } catch (e) {
        await sleep(200);
      }
    }

    if (!wsUrl) throw new Error("Could not connect to Chrome CDP");

    const ws = new WebSocket(wsUrl);
    await new Promise((res) => {
      ws.onopen = () => res();
    });

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const id = msgId++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            ws.removeEventListener("message", handler);
            if (data.error) rej(data.error);
            else res(data.result);
          }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    // Create a new target / page
    const target = await send("Target.createTarget", { url: "http://127.0.0.1:4173/?example=approval-workflow#examples" });
    const targetId = target.targetId;

    const pageWs = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${targetId}`);
    await new Promise((res) => {
      pageWs.onopen = () => res();
    });

    let pageMsgId = 1;
    function sendPage(method, params = {}) {
      return new Promise((res, rej) => {
        const id = pageMsgId++;
        const handler = (evt) => {
          const data = JSON.parse(evt.data);
          if (data.id === id) {
            pageWs.removeEventListener("message", handler);
            if (data.error) rej(data.error);
            else res(data.result);
          }
        };
        pageWs.addEventListener("message", handler);
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    }

    await sendPage("Page.enable");
    await sendPage("Runtime.enable");
    await sendPage("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await sleep(2000);

    const evalResult = await sendPage("Runtime.evaluate", {
      expression: `(() => {
        const ids = [
          '#left-code-pane',
          '.code-editor-wrapper',
          '#tab-content-air',
          '#air-code-editor',
          '#air-provides-strip'
        ];

        const table = ids.map(sel => {
          const el = document.querySelector(sel);
          if (!el) return { selector: sel, error: 'NOT FOUND' };
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);

          return {
            selector: sel,
            y: r.y,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
            display: s.display,
            position: s.position,
            flex: s.flex,
            gridRow: s.gridRow,
            heightCSS: s.height,
            minHeight: s.minHeight,
            overflow: s.overflow
          };
        });

        const pane = document.querySelector('#left-code-pane');
        const cs = getComputedStyle(pane);
        const gridInfo = {
          display: cs.display,
          height: cs.height,
          gridTemplateRows: cs.gridTemplateRows,
          alignItems: cs.alignItems,
          alignContent: cs.alignContent
        };

        const parentHeights = {
          viewExamples: document.querySelector('#view-examples')?.getBoundingClientRect(),
          splitContainer: document.querySelector('#split-container')?.getBoundingClientRect(),
          leftCodePane: document.querySelector('#left-code-pane')?.getBoundingClientRect(),
          showcaseViewCSS: getComputedStyle(document.querySelector('#view-examples')).height,
          splitContainerCSS: getComputedStyle(document.querySelector('#split-container')).height
        };

        return { table, gridInfo, parentHeights };
      })()`,
      returnByValue: true
    });

    console.log("=== BROWSER EVALUATION RESULTS ===");
    console.log("TABLE:");
    console.table(evalResult.result.value.table);
    console.log("\nGRID INFO:", JSON.stringify(evalResult.result.value.gridInfo, null, 2));
    console.log("\nPARENT HEIGHTS:", JSON.stringify(evalResult.result.value.parentHeights, null, 2));

    // Capture screenshot
    const screenshot = await sendPage("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(screenshot.data, "base64");
    const artifactPath = "/home/joare/.gemini/antigravity-cli/brain/2ad0b767-e861-43f7-a315-3e5ca153abf7/browser_editor_audit.png";
    await writeFile(artifactPath, buffer);
    console.log(`\nScreenshot saved to ${artifactPath}`);

    pageWs.close();
    ws.close();
  } finally {
    chrome.kill();
  }
}

runAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
