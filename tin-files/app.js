(() => {
  'use strict';

  const knockNames = ['slow', 'regular', 'rapid', 'playful', 'panicked'];
  const knockPlayers = Object.fromEntries(knockNames.map(name => [name, document.getElementById(`knock-${name}`)]));
  const knockButtons = Object.fromEntries([...document.querySelectorAll('[data-cue]')].map(button => [button.dataset.cue, button]));
  const knockStatus = document.getElementById('knockStatus');
  const phone = document.getElementById('phone-ring');
  const phoneButton = document.getElementById('phoneButton');
  const phoneButtonText = document.getElementById('phoneButtonText');
  const phoneStatus = document.getElementById('phoneStatus');
  const missingBox = document.getElementById('missingAudio');
  const missingText = document.getElementById('missingAudioText');

  let activeKnock = null;
  let phoneRinging = false;

  initialise();

  async function initialise() {
    bindControls();
    await checkAudioFiles();
  }

  function bindControls() {
    for (const name of knockNames) {
      knockButtons[name].addEventListener('click', () => playKnock(name));
      knockPlayers[name].addEventListener('ended', () => {
        if (activeKnock === name) clearKnockState();
      });
      knockPlayers[name].addEventListener('error', () => markKnockUnavailable(name));
    }

    phoneButton.addEventListener('click', () => {
      if (phoneRinging) answerPhone();
      else startPhoneCall();
    });
    phone.addEventListener('error', markPhoneUnavailable);

    window.addEventListener('pagehide', stopAllAudio);
  }

  async function playKnock(name) {
    const player = knockPlayers[name];
    if (!player || knockButtons[name].disabled) return;

    stopKnocks();
    activeKnock = name;
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
    for (const name of knockNames) {
      const player = knockPlayers[name];
      player.pause();
      try { player.currentTime = 0; } catch {}
      knockButtons[name].classList.remove('active');
    }
    activeKnock = null;
  }

  function clearKnockState() {
    if (activeKnock) knockButtons[activeKnock]?.classList.remove('active');
    activeKnock = null;
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
      ...knockNames.map(name => ({ key: name, label: `${title(name)} knock`, url: knockPlayers[name].getAttribute('src'), type: 'knock' })),
      { key: 'phone', label: 'Rotary phone ring', url: phone.getAttribute('src'), type: 'phone' }
    ];

    const missing = [];
    await Promise.all(files.map(async file => {
      const exists = await fileExists(file.url);
      if (exists) return;
      missing.push(file.label);
      if (file.type === 'phone') markPhoneUnavailable();
      else markKnockUnavailable(file.key);
    }));

    if (missing.length) {
      missingBox.hidden = false;
      missingText.textContent = `${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} not been uploaded to the Tin Files audio folder yet.`;
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

  function markKnockUnavailable(name) {
    const button = knockButtons[name];
    if (!button) return;
    button.disabled = true;
    button.title = 'Audio file has not been uploaded yet';
    if (activeKnock === name) clearKnockState();
    if (knockNames.every(key => knockButtons[key].disabled)) setStatus(knockStatus, 'AUDIO NEEDED', 'error');
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

  function title(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
})();
