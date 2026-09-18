/*
 * ad-break client
 * ---------------
 * Drop this into the site that gets embedded (your Vercel app).
 * It listens for ad-break messages from the parent page and pauses
 * whatever is playing, then resumes when the break ends.
 *
 * Next.js app router: save as /public/adbreak-client.js and add
 *   <script src="/adbreak-client.js" defer />
 * to your root layout. Plain HTML: <script src="adbreak-client.js" defer></script>
 *
 * Games and custom players: listen for the 'adbreak' event —
 *   window.addEventListener('adbreak', e => {
 *     if (e.detail.state === 'start') myGame.pause();
 *     else myGame.resume();
 *   });
 * A [data-adbreak="on"] attribute is also set on <html> during the break,
 * so you can freeze animations from CSS if that's easier.
 */
(function () {
  'use strict';

  // Lock this down once you know where the player is hosted.
  // e.g. var ALLOWED = ['https://yourdomain.com'];
  var ALLOWED = null; // null = accept any parent

  var wasPlaying = [];
  var active = false;

  function media() {
    return Array.prototype.slice.call(document.querySelectorAll('video, audio'));
  }

  function startBreak() {
    if (active) return;
    active = true;
    wasPlaying = [];
    media().forEach(function (m) {
      if (!m.paused && !m.ended) {
        wasPlaying.push(m);
        try { m.pause(); } catch (e) {}
      }
    });
    document.documentElement.setAttribute('data-adbreak', 'on');
    window.dispatchEvent(new CustomEvent('adbreak', { detail: { state: 'start' } }));
  }

  function endBreak() {
    if (!active) return;
    active = false;
    wasPlaying.forEach(function (m) {
      var p = m.play();
      if (p && p.catch) p.catch(function () {});
    });
    wasPlaying = [];
    document.documentElement.removeAttribute('data-adbreak');
    window.dispatchEvent(new CustomEvent('adbreak', { detail: { state: 'end' } }));
  }

  function setMuted(on) {
    media().forEach(function (m) { try { m.muted = !!on; } catch (e) {} });
  }

  function reply(event, type) {
    if (!event.source) return;
    try {
      event.source.postMessage({ type: type, url: location.href }, event.origin || '*');
    } catch (e) {}
  }

  window.addEventListener('message', function (event) {
    if (ALLOWED && ALLOWED.indexOf(event.origin) === -1) return;
    var msg = event.data;
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
    if (msg.type.slice(0, 8) !== 'adbreak:') return;

    switch (msg.type) {
      case 'adbreak:ping':  reply(event, 'adbreak:pong'); break;
      case 'adbreak:start': startBreak(); reply(event, 'adbreak:ack'); break;
      case 'adbreak:end':   endBreak();   reply(event, 'adbreak:ack'); break;
      case 'adbreak:mute':  setMuted(msg.value); break;
    }
  });

  // Announce ourselves so the player knows content control is available.
  if (window.parent && window.parent !== window) {
    try { window.parent.postMessage({ type: 'adbreak:hello', url: location.href }, '*'); }
    catch (e) {}
  }
})();
