// Global state
let scenarios = [];
let selectedIdx = -1;
let currentScenario = null;

// Load all scenarios from manifest
async function loadScenarios() {
  const url = "https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/scenarios.json";
  const data = await fetch(url).then(r => r.json());
  scenarios = [];

  for (const [taskType, group] of Object.entries(data)) {
    for (const s of group.scenarios) {
      s.taskType = taskType;
      s.prompt = group.prompt;   
      s.previewImg = await loadPreviewImage(s, taskType);
      scenarios.push(s);
    }
  }
}

// Load preview image for a scenario
async function loadPreviewImage(scenario, taskType) {
  const manifestUrl = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${taskType}/manifest_${taskType.toLowerCase()}.json`;
  const manifest = await fetch(manifestUrl).then(r => r.json());

  const models = manifest.models || {};
  const modelNames = Object.keys(models);
  if (!modelNames.length) return null;

  const defaultModel = modelNames[0];
  const envData = models[defaultModel][scenario.env];
  if (!envData) return null;

  const episodes = Object.keys(envData);
  if (!episodes.length) return null;

  const defaultEpisode = episodes[0];

  // Set defaults
  scenario.model = defaultModel;
  scenario.episode = defaultEpisode;
  scenario.base = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${taskType}/${defaultModel}/${scenario.env}/${defaultEpisode}`;

  // Return preview path
  if (taskType === "AR") return `${scenario.base}/A000/real_obs_bbox.png`;
  if (taskType === "IGNav") return `${scenario.base}/goal_image.png`;
  if (taskType === "AEQA" || taskType == "Manip") return `${scenario.base}/A000/real_obs.png`;
  return null;
}

// Expand frame keys from manifest
function expandFrames(epData) {
  if (!epData || !Array.isArray(epData.frames)) return [];

  if (epData.continuous_frame) {
    const [start, end] = epData.frames;
    return Array.from({length: end - start + 1}, (_, i) =>
      `A${String(start + i).padStart(3, '0')}`
    );
  } else {
    return epData.frames.map(n => `A${String(n).padStart(3, '0')}`);
  }
}

// Apply scenario selection
async function applySelection(idx) {
  selectedIdx = idx; 
  currentScenario = scenarios[idx];
  document.getElementById('startBtn').disabled = false;

  // Load manifest for model/episode info
  const manifestUrl = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${currentScenario.taskType}/manifest_${currentScenario.taskType.toLowerCase()}.json`;
  const resp = await fetch(manifestUrl);
  const manifest = await resp.json();

  const models = Object.keys(manifest.models);
  if (!currentScenario.model) {
    currentScenario.model = models[0];
  }

  const envData = manifest.models[currentScenario.model][currentScenario.env];
  if (envData) {
    const episodes = Object.keys(envData);
    if (!currentScenario.episode) {
      currentScenario.episode = episodes[0];
    }
  }

  // Update UI
  document.getElementById('scenarioInfo').innerHTML =
    `🎯 <b>${currentScenario.target}</b><br>
     📝 "${currentScenario.prompt}"`;

  // Highlight thumbnail
  document.querySelectorAll('.thumb-card')
    .forEach((c, i) => c.classList.toggle('selected', i === idx));
}