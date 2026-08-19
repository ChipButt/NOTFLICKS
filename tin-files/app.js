(() => {
  'use strict';

  const knockNames = ['slow', 'regular', 'rapid', 'playful', 'panicked'];
  const knockPlayers = {
    slow: [document.getElementById('knock-slow')],
    regular: [document.getElementById('knock-regular-1'), document.getElementById('knock-regular-2')],
    rapid: [document.getElementById('knock-rapid')],
    playful: [document.getElementById('knock-playful')],
    panicked: [document.getElementById('knock-panicked')]
  };
  const allKnockPlayers = Object.values(knockPlayers).flat();
  const knockButtons = Object.fromEntries([...document.querySelectorAll('[data-cue]')].map(button => [button.dataset.cue, button]));
  const knockStatus = document.getElementById('knockStatus');
  const phone = document.getElementById('phone-ring');
  const phoneButton = document.getElementById('phoneButton');
  const phoneButtonText = document.getElementById('phoneButtonText');
  const phoneStatus = document.getElementById('phoneStatus');
  const missingBox = document.getElementById('missingAudio');
  const missingText = document.getElementById('missingAudioText');

  let activeKnock = null;
  let activePlayer = null;
  let regularIndex = 0;
  let phoneRinging = false;

  initialise();

  async function initialise() {
    bindControls();
    await checkAudioFiles();
  }

  function bindControls() {
    for (const name of knockNames) {
      knockButtons[name].addEventListener('click', () => playKnock(name));
      for (const player of knockPlayers[name]) {
        player.addEventListener('ended', () => {
          if (activePlayer === player) clearKnockState();
        });
      }
    }

    phoneButton.addEventListener('click', () => {
      if (phoneRinging) answerPhone();
      else startPhoneCall();
    });
    phone.addEventListener('error', markPhoneUnavailable);
    window.addEventListener('pagehide', stopAllAudio);
  }

  function choosePlayer(name) {
    const players = knockPlayers[name] || [];
    if (!players.length) return null;
    if (name !== 'regular') return players[0];
    const player = players[regularIndex % players.length];
    regularIndex = (regularIndex + 1) % players.length;
    return player;
  }

  async function playKnock(name) {
    if (knockButtons[name]?.disabled) return;
    const player = choosePlayer(name);
    if (!player) return;

    stopKnocks();
    activeKnock = name;
    activePlayer = player;
    knockButtons[name].classList.add('active');
    setStatus(knockStatus, `${name.toUpperCase()} KNOCK`, 'playing');

    try {
      player.currentTime = 0;
      await player.play();
    } catch {
      clearKnockState();
      setStatus(knockStatus, 'AUDIO ERROR', 'error');
    }
  }

  function stopKnocks() {
    for (const player of allKnockPlayers) {
      player.pause();
      try { player.currentTime = 0; } catch {}
    }
    for (const name of knockNames) knockButtons[name]?.classList.remove('active');
    activeKnock = null;
    activePlayer = null;
  }

  function clearKnockState() {
    if (activeKnock) knockButtons[activeKnock]?.classList.remove('active');
    activeKnock = null;
    activePlayer = null;
    setStatus(knockStatus, 'READY');
  }

  async function startPhoneCall() {
    if (phoneButton.disabled) return;
    try {
      phone.currentTime = 0;
      await phone.play();
      phoneRinging = true;
      phoneButton.classList.add('ringing');
      phoneButton.setAttribute('aria-pressed', 'true');
      phoneButtonText.textContent = 'Answer Phone';
      setStatus(phoneStatus, 'RINGING', 'playing');
    } catch {
      answerPhone();
      setStatus(phoneStatus, 'AUDIO ERROR', 'error');
    }
  }

  function answerPhone() {
    phone.pause();
    try { phone.currentTime = 0; } catch {}
    phoneRinging = false;
    phoneButton.classList.remove('ringing');
    phoneButton.setAttribute('aria-pressed', 'false');
    phoneButtonText.textContent = 'Start Phone Call';
    if (!phoneButton.disabled) setStatus(phoneStatus, 'READY');
  }

  function stopAllAudio() {
    stopKnocks();
    clearKnockState();
    answerPhone();
  }

  async function checkAudioFiles() {
    const files = [
      { key: 'slow', label: 'Slow knock', player: knockPlayers.slow[0], type: 'knock' },
      { key: 'regular', label: 'Regular knock 1', player: knockPlayers.regular[0], type: 'knock' },
      { key: 'regular', label: 'Regular knock 2', player: knockPlayers.regular[1], type: 'knock' },
      { key: 'rapid', label: 'Rapid knock', player: knockPlayers.rapid[0], type: 'knock' },
      { key: 'playful', label: 'Playful knock', player: knockPlayers.playful[0], type: 'knock' },
      { key: 'panicked', label: 'Panicked knock', player: knockPlayers.panicked[0], type: 'knock' },
      { key: 'phone', label: 'Rotary phone ring', player: phone, type: 'phone' }
    ];

    const results = await Promise.all(files.map(async file => ({
      ...file,
      exists: await fileExists(file.player.getAttribute('src'))
    })));

    const missing = results.filter(file => !file.exists);

    for (const name of knockNames) {
      const group = results.filter(file => file.type === 'knock' && file.key === name);
      const available = group.some(file => file.exists);
      knockButtons[name].disabled = !available;
      if (!available) knockButtons[name].title = 'Audio file has not been uploaded yet';
    }

    const phoneResult = results.find(file => file.type === 'phone');
    if (!phoneResult?.exists) markPhoneUnavailable();

    if (knockNames.every(name => knockButtons[name].disabled)) setStatus(knockStatus, 'AUDIO NEEDED', 'error');

    if (missing.length) {
      missingBox.hidden = false;
      missingText.textContent = `${missing.map(file => file.label).join(', ')} ${missing.length === 1 ? 'has' : 'have'} not been uploaded to the Tin Files audio folder yet.`;
    } else {
      missingBox.hidden = true;
    }
  }

  async function fileExists(url) {
    try {
      const response = await fetch(`${url}?check=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    }
  }

  function markPhoneUnavailable() {
    answerPhone();
    phoneButton.disabled = true;
    phoneButtonText.textContent = 'Phone Audio Needed';
    setStatus(phoneStatus, 'AUDIO NEEDED', 'error');
  }

  function setStatus(element, text, kind = '') {
    element.textContent = text;
    element.className = `status-light${kind ? ` ${kind}` : ''}`;
  }
})();
