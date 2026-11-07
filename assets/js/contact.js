/* ==========================================================================
   contact.js  -  sends the contact form and shows clear states

   The destination is the form's own action="" attribute in index.html, so
   there is one place to configure. Three services are understood:

     Web3Forms     action="https://api.web3forms.com/submit"
                   + <input type="hidden" name="access_key" value="YOUR_KEY">
     Formspree     action="https://formspree.io/f/<FORM_ID>"
     Google Apps   action="https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec"

   Whatever happens, a failed send always offers a one-click "send it from
   your email app" link (mailto:) so a visitor can never be stuck.
   ========================================================================== */
(function () {
  'use strict';

  var TO = 'stharooza3@gmail.com';

  var form = document.getElementById('myForm');
  if (!form) return;
  var status = document.getElementById('formStatus');
  var button = form.querySelector('input[type="submit"]');
  var frame = document.getElementById('contactFallback');
  var idleLabel = button ? button.value : 'Send message';

  function val(name) { var el = form.elements[name]; return el && el.value ? el.value : ''; }

  /* a mailto: link that carries what the visitor already typed */
  function mailtoHref() {
    var subject = val('subject') || 'Message from your portfolio website';
    var body = 'Hi Roja,\n\n' + val('message').slice(0, 1200) + '\n\n' + (val('name') ? '- ' + val('name') : '') + (val('email') ? ' (' + val('email') + ')' : '');
    return 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  function say(kind, text, offerMail) {
    status.hidden = false;
    status.className = 'form-status is-' + kind;
    status.textContent = text;
    if (offerMail) {
      var a = document.createElement('a');
      a.className = 'form-mail';
      a.href = mailtoHref();
      a.textContent = 'Send it from your email app instead';
      status.appendChild(document.createTextNode(' '));
      status.appendChild(a);
    }
  }
  function busy(on) {
    button.disabled = on;
    button.value = on ? 'Sending…' : idleLabel;
  }

  function kindOf(url) {
    if (url === 'https://api.web3forms.com/submit') {
      var key = val('access_key');
      return key && !/PASTE/i.test(key) ? 'web3forms' : null;
    }
    if (/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(url)) return 'formspree';
    if (/^https:\/\/script\.google\.com\/macros\/s\/[^\/]+\/exec$/.test(url) && !/PASTE/i.test(url)) return 'apps';
    return null;
  }

  /* Last resort when fetch() itself cannot run: a normal post into a hidden iframe. */
  function fallbackPost() {
    if (!frame) { say('error', 'The message could not be sent from this browser.', true); busy(false); return; }
    say('info', 'Sending your message another way…');
    frame.addEventListener('load', function () {
      say('success', 'Your message was submitted. If you do not hear back, please email me directly.', true);
      form.reset();
      busy(false);
    }, { once: true });
    form.target = 'contactFallback';
    HTMLFormElement.prototype.submit.call(form);   // safe even if a field were named "submit"
    setTimeout(function () { form.target = ''; }, 0);
  }

  function parse(text) { try { return JSON.parse(text); } catch (e) { return null; } }

  function jsonPayload() {
    var o = {};
    new FormData(form).forEach(function (v, k) { o[k] = v; });
    delete o._gotcha; delete o._subject; delete o.submit;
    if (!o.botcheck) delete o.botcheck;            // Web3Forms spam trap: only sent if a bot ticked it
    return o;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.checkValidity()) { form.reportValidity(); return; }

    var honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value) return;               // a bot filled the hidden field

    var endpoint = form.getAttribute('action') || '';
    var kind = kindOf(endpoint);
    if (!kind) {
      say('error', 'The contact form is not connected yet.', true);
      return;
    }

    busy(true);
    say('info', 'Sending your message…');

    var request;
    if (kind === 'web3forms') {
      request = fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(jsonPayload()) });
    } else if (kind === 'formspree') {
      request = fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
    } else {
      // a urlencoded body is a "simple" request: no CORS preflight needed for Apps Script
      request = fetch(endpoint, { method: 'POST', body: new URLSearchParams(new FormData(form)), redirect: 'follow' });
    }

    request
      .then(function (res) {
        return res.text().then(function (text) {
          var data = parse(text);
          if (window.console) console.info('[contact]', kind, 'HTTP', res.status, (text || '').slice(0, 200));
          return { ok: res.ok, data: data, text: text };
        });
      })
      .then(function (r) {
        if (kind === 'web3forms') {
          if (r.data && r.data.success) { say('success', 'Thank you! Your message has been sent. I will get back to you soon.'); form.reset(); return; }
          say('error', (r.data && r.data.message) ? 'Sorry, the message was not sent: ' + r.data.message : 'Sorry, the message could not be sent.', true);
          return;
        }
        if (kind === 'formspree') {
          if (r.ok) { say('success', 'Thank you! Your message has been sent. I will get back to you soon.'); form.reset(); return; }
          var msg = r.data && r.data.errors && r.data.errors.map(function (x) { return x.message; }).join(' ');
          say('error', msg || 'Sorry, the message could not be sent.', true);
          return;
        }
        if (!r.data) { say('error', 'The contact service sent an unexpected reply.', true); return; }
        if (r.data.ok) { say('success', 'Thank you! Your message has been sent. I will get back to you soon.'); form.reset(); }
        else say('error', r.data.error || 'Sorry, the message could not be sent.', true);
      }, function (err) {
        if (window.console) console.error('[contact] fetch failed:', err);
        if (navigator.onLine === false) {
          say('error', 'You appear to be offline, so the message was not sent.', true);
          return 'done';
        }
        fallbackPost();
        return 'fallback';
      })
      .then(function (flag) { if (flag !== 'fallback') busy(false); });
  });
})();