/* ==========================================================================
   contact.js  -  sends the contact form and shows clear states
   Works with EITHER service; the destination is the form's own action=""
   attribute in index.html (one place to configure):
     Formspree      action="https://formspree.io/f/<FORM_ID>"
     Google Apps    action="https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('myForm');
  if (!form) return;
  var status = document.getElementById('formStatus');
  var button = form.querySelector('input[type="submit"]');
  var frame = document.getElementById('contactFallback');
  var idleLabel = button ? button.value : 'Send message';

  function say(kind, text) {
    status.hidden = false;
    status.className = 'form-status is-' + kind;
    status.textContent = text;
  }
  function busy(on) {
    button.disabled = on;
    button.value = on ? 'Sending…' : idleLabel;
  }
  function kindOf(url) {
    if (/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(url)) return 'formspree';
    if (/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(url) && !/PASTE/i.test(url)) return 'apps';
    return null;
  }

  /* Last resort when fetch() cannot run: a normal post into a hidden iframe, so the visitor stays on the page. */
  function fallbackPost() {
    if (!frame) { say('error', 'The message could not be sent from this browser. Please email me directly.'); busy(false); return; }
    say('info', 'Sending your message another way…');
    frame.addEventListener('load', function () {
      say('success', 'Your message was submitted. If you do not hear back, please email me directly.');
      form.reset();
      busy(false);
    }, { once: true });
    form.target = 'contactFallback';
    HTMLFormElement.prototype.submit.call(form);   // safe even if a field were named "submit"
    setTimeout(function () { form.target = ''; }, 0);
  }

  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.checkValidity()) { form.reportValidity(); return; }

    var honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value) return;               // a bot filled the hidden field

    var endpoint = form.getAttribute('action') || '';
    var kind = kindOf(endpoint);
    if (!kind) {
      say('error', 'The contact form is not connected yet. Please email me directly at stharooza3@gmail.com.');
      return;
    }

    busy(true);
    say('info', 'Sending your message…');

    var request = kind === 'formspree'
      ? fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      // a urlencoded body is a "simple" request: no CORS preflight needed for Apps Script
      : fetch(endpoint, { method: 'POST', body: new URLSearchParams(new FormData(form)), redirect: 'follow' });

    request
      .then(function (res) { return res.text().then(function (text) { return { ok: res.ok, data: parse(text), text: text }; }); })
      .then(function (r) {
        if (kind === 'formspree') {
          if (r.ok) { say('success', 'Thank you! Your message has been sent. I will get back to you soon.'); form.reset(); return; }
          var msg = r.data && r.data.errors && r.data.errors.map(function (x) { return x.message; }).join(' ');
          say('error', msg || 'Sorry, the message could not be sent. Please try again or email me directly.');
          return;
        }
        if (!r.data) {
          say('error', 'The contact service sent an unexpected reply. Please email me directly at stharooza3@gmail.com.');
          if (window.console) console.error('[contact] not JSON:', r.text.slice(0, 200));
          return;
        }
        if (r.data.ok) { say('success', 'Thank you! Your message has been sent. I will get back to you soon.'); form.reset(); }
        else say('error', r.data.error || 'Sorry, the message could not be sent. Please try again or email me directly.');
      }, function (err) {
        if (window.console) console.error('[contact] fetch failed:', err);
        if (navigator.onLine === false) {
          say('error', 'You appear to be offline, so the message was not sent. Please reconnect and try again.');
          return 'done';
        }
        fallbackPost();
        return 'fallback';
      })
      .then(function (flag) { if (flag !== 'fallback') busy(false); });
  });
})();