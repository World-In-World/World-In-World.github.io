// Frame navigation state
let frames = [];
let currentFrameIndex = 0;
let isRunning = false;
let missionEnded = false;
let isPlaying = false;
let playInterval = null;

// Process current frame (3-step animation)
function processCurrentFrame() {
  const f = frames[currentFrameIndex];
  if (!f || f.completed || missionEnded) return;
  
  // Step 1: Set status and display (includes video init)
  f.status = 'current';
  f.currentStep = 1;
  displayFrame(currentFrameIndex);
  
  setTimeout(() => {
    // Step 2: Update step status (skip video init)
    f.currentStep = 2;
    displayFrame(currentFrameIndex, true);
    
    setTimeout(() => {
      // Step 3: Update step status (skip video init)
      f.currentStep = 3;
      displayFrame(currentFrameIndex, true);
      
      setTimeout(() => {
        // Complete: Check score and decide if mission ends
        const {score} = getTopAnswerer(f.actionData);
        if (score >= 0.95) {
          document.getElementById('finalVideo').style.display = 'block';
          missionEnded = true;
          if (isPlaying) togglePlayback();
        } else if (f.actions3?.length) {
          f.selectedAction = f.actions3[0];
        }
        
        // Mark completed and update display (skip video init)
        f.completed = true;
        f.status = 'completed';
        f.currentStep = 0;
        displayFrame(currentFrameIndex, true);
      }, 800);
    }, 1100);
  }, 700);
}

// Navigate to previous frame
function previousFrame() {
  if (isPlaying) togglePlayback();
  if (currentFrameIndex > 0) {
    const prevIndex = currentFrameIndex - 1;
    displayFrame(prevIndex);
    if (!frames[currentFrameIndex].completed) processCurrentFrame();
  }
}

// Navigate to next frame
function nextFrame() {
  if (isPlaying) togglePlayback();
  if (currentFrameIndex < frames.length - 1) {
    const nextIndex = currentFrameIndex + 1;
    displayFrame(nextIndex);
    if (!frames[currentFrameIndex].completed) processCurrentFrame();
  }
}

// Toggle playback
function togglePlayback() {
  const btn = document.getElementById('playBtn');
  if (missionEnded) return;
  
  if (isPlaying) {
    clearInterval(playInterval);
    btn.textContent = '▶️ Play';
    isPlaying = false;
    return;
  }
  
  btn.textContent = '⏸️ Pause';
  isPlaying = true;
  playInterval = setInterval(() => {
    if (missionEnded || currentFrameIndex >= frames.length - 1) {
      clearInterval(playInterval);
      btn.textContent = '▶️ Play';
      isPlaying = false;
      return;
    }
    nextFrame();
  }, 2600);
}

// Go to final frame
function goToFinalFrame() {
  if (isPlaying) togglePlayback();
  const finalIndex = frames.length - 1;
  if (finalIndex >= 0 && currentFrameIndex !== finalIndex) {
    displayFrame(finalIndex);
    if (!frames[finalIndex].completed) processCurrentFrame();
  }
}

// Toggle plan visibility
function togglePlans(frameIndex) {
  if (frameIndex < 0 || frameIndex >= frames.length) return;
  frames[frameIndex].showAllPlans = !frames[frameIndex].showAllPlans;
  displayFrame(frameIndex);
  
  // Reload AEQA PNGs if needed
  if (currentScenario.taskType === "AEQA" && frames[frameIndex].showAllPlans) {
    const f = frames[frameIndex];
    setTimeout(() => {
      const allPlans = f.plans || [];
      for (const plan of allPlans) {
        const pngUrl = `${currentScenario.base}/${f.frameKey}/world_model_gen/bbox_gen_video_${plan.pngIndex}.png`;
        const container = document.getElementById(`aeqa-wm-${f.frameKey}-${plan.pngIndex}`);
        if (container && !container.querySelector('img')) {
          fetch(pngUrl, {method: 'HEAD'}).then(res => {
            if (res.ok) {
              container.innerHTML = `<img src="${pngUrl}" style="max-width:100%;border-radius:4px;margin-top:4px" onerror="this.style.display='none'">`;
            }
          }).catch(e => console.warn('PNG not found:', pngUrl));
        }
      }
    }, 100);
  }
}

// Make it globally accessible
window.togglePlans = togglePlans;