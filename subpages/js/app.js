// Start demo
async function startDemo() {
  if (selectedIdx < 0) return;
  document.getElementById('demoShell').classList.add('visible');

  // Get models for selector
  const manifestUrl = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${currentScenario.taskType}/manifest_${currentScenario.taskType.toLowerCase()}.json`;
  const resp = await fetch(manifestUrl);
  const manifest = await resp.json();
  const models = Object.keys(manifest.models);
  const modelNameMap = {
    "FTcosmos": "Cosmos-P2†",
    "FTwan21": "Wan2.1†",
    "FTwan22_A14B": "Wan2.2 A14B†",
    "GTsim": "Ground Truth",
    "igen": "SVD†",
    "svd": "SVD",
    "wan21": "Wan2.1"
  };
  const modelOptions = models.map(m =>
    `<option value="${m}" ${m === currentScenario.model ? 'selected' : ''}>${modelNameMap[m] || m}</option>`
  ).join('');

  document.getElementById('currentScenarioBox').innerHTML =
    `<div class="scenario-text">
      <div class="scenario-title">${currentScenario.name}</div>
      <div>🎯 <b>${currentScenario.target}</b></div>
      <div>📝 "${currentScenario.prompt}"</div>
      <div id="modelSelectorBox" style="margin-top:12px">
        <label>🤖 Model:
          <div class="select-wrap">
            <select id="modelSelector">${modelOptions}</select>
          </div>
        </label>
      </div>
    </div>`;

  document.getElementById('bevHeaderTitle').textContent = "🗺️ Bird's Eye View";

  // Reload scenario data
  await reloadScenario();

  // Set final video
  const finalVid = document.getElementById('finalVideo');
  const finalUrl = `${currentScenario.base}/vis_ar.mp4`;
  probe(finalUrl).then(ok => {
    if (ok) {
      finalVid.src = finalUrl;
      finalVid.style.display = 'block';
      finalVid.load?.();
    } else {
      finalVid.removeAttribute('src');
      finalVid.style.display = 'none';
    }
  });

  setTimeout(processCurrentFrame, 900);
  document.querySelector('.overview-panel')
    .scrollIntoView({behavior: 'smooth', block: 'start'});
}

// Reload scenario (when model changes)
async function reloadScenario() {
  if (!currentScenario) return;

  // Reset state
  resetForNewScenario();

  // Load action data
  await loadActionData();

  // Load metrics 
if (currentScenario.taskType === "AEQA" || currentScenario.taskType === "IGNav" || currentScenario.taskType === "Manip") {
  currentScenario.metrics = await loadMetrics();  
}

  // Update BEV visibility (hide for AEQA)
  const bevPanel = document.getElementById("bevHeaderTitle")?.parentElement;
  const overview = document.querySelector(".overview-panel");

  if (bevPanel && overview) {
    if (currentScenario.taskType === "AEQA" || currentScenario.taskType === "Manip") {
      bevPanel.style.display = "none";
      overview.style.gridTemplateColumns = "1fr 1fr";
    } else {
      bevPanel.style.display = "flex";
      overview.style.gridTemplateColumns = "0.8fr 1fr 1fr";
    }
  }

  // Build frames
  frames = availableKeys.map((k, i) => {
    const d = realActionData[k];
    return {
      frameNumber: i + 1,
      frameKey: k,
      status: i === 0 ? 'current' : 'pending',
      plans: getPlansForScenario(d, currentScenario.taskType),
      actions3: getRankedActions(d, currentScenario.taskType),
      selectedAction: null,
      completed: false,
      currentStep: 0,
      actionData: d
    };
  });

  currentFrameIndex = 0;
  isRunning = true;

  // Display first frame
  displayFrame(0);

  // Load and update final status
  const metrics = await loadMetrics();
  updateFinalStatus(metrics);
}

// Reset state for new scenario
function resetForNewScenario() {
  if (isPlaying) {
    clearInterval(playInterval);
    isPlaying = false;
  }
  playInterval = null;

  isRunning = false;
  missionEnded = false;

  frames = [];
  currentFrameIndex = 0;

  __videoProbeCache.clear();

  const preds = document.querySelectorAll('video[id^="pred1_"], video[id^="pred2_"]');
  preds.forEach(v => {
    v.removeAttribute('src');
    v.hidden = true;
  });

  const finalVid = document.getElementById('finalVideo');
  finalVid.removeAttribute('src');
  finalVid.style.display = 'none';
}

// Initialize app
async function initApp() {
  if (scenarios.length === 0) {
    await loadScenarios();
  }
  renderThumbs();
}

// Event listeners
document.addEventListener('click', e => {
  const card = e.target.closest('.thumb-card');
  if (!card) return;
  applySelection(parseInt(card.dataset.idx, 10));
});

document.addEventListener('change', async e => {
  if (e.target.id === 'modelSelector') {
    currentScenario.model = e.target.value;

    // Fetch manifest and update episode
    const manifestUrl = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${currentScenario.taskType}/manifest_${currentScenario.taskType.toLowerCase()}.json`;
    const resp = await fetch(manifestUrl);
    const manifest = await resp.json();

    const envData = manifest.models[currentScenario.model][currentScenario.env];
    if (envData) {
      const episodes = Object.keys(envData);
      currentScenario.episode = episodes[0];
    }

    await reloadScenario();
  }
});

// Init on load
document.addEventListener('DOMContentLoaded', initApp);