// Video cache
const __videoProbeCache = new Map();

// Probe if URL is a valid video
async function probe(url) {
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {Range: 'bytes=0-127'},
      cache: 'no-store'
    });
    if (!r.ok) return false;
    return (r.headers.get('content-type') || '').toLowerCase().startsWith('video/');
  } catch {
    return false;
  }
}

// Find up to 2 videos for a frame
async function findUpToTwoVideos(k) {
  if (__videoProbeCache.has(k)) return __videoProbeCache.get(k);
  
  const found = [];
  let candidates = [];

  if (currentScenario.taskType === "IGNav") {
    const base = `${currentScenario.base}/${k}/world_model_gen`;
    candidates = [`${base}/bbox_gen_video_1.mp4`, `${base}/bbox_gen_video_2.mp4`];
  } else if (currentScenario.taskType === "AEQA") {
    const base = `${currentScenario.base}/${k}/world_model_gen`;
    candidates = [`${base}/bbox_gen_video_1.png`, `${base}/bbox_gen_video_2.png`, `${base}/bbox_gen_video_3.png`];
    // AEQA uses PNG, return first found
    for (const u of candidates) {
      if (await probe(u)) return [u];
    }
    return [];
  } else {
    const base = `${currentScenario.base}/${k}/world_model_gen/obj_centered_gen_video`;
    candidates = [`${base}.mp4`, `${base}_1.mp4`, `${base}_01.mp4`, `${base}_2.mp4`];
  }

  for (const u of candidates) {
    if (found.length === 2) break;
    if (await probe(u)) found.push(u);
  }
  
  __videoProbeCache.set(k, found);
  return found;
}

// Set video source or hide if unavailable
function setVideoSrcOrPlaceholder(el, url) {
  if (!el) return;
  
  if (url) {
    el.hidden = false;
    el.crossOrigin = "anonymous";
    el.preload = "metadata";
    el.muted = true;
    if (el.src !== url) el.src = url;
    el.onerror = () => {
      el.removeAttribute('src');
      el.hidden = true;
    };
    el.load?.();
  } else {
    el.removeAttribute('src');
    el.hidden = true;
  }
}