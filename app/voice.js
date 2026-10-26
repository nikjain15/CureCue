/* CueVoice: plays the scripted call. Three modes, chosen at load:
   1. clips:   app/audio/manifest.json maps "Speaker|text" to a recorded clip (scripts/make-voices.mjs). Same voices in every browser.
   2. speech:  the browser's own voices (Web Speech API), a different voice and pitch for Rosa, the advocate and the supervisor.
   3. silent:  no audio available or muted; lines appear on a timer, as a transcript would stream. */
window.CueVoice = (function () {
  let mode = "silent", muted = false, voices = {}, manifest = null, holdFlag = false;
  const ctx = {};
  async function init() {
    try { const r = await fetch("audio/manifest.json", { cache: "no-store" }); if (r.ok) { manifest = await r.json(); if (manifest && manifest.clips && Object.keys(manifest.clips).length) mode = "clips"; } } catch (e) { /* no clips */ }
    if (mode !== "clips" && "speechSynthesis" in window) {
      const list = await new Promise(res => { const v = speechSynthesis.getVoices(); if (v.length) return res(v); speechSynthesis.onvoiceschanged = () => res(speechSynthesis.getVoices()); setTimeout(() => res(speechSynthesis.getVoices()), 1200); });
      const en = list.filter(v => /^en/i.test(v.lang));
      if (en.length) {
        const pick = (names) => en.find(v => names.some(n => v.name.includes(n)));
        voices.Rosa = pick(["Samantha (Enhanced)", "Samantha", "Ava", "Allison", "Karen", "Moira", "Google US English", "Aria", "Zira"]) || en[0];
        voices.Advocate = pick(["Daniel", "Tom", "Alex", "Evan", "Nathan", "Google UK English Male", "Guy", "David"]) || en.find(v => v !== voices.Rosa) || en[0];
        voices.Supervisor = pick(["Moira", "Karen", "Tessa", "Fiona", "Google UK English Female", "Hazel", "Susan"]) || en.find(v => v !== voices.Rosa && v !== voices.Advocate) || en[0];
        mode = "speech";
      }
    }
    return mode;
  }
  function warm() { if (mode === "speech") { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } }
  function modeLabel() { if (muted) return "audio off"; return mode === "clips" ? "voices: recorded" : mode === "speech" ? "voice: " + (voices.Rosa ? voices.Rosa.name.split(" ")[0] : "browser") : "transcript only"; }
  function readyNote() { return mode === "clips" ? "The call plays with recorded voices: one for Rosa, one for you, one for the supervisor." : mode === "speech" ? "The call plays with your browser's voices. Mute from the softphone if you prefer the transcript only." : "This browser has no speech voices; the call streams as a transcript."; }
  function toggleMute() { muted = !muted; if (muted) { try { speechSynthesis.cancel(); } catch (e) {} if (ctx.audio) { ctx.audio.pause(); } } return muted; }
  function hold() { holdFlag = true; try { if (mode === "speech") speechSynthesis.pause(); } catch (e) {} if (ctx.audio) ctx.audio.pause(); }
  function resume() { holdFlag = false; try { if (mode === "speech") speechSynthesis.resume(); } catch (e) {} if (ctx.audio && ctx.audioPlaying) ctx.audio.play().catch(() => {}); }
  const timerFor = t => Math.min(2200, 600 + t.length * 22);
  // Plays lines in order. opts: container, onStart(line), onLine(line), isPaused(), onDone()
  function play(lines, opts) {
    let i = 0, stopped = false, timer = null;
    const typing = document.createElement("div"); typing.className = "typing";
    const next = () => {
      if (stopped) return;
      if (opts.isPaused() || holdFlag) { timer = setTimeout(next, 300); return; }
      if (i >= lines.length) return;
      const l = lines[i++];
      typing.textContent = ({ Rosa: "Rosa", Advocate: "You", Supervisor: "Dana (supervisor)" }[l.w] || l.w) + " speaking…"; opts.container.appendChild(typing); opts.container.scrollTop = opts.container.scrollHeight;
      opts.onStart && opts.onStart(l);
      let finished = false; // a clip can report both "ended" and "error"; a line must finish once, or two playback chains run at once
      const done = () => { if (stopped || finished) return; finished = true; typing.remove(); opts.onLine(l); timer = setTimeout(i >= lines.length ? () => opts.onDone && opts.onDone() : next, 700); };
      if (!muted && mode === "clips") {
        const file = manifest.clips[l.w + "|" + l.t];
        if (file) { const a = new Audio("audio/" + file); ctx.audio = a; ctx.audioPlaying = true; a.onended = () => { ctx.audioPlaying = false; done(); }; a.onerror = () => { timer = setTimeout(done, timerFor(l.t)); }; a.play().catch(() => { timer = setTimeout(done, timerFor(l.t)); }); return; }
      }
      if (!muted && mode === "speech") {
        const u = new SpeechSynthesisUtterance(l.t.replace(/\$(\d[\d,]*)/g, "$1 dollars").replace(/\bER\b/g, "E R"));
        u.voice = voices[l.w] || voices.Advocate; u.rate = 0.92; u.volume = 0.55; u.pitch = { Rosa: 1.05, Advocate: 0.85, Supervisor: 1.2 }[l.w] || 1;
        let ended = false; const fin = () => { if (ended) return; ended = true; done(); };
        u.onend = fin; u.onerror = fin; speechSynthesis.speak(u);
        timer = setTimeout(fin, timerFor(l.t) * 3 + 1500); // safety: some browsers never fire onend
        return;
      }
      timer = setTimeout(done, timerFor(l.t));
    };
    timer = setTimeout(next, 500);
    return { stop() { stopped = true; clearTimeout(timer); typing.remove(); try { speechSynthesis.cancel(); } catch (e) {} if (ctx.audio) { ctx.audio.pause(); } } };
  }
  return { init, warm, play, hold, resume, toggleMute, modeLabel, readyNote, get mode() { return mode; } };
})();
