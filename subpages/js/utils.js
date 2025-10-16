// Format number as percentage
function pct(x) {
  return (Math.round(x * 1000) / 10).toFixed(1) + '%';
}

// Fetch image as blob URL
async function fetchImageAsBlobURL(url) {
  try {
    const res = await fetch(url, {mode: 'cors'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Image blob fetch failed:', url, err);
    return null;
  }
}

// Wait for element to appear
function waitForElement(selector, callback, timeout = 5000) {
  const start = Date.now();
  const check = () => {
    const el = document.querySelector(selector);
    if (el) {
      callback(el);
    } else if (Date.now() - start < timeout) {
      requestAnimationFrame(check);
    } else {
      console.warn(`Element ${selector} not found after timeout`);
    }
  };
  check();
}

// Load metrics from JSONL
async function loadMetrics() {
  try {
    const url = `${currentScenario.base}/metrics.jsonl`;
    const resp = await fetch(url, {cache: 'no-store'});
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    
    const text = await resp.text();
    const trimmed = text.trim();

    // Try parsing as single JSON object
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const obj = JSON.parse(trimmed);
        return [obj];
      } catch (e) {
        console.warn("parse whole-json failed:", e);
      }
    }

    // Parse as JSONL (one object per line)
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        return [obj];
      } catch (e) {
        console.warn("skip bad metrics line:", lines[i]);
      }
    }

    return [];
  } catch (e) {
    console.warn("metrics.jsonl load failed:", e);
    return [];
  }
}

// Update final status display
function updateFinalStatus(metrics) {
  const statusEl = document.getElementById('statusDisplay');
  statusEl.classList.remove("success", "fail");

  if (currentScenario.taskType === "AR") {
    const success = metrics.some(m => m.gt && m.pred && m.gt.trim() === m.pred.trim());
    if (success) {
      statusEl.textContent = "Mission Success!";
      statusEl.classList.add("success");
    } else {
      statusEl.textContent = "Mission Failed";
      statusEl.classList.add("fail");
    }
  } 
  else if (currentScenario.taskType === "IGNav") {
    const success = metrics.some(m => m.is_success === true);
    if (success) {
      statusEl.textContent = "Mission Success!";
      statusEl.classList.add("success");
    } else {
      statusEl.textContent = "Mission Failed";
      statusEl.classList.add("fail");
    }
  } 
  else if (currentScenario.taskType === "AEQA") {
    if (metrics.length) {
      const scores = metrics.map(m => m.score).filter(v => typeof v === "number");
      const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "N/A";
      statusEl.textContent = `Score: ${avg} / 5`;
    } else {
      statusEl.textContent = "Score: N/A";
    }
  }
  else if (currentScenario.taskType === "Manip") {
    // Manip: same as IGNav, use is_success
    const success = metrics.some(m => m.is_success === true);
    if (success) {
      statusEl.textContent = "Mission Success!";
      statusEl.classList.add("success");
    } else {
      statusEl.textContent = "Mission Failed";
      statusEl.classList.add("fail");
    }
  }
}