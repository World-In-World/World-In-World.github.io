// Global action state
let realActionData = {};
let availableKeys = [];

// Load action data for current scenario
async function loadActionData() {
  const manifestUrl = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${currentScenario.taskType}/manifest_${currentScenario.taskType.toLowerCase()}.json`;
  const resp = await fetch(manifestUrl);
  const manifest = await resp.json();

  const models = manifest.models || {};
  const modelData = models[currentScenario.model];
  if (!modelData) throw new Error(`Model ${currentScenario.model} not found`);

  const envData = modelData[currentScenario.env];
  if (!envData) throw new Error(`Env ${currentScenario.env} not found`);

  const epData = envData[currentScenario.episode];
  if (!epData) throw new Error(`Episode ${currentScenario.episode} not found`);

  // Set base path
  currentScenario.base = `https://huggingface.co/datasets/zonszer/demo_source_data/resolve/main/${currentScenario.taskType}/${currentScenario.model}/${currentScenario.env}/${currentScenario.episode}`;

  // Set preview image
  if (currentScenario.taskType === "AR") {
    currentScenario.previewImg = `${currentScenario.base}/A000/real_obs_bbox.png`;
  } else if (currentScenario.taskType === "IGNav") {
    currentScenario.previewImg = `${currentScenario.base}/goal_image.png`;
  } else if (currentScenario.taskType === "AEQA" || currentScenario.taskType === "Manip") {
    currentScenario.previewImg = `${currentScenario.base}/A000/real_obs.png`;
  }

  // Get frame keys
  let keys = expandFrames(epData);
  currentScenario.lastFrameKey = keys[keys.length - 1];

  // if (!(epData.continuous_frame === false && epData.frames.length === 1 && epData.frames[0] === 0)) {
  //   keys = keys.slice(1);
  // }
  availableKeys = keys;

  // Preload action plans
  realActionData = {};

  if (currentScenario.taskType === "Manip") {
    // Only load once from A000
    try {
      const resp = await fetch(`${currentScenario.base}/A000/action_plan.json`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      // assign same data to all keys
      for (const id of availableKeys) {
        realActionData[id] = data;
      }
    } catch (e) {
      console.warn('Manip action plan load failed', e);
      for (const id of availableKeys) {
        realActionData[id] = {
          placeholder: true,
          note: "No planner data for this step."
        };
      }
    }
  } else {
    // default: load each frame
    await Promise.all(availableKeys.map(async id => {
      try {
        const resp = await fetch(`${currentScenario.base}/${id}/action_plan.json`, {
          headers: { 'Accept': 'application/json' },
          cache: 'no-store'
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        realActionData[id] = await resp.json();
      } catch (e) {
        console.warn('Load failed for', id, e);
        realActionData[id] = {
          placeholder: true,
          note: "No planner data for this step."
        };
      }
    }));
  }

}

// Get plans for scenario based on task type
function getPlansForScenario(d, taskType) {
  if (!d || !d.planner_data) return [];
  const pd = d.planner_data;

  if (taskType === "IGNav") {
    const proposals = pd["planner_next-5_proposal.json"] || [];
    return proposals.map((steps, i) => ({
      title: `Proposal ${i + 1}`,
      steps,
      ranking: i + 1
    }));
  }

  if (taskType === "AEQA") {
    const high = d.answerer_data?.["planner_highlevel.json"] || [];
    const imagine = d.answerer_data?.["planner_highlevel_imagine.json"] || [];
    const all = [...high, ...imagine];
    return all.map((item, i) => ({
      title: `Plan ${i + 1}`,
      actionPlan: item["Action Plan"] || "—",
      reason: item["Reason"] || "",
      view: item["Chosen View"] || "—",
      landmark: item["Chosen Landmark"] === null ? "None" : item["Chosen Landmark"],
      ranking: i + 1,
      pngIndex: i + 1  // For loading bbox_gen_video_X.png
    }));
  }

  if (taskType === "Manip") {
    const high = pd["planner_highlevel.json"] || [];
    const imagine = pd["planner_highlevel_imagine.json"] || [];
    
    return {
      actionPlans: high.map((item, i) => ({
        title: `Final Plan ${i + 1}`,
        reasoning: item.reasoning_and_reflection || "",
        languagePlan: item.language_plan || "",
        executable: item.executable_plan || [],
        visualDesc: item.visual_state_description || "",
        pngIndex: i + 1
      })),
      imaginePlans: imagine.map((item, i) => ({
        title: `Plan ${i + 1}`,
        reasoning: item.reasoning_and_reflection || "",
        languagePlan: item.language_plan || "",
        executable: item.executable_plan || [],
        visualDesc: item.visual_state_description || "",
        pngIndex: item.index !== undefined ? item.index + 1 : i + 1  // Use item.index if available
      }))
    };
  }

  // AR default
  const n4 = pd["planner_next-4.json"];
  if (Array.isArray(n4) && n4.length) {
    if (Array.isArray(n4[0])) {
      const a = n4[0] || [], b = n4[1] || [];
      return [
        {title: "Plan 1 (next-4)", steps: a, ranking: 1},
        {title: "Plan 2 (next-4)", steps: b, ranking: 2}
      ].filter(p => p.steps.length);
    }
    return [
      n4[0] && {title: "Plan 1 (next-4)", steps: [n4[0]], ranking: 1},
      n4[1] && {title: "Plan 2 (next-4)", steps: [n4[1]], ranking: 2}
    ].filter(Boolean);
  }

  return [];
}

// Get ranked actions based on task type
function getRankedActions(d, taskType) {
  if (!d) return [];
  
  const toPct = v => {
    const x = Number(v);
    return isFinite(x) ? Math.round(x <= 1 ? x * 100 : x) : 0;
  };

  if (taskType === "IGNav") {
    const actions = [];

    // From answerer_data
    const rawAns = d.answerer_data || {};
    for (const [title, val] of Object.entries(rawAns)) {
      actions.push({
        title,
        conf: toPct(val),
        ranking: actions.length + 1
      });
    }

    // From planner sequence
    const seqs = d.planner_data?.["planner_next-5.json"] || [];
    if (Array.isArray(seqs) && seqs.length) {
      actions.push({
        title: "Planned path",
        conf: 0,
        steps: seqs[0],
        ranking: actions.length + 1
      });
    }

    return actions;
  }

  if (taskType === "AEQA") {
    // const high = d.answerer_data?.["planner_highlevel.json"] || [];
    // const imagine = d.answerer_data?.["planner_highlevel_imagine.json"] || [];
    // const all = [...high, ...imagine];
    // return all.map((item, i) => ({
    //   title: item["Action Plan"] || `Decision ${i + 1}`,
    //   steps: [item["Action Plan"] || "—"],
    //   reason: item["Reason"] || "",
    //   view: item["Chosen View"] || null,
    //   landmark: item["Chosen Landmark"] ?? null,
    //   conf: 0,
    //   ranking: i + 1
    // }));
    const selected = d.answerer_data?.["planner_highlevel.json"]?.[0];
    if (selected) {
      return [{
        title: "Selected Plan",
        answer: selected["Answer"] || "—",
        actionPlan: selected["Action Plan"] || "—",
        view: selected["Chosen View"] || null,
        landmark: selected["Chosen Landmark"] ?? null,
        conf: 0,
        ranking: 1,
        isAEQA: true
      }];
    }
    return [];
  }

  // AR default
  const raw = d?.planner_data?.["planner_next-1.json"];
  if (!raw) return [];

  let items = [];
  if (Array.isArray(raw)) {
    if (raw.length && typeof raw[0] === "object") {
      items = raw.map(o => ({
        title: o.action ?? o.title ?? "",
        conf: toPct(o.confidence ?? o.score ?? o.prob ?? 0)
      }));
    } else if (raw.length && typeof raw[0] === "string") {
      items = raw.map(t => ({title: t, conf: 0}));
    }
  } else if (typeof raw === "object") {
    items = Object.entries(raw).map(([k, v]) => ({
      title: k, conf: toPct(v)
    }));
  } else if (typeof raw === "string") {
    items = [{title: raw, conf: 0}];
  }

  return items
    .filter(it => it.title)
    .sort((a, b) => b.conf - a.conf)
    .slice(0, 3)
    .map((it, i) => ({...it, ranking: i + 1}));
}


// Get top answerer
function getTopAnswerer(d) {
  if (!d || !d.answerer_data) return {label: '—', score: 0};
  const ent = Object.entries(d.answerer_data);
  if (!ent.length) return {label: '—', score: 0};
  ent.sort((a, b) => b[1] - a[1]);
  const [label, score] = ent[0];
  return {label, score};
}