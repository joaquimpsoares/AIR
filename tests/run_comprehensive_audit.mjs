import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const CHROME_PATH = "/home/joare/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome";
const PORT = 9240;

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runComprehensiveAudit() {
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
    await new Promise((res) => { ws.onopen = () => res(); });

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

    const target = await send("Target.createTarget", { url: "http://127.0.0.1:4173/?example=approval-workflow#examples" });
    const pageWs = new WebSocket(`ws://127.0.0.1:${PORT}/devtools/page/${target.targetId}`);
    await new Promise((res) => { pageWs.onopen = () => res(); });

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

    const testResults = await sendPage("Runtime.evaluate", {
      expression: `(() => {
        const results = {};

        const getMetrics = () => {
          const pane = document.querySelector('#left-code-pane').getBoundingClientRect();
          const wrapper = document.querySelector('.code-editor-wrapper').getBoundingClientRect();
          const editor = document.querySelector('#air-code-editor').getBoundingClientRect();
          const provides = document.querySelector('#air-provides-strip').getBoundingClientRect();
          const textarea = document.querySelector('#air-code-editor');

          return {
            paneHeight: pane.height,
            wrapperHeight: wrapper.height,
            editorHeight: editor.height,
            editorScrollHeight: textarea.scrollHeight,
            editorClientHeight: textarea.clientHeight,
            providesBottom: provides.bottom,
            paneBottom: pane.bottom,
            diffBottom: Math.abs(provides.bottom - pane.bottom),
            firstLine: textarea.value.split('\\n')[0],
            lineCount: textarea.value.split('\\n').length
          };
        };

        // 1. Approval Workflow at Load
        results.approvalAtLoad = getMetrics();

        // 2. Short Source Test (2 lines)
        const editorEl = document.querySelector('#air-code-editor');
        const origVal = editorEl.value;
        editorEl.value = 'air version=2\\napp x title="X"';
        editorEl.dispatchEvent(new Event('input'));
        results.shortSource = getMetrics();

        // Restore Approval Workflow
        editorEl.value = origVal;
        editorEl.dispatchEvent(new Event('input'));

        // 3. Switch to Inventory Hub
        const inventoryTab = document.querySelector('.module-tab-btn[data-example="inventory-hub"]');
        if (inventoryTab) inventoryTab.click();
        results.inventoryHub = getMetrics();

        // Switch back to Approval Workflow
        const approvalTab = document.querySelector('.module-tab-btn[data-example="approval-workflow"]');
        if (approvalTab) approvalTab.click();

        // 4. Tab toggle Explain -> AIR
        const explainTab = document.querySelector('.tab-btn[data-tab="explain"]');
        if (explainTab) explainTab.click();
        const explainMetrics = {
          explainContainerHeight: document.querySelector('#explain-cards-list')?.getBoundingClientRect().height
        };
        const airTab = document.querySelector('.tab-btn[data-tab="air"]');
        if (airTab) airTab.click();
        results.explainToSource = { ...getMetrics(), ...explainMetrics };

        // 5. Focus mode: Code Focus
        const codeFocusBtn = document.querySelector('.focus-btn[data-focus="code"]');
        if (codeFocusBtn) codeFocusBtn.click();
        results.codeFocus = getMetrics();

        // Restore Split Focus
        const splitFocusBtn = document.querySelector('.focus-btn[data-focus="split"]');
        if (splitFocusBtn) splitFocusBtn.click();
        results.splitFocusRestored = getMetrics();

        // 6. Benchmark Drawer toggle
        const toggleDrawerBtn = document.querySelector('#btn-toggle-bottom-panel');
        if (toggleDrawerBtn) toggleDrawerBtn.click(); // Collapse
        const collapsedMetrics = getMetrics();
        if (toggleDrawerBtn) toggleDrawerBtn.click(); // Expand
        results.benchmarkDrawer = {
          afterCollapse: collapsedMetrics,
          afterExpand: getMetrics()
        };

        return results;
      })()`,
      returnByValue: true
    });

    console.log("=== COMPREHENSIVE SUITE RESULTS ===");
    console.log(JSON.stringify(testResults.result.value, null, 2));

    // Capture screenshot of final state
    const screenshot = await sendPage("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(screenshot.data, "base64");
    const artifactPath = "/home/joare/.gemini/antigravity-cli/brain/2ad0b767-e861-43f7-a315-3e5ca153abf7/browser_approval_full_height.png";
    await writeFile(artifactPath, buffer);
    console.log(`\nFinal Screenshot saved to ${artifactPath}`);

    pageWs.close();
    ws.close();
  } finally {
    chrome.kill();
  }
}

runComprehensiveAudit().catch(err => {
  console.error("Audit error:", err);
  process.exit(1);
});
