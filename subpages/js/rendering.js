// Render thumbnail grid
function renderThumbs() {
  const grid = document.getElementById('thumbGrid');
  grid.innerHTML = "";
  grid.innerHTML = scenarios.map((s, idx) => {
    return `
      <div class="thumb-card ${idx === selectedIdx ? 'selected' : ''}" 
          data-idx="${idx}" 
          data-task="${s.taskType}">
        <div class="task-badge">${s.taskType}</div>
        <img class="thumb-img" src="${s.previewImg || ''}"
             onerror="this.replaceWith(Object.assign(document.createElement('div'),{
               innerText:'(preview unavailable)',
               style:'color:#999;padding:10px;text-align:center;font-size:.8em;background:#eef2f7;border-radius:6px;height:140px;display:flex;align-items:center;justify-content:center'
             }))" />
        <div class="thumb-caption">${s.name}</div>
        <div class="thumb-small">Target: ${s.target}</div>
      </div>`;
  }).join('');

  fetchAndReplaceThumbImages();
}

// Replace thumbnail images with blob URLs
async function fetchAndReplaceThumbImages() {
  const cards = document.querySelectorAll('.thumb-card');
  for (const card of cards) {
    const imgEl = card.querySelector('img.thumb-img');
    const dataIdx = card.dataset.idx;
    const scenario = scenarios[dataIdx];
    const blobUrl = await fetchImageAsBlobURL(scenario.previewImg);
    if (blobUrl) {
      imgEl.src = blobUrl;
    } else {
      imgEl.replaceWith(Object.assign(document.createElement('div'), {
        innerText: 'Image unavailable',
        style: 'color:#999;padding:10px;text-align:center;font-size:.8em;background:#eef2f7;border-radius:6px;height:140px;display:flex;align-items:center;justify-content:center'
      }));
    }
  }
}

// Display frame at index
function displayFrame(i, skipVideoInit = false) {
  if (i < 0 || i >= frames.length) return;
  currentFrameIndex = i;
  const f = frames[i];
  let {label, score} = getTopAnswerer(f.actionData);

  // Handle IGNav/Manips last frame
  if ((currentScenario.taskType === "IGNav" || currentScenario.taskType === "Manip") 
      && f.frameKey === currentScenario.lastFrameKey) {
    const success = (currentScenario.metrics || []).some(m => m.is_success === true);
    if (success) {
      label = "Reached goal";
      score = 1.0;
      f.actions3 = [];
    } else {
      label = "No further action";
      score = null;
      f.actions3 = [];
    }
  }

  const high = typeof score === "number" && score >= 0.95;

  if (!skipVideoInit) {
    const headerHTML = `
    <div class="iteration-header">
      <div><b>Frame ${f.frameNumber}</b> — Closed Loop Iteration</div>
      <div>
        <button class="nav-btn" id="prevBtn" ${currentFrameIndex === 0 ? 'disabled' : ''} onclick="previousFrame()">◀ Previous</button>
        <button class="nav-btn" id="nextBtn" ${currentFrameIndex >= frames.length - 1 ? 'disabled' : ''} onclick="nextFrame()">Next ▶</button>
        <button class="nav-btn" id="finalBtn" ${currentFrameIndex >= frames.length - 1 ? 'disabled' : ''} onclick="goToFinalFrame()">Final ⏭</button>
      </div>
    </div>`;

    const seq = `
      <div class="sequence-indicator">
        <div><b>🔄 Processing Sequence</b></div>
        <div class="sequence-flow">
          <div class="sequence-step ${f.currentStep === 1 ? 'active' : ''}"><span class="flow-num">1</span>Observe</div>
          <div class="sequence-step ${f.currentStep === 2 ? 'active' : ''}"><span class="flow-num">2</span>Plan & Simulate</div>
          <div class="sequence-step ${f.currentStep === 3 ? 'active' : ''}"><span class="flow-num">3</span>Select</div>
        </div>
      </div>`;

    
    // Check if this is the last frame for IGNav
    const isLastFrame = f.frameKey === currentScenario.lastFrameKey;
    const isSpecialLastFrame = (currentScenario.taskType === "IGNav" || currentScenario.taskType === "Manip") && isLastFrame;

    const obsImg = (currentScenario.taskType === "AR") 
      ? `${currentScenario.base}/${f.frameKey}/real_obs_bbox.png`
      : `${currentScenario.base}/${f.frameKey}/real_obs.png`;

    const obs = `
      <div class="step-card ${f.currentStep === 1 ? 'active' : ''}">
        <div class="step-h"><span class="step-num">1</span><span class="step-title">Current Observation</span></div>
        <div class="obs-box">
          <img src="${obsImg}"
               class="obs-img" alt="Current Observation"
               onerror="this.replaceWith(Object.assign(document.createElement('div'),{innerText:'Image unavailable',style:'color:#999;padding:10px'}))">
        </div>
      </div>`;

    // Plan box helper
    // const planBox = (p, isAEQA = false) => {
    //   if (!p) {
    //     return `<div style="padding:12px;text-align:center;color:#999;font-style:italic">
    //       (No planner output for this step)
    //     </div>`;
    //   }
    //   if (isAEQA) {
    //     return `<div class="plan-box">
    //       <div style="font-weight:700;font-size:.85em;margin-bottom:4px">${p?.title || 'High-level Plan'}</div>
    //       <div style="font-size:.8em;color:#555;margin-bottom:4px"><i>${p?.reason || ''}</i></div>
    //       <div style="font-size:.9em">${p?.steps?.[0] || '—'}</div>
    //     </div>`;
    //   }
    //   return `<div class="plan-box">
    //     <div style="font-weight:700;font-size:.8em;margin-bottom:4px">${p?.title || 'Plan'}</div>
    //     <ul style="padding-left:18px">${(p?.steps || []).slice(0, 4).map(s => `<li>${s}</li>`).join('') || '<li>—</li>'}</ul>
    //   </div>`;
    // };
    // Plan box helper - with fold/unfold support
    const planBox = (p, idx, isAEQA = false) => {
      if (!p) {
        return `<div style="padding:12px;text-align:center;color:#999;font-style:italic">
          (No planner output for this step)
        </div>`;
      }
      if (isAEQA) {
        return `<div class="plan-box">
          <div style="font-weight:700;font-size:.9em;margin-bottom:6px">${p?.title || 'Plan'}</div>
          <div style="font-size:.85em;margin-bottom:6px">${p?.actionPlan || '—'}</div>
          <div style="font-size:.75em;color:#666">View: ${p?.view || '—'} | Landmark: ${p?.landmark}</div>
          <div id="aeqa-wm-${f.frameKey}-${p.pngIndex}" style="margin-top:8px"></div>
        </div>`;
      }
      return `<div class="plan-box">
        <div style="font-weight:700;font-size:.8em;margin-bottom:4px">${p?.title || 'Plan'}</div>
        <ul style="padding-left:18px">${(p?.steps || []).slice(0, 4).map(s => `<li>${s}</li>`).join('') || '<li>—</li>'}</ul>
      </div>`;
    };

    // Planning step with fold/unfold
    let sim;
    const hasPlans = f.plans && f.plans.length > 0;
    const planCount = hasPlans ? f.plans.length : 0;
    const showAll = f.showAllPlans || false;
    const visiblePlans = showAll ? f.plans : (f.plans || []).slice(0, 2);

    if (currentScenario.taskType === "AEQA") {
      sim = `
        <div class="step-card ${f.currentStep === 2 ? 'active' : ''}">
          <div class="step-h">
            <span class="step-num">2</span>
            <span class="step-title">High-level Plans & World Model Simulation</span>
            ${planCount > 2 ? `<button class="fold-btn" onclick="togglePlans(${i})" style="margin-left:auto;padding:2px 8px;font-size:.75em;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer">${showAll ? '▲ Fold' : '▼ Show All (' + planCount + ')'}</button>` : ''}
          </div>
          <div class="plan-pairs" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
            ${hasPlans 
              ? visiblePlans.map((p, idx) => planBox(p, idx, true)).join('')
              : `<div style="padding:12px;text-align:center;color:#999;font-style:italic">
                  (No planner data for this step)
                </div>`}
          </div>
        </div>`;
    } else {
      // Check if IGNav last frame with no plans
      if (isSpecialLastFrame && !hasPlans) {
        sim = `
          <div class="step-card ${f.currentStep === 2 ? 'active' : ''}">
            <div class="step-h">
              <span class="step-num">2</span>
              <span class="step-title">Planning & World Model Simulation</span>
            </div>
            <div style="padding:20px;text-align:center;color:#666;font-style:italic">
              Navigation episode completed.
            </div>
          </div>`;
      } else {
          // Normal planning display
          sim = `
            <div class="step-card ${f.currentStep === 2 ? 'active' : ''}">
              <div class="step-h">
                <span class="step-num">2</span>
                <span class="step-title">Planning & World Model Simulation</span>
                ${planCount > 2 ? `<button class="fold-btn" onclick="togglePlans(${i})" style="margin-left:auto;padding:2px 8px;font-size:.75em;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer">${showAll ? '▲ Fold' : '▼ Show All (' + planCount + ')'}</button>` : ''}
              </div>
              <div class="plan-pairs">
                ${hasPlans 
                  ? visiblePlans.map((p, idx) => planBox(p, idx, false)).join('')
                  : `<div style="padding:12px;text-align:center;color:#999;font-style:italic">
                      (No planner data for this step)
                    </div>`}
              </div>
              <div class="sim-grid">
                <div><video id="pred1_${f.frameKey}" autoplay loop muted></video></div>
                <div><video id="pred2_${f.frameKey}" autoplay loop muted></video></div>
              </div>
            </div>`;
        }
      }

    // Action card helper
    const actionCard = (a, idx) => {
      if (!a) {
        return `<div style="padding:12px;text-align:center;color:#999;font-style:italic">
          (No action available for this step)
        </div>`;
      }
      
      // AEQA - show selected plan content
      if (a.isAEQA) {
        const hasAnswer = a.answer && a.answer !== "null";
        return `<div class="plan-box" style="border:2px solid #34a853;background:#f0f9f0;border-radius:8px;padding:12px">
          <div style="font-weight:700;font-size:.95em;margin-bottom:8px">✓ Selected Plan</div>
          <div style="font-size:.9em;margin-bottom:8px"><b>Action:</b> ${a.actionPlan}</div>
          ${hasAnswer ? `<div style="font-size:.9em;color:#2e7d32;margin-bottom:4px"><b>Answer:</b> ${a.answer}</div>` : ''}
          <div style="font-size:.8em;color:#666">View: ${a.view || '—'} | Landmark: ${a.landmark !== null ? a.landmark : 'None'}</div>
        </div>`;
      }
      
      // IGNav - show selected proposal
      if (currentScenario.taskType === "IGNav" && a.steps) {
        return `<div class="plan-box" style="border:2px solid #34a853;background:#f0f9f0;border-radius:8px;padding:12px">
          <div style="font-weight:700;font-size:.95em;margin-bottom:8px">✓ Selected Plan</div>
          <ul style="padding-left:18px;margin:0;text-align:left">
            ${a.steps.map(s => `<li style="font-size:.85em">${s}</li>`).join('')}
          </ul>
        </div>`;
      }
      
      // AR - confidence-based
      const p = typeof a?.conf === 'number' ? a.conf : 0;
      const selected = f.selectedAction === a ? 'style="border:2px solid #34a853;background:rgba(52,168,83,.08);border-radius:8px;padding:8px"' : 'style="border:2px solid #e8eaed;border-radius:8px;padding:8px"';
      const click = high ? '' : `onclick="frames[${i}].selectedAction = frames[${i}].actions3[${idx}] || null; displayFrame(${i});"`;
      return `<div ${selected} ${click}>
        <div style="font-weight:700">${['🥇', '🥈', '🥉'][idx] || ''} ${a?.title || ''}</div>
        <div class="conf-bar"><div class="conf-fill" style="width:${p}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:.8em;color:#666;margin-top:4px">
          <span>${idx === 0 ? 'Top choice' : ''}</span><span>${p}%</span>
        </div>
      </div>`;
    };

    // Decision explanation
    let decide = "";
    if (currentScenario.taskType === "AR") {
      if (high || label === "No further action") {
        decide = `<div class="success-explain">
                    High confidence (≥95%) → stop exploration.
                  </div>`;
      } else {
        decide = `<div style="padding:8px;border-radius:6px;background:#fff3cd;
                    border:1px solid #ffe08a;font-size:.9em">
                    Confidence is <b>${pct(score)}</b> &lt; 95% → continue moving forward.
                  </div>`;
      }
    }

    let actionTitle;
    if (currentScenario.taskType === "IGNav") {
      actionTitle = "Decision";
    } else if (currentScenario.taskType === "AEQA") {
      actionTitle = "Answer Selection";
    } else {
      actionTitle = "Top object";
    }

    // last frame - show success/failure message
    let action;
    if (isSpecialLastFrame && (!f.actions3 || !f.actions3.length)) {
      const success = (currentScenario.metrics || []).some(m => m.is_success === true);
      action = `
        <div class="step-card ${f.currentStep === 3 ? 'active' : ''}">
          <div class="step-h"><span class="step-num">3</span><span class="step-title">Final Result</span></div>
          <div style="padding:20px;text-align:center">
            ${success 
              ? `<div style="padding:16px;border-radius:8px;background:#e8f5e9;border:2px solid #34a853;color:#2e7d32;font-size:0.9em;font-weight:600">
                  Mission Success!<br>
                  <span style="font-size:.7em;font-weight:400">Goal reached successfully.</span>
                </div>`
              : `<div style="padding:16px;border-radius:8px;background:#fce8e6;border:2px solid #ea4335;color:#b00020;font-size:0.9em;font-weight:600">
                  Mission Failed<br>
                  <span style="font-size:.7em;font-weight:400">Did not reach the goal.</span>
                </div>`}
          </div>
        </div>`;
    } else {
      // Normal action card
      action = `
        <div class="step-card ${f.currentStep === 3 ? 'active' : ''}">
          <div class="step-h"><span class="step-num">3</span><span class="step-title">Action Selection</span></div>
          ${currentScenario.taskType !== "AEQA" && currentScenario.taskType !== "IGNav" ? `
          <div class="topline">
            <div><b>${actionTitle}:</b> ${label}</div>
            <div><b>Confidence:</b> ${score === null ? '—' : pct(score)}</div>
          </div>` : ""}
          ${decide || ""}
          <div style="display:grid;gap:8px;margin-top:8px">
            ${(f.actions3 && f.actions3.length) 
              ? (currentScenario.taskType === "IGNav" || currentScenario.taskType === "Manip"
                  ? f.actions3.filter(a => a.steps).map((a, j) => actionCard(a, j)).join('')
                  : f.actions3.map((a, j) => actionCard(a, j)).join(''))
              : `<div style="padding:12px;text-align:center;color:#999;font-style:italic">
                  (No action data for this step.)
                </div>`}
          </div>
        </div>`;
    }

    const stepGridClass = (currentScenario.taskType === "AEQA") 
      ? "step-grid aeqa-layout" 
      : "step-grid";

    const content = (currentScenario.taskType === "AEQA")
      ? `<div class="aeqa-left-col">${obs}${sim}</div>${action}`
      : `${obs}${sim}${action}`;

    document.getElementById('iterationDisplay').innerHTML = `
      ${headerHTML}
      ${f.status === 'current' ? seq : ''}
      <div class="${stepGridClass}">${content}</div>`;
    
    // Load videos for non-AEQA
    if (currentScenario.taskType !== "AEQA") {
      (async () => {
        try {
          const urls = await findUpToTwoVideos(f.frameKey);
          setVideoSrcOrPlaceholder(document.getElementById(`pred1_${f.frameKey}`), urls[0] || null);
          setVideoSrcOrPlaceholder(document.getElementById(`pred2_${f.frameKey}`), urls[1] || null);
        } catch (e) {
          console.warn('video init failed', e);
        }
      })();
    } else {
      // Load AEQA PNGs
      (async () => {
        const visiblePlans = f.showAllPlans ? f.plans : (f.plans || []).slice(0, 2);
        for (const plan of visiblePlans) {
          const pngUrl = `${currentScenario.base}/${f.frameKey}/world_model_gen/bbox_gen_video_${plan.pngIndex}.png`;
          const container = document.getElementById(`aeqa-wm-${f.frameKey}-${plan.pngIndex}`);
          if (container) {
            try {
              const res = await fetch(pngUrl, {method: 'HEAD'});
              if (res.ok) {
                container.innerHTML = `<img src="${pngUrl}" style="max-width:100%;border-radius:4px;margin-top:4px" onerror="this.style.display='none'">`;
              }
            } catch (e) {
              console.warn('PNG not found:', pngUrl);
            }
          }
        }
      })();
    }

  } else {
    // Update step status only
    document.querySelectorAll('.sequence-step').forEach((step, idx) => {
      step.classList.toggle('active', idx + 1 === f.currentStep);
    });
    document.querySelectorAll('.step-card').forEach((card, idx) => {
      card.classList.toggle('active', idx + 1 === f.currentStep);
    });
    const sequenceIndicator = document.querySelector('.sequence-indicator');
    if (sequenceIndicator) {
      sequenceIndicator.style.display = f.status === 'current' ? 'block' : 'none';
    }
  }
}