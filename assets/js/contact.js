/* ==========================================================================
   contact.js  -  sends the contact form with fetch() and shows clear states
   The destination is the form's own action="" attribute in index.html, so
   there is exactly one place to configure: https://formspree.io/f/YOUR_FORM_ID
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('myForm');
  if (!form) return;
  var status = document.getElementById('formStatus');
  var button = form.querySelector('input[type="submit"]');
  var idleLabel = button ? button.value : 'Send message';

  function say(kind, text) {
    status.hidden = false;
    status.className = 'form-status is-' + kind;
    status.textContent = text;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.checkValidity()) { form.reportValidity(); return; }

    var honeypot = form.querySelector('[name="_gotcha"]');
    if (honeypot && honeypot.value) return;               // a bot filled the hidden field

    var endpoint = form.getAttribute('action') || '';
    if (/YOUR_FORM_ID/.test(endpoint)) {
      say('error', 'The contact form is not connected yet. Please email me directly at stharooza3@gmail.com.');
      return;
    }

    button.disabled = true;
    button.value = 'Sending…';
    say('info', 'Sending your message…');

    fetch(endpoint, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (res.ok) {
          say('success', 'Thank you! Your message has been sent. I will get back to you soon.');
          form.reset();
          return;
        }
        return res.json().then(function (data) {
          var msg = data && data.errors && data.errors.map(function (x) { return x.message; }).join(' ');
          say('error', msg || 'Sorry, the message could not be sent. Please try again or email me directly.');
        }, function () {
          say('error', 'Sorry, the message could not be sent. Please try again or email me directly.');
        });
      })
      .catch(function () {
        say('error', 'Network problem: the message was not sent. Please check your connection or email me directly.');
      })
      .then(function () {
        button.disabled = false;
        button.value = idleLabel;
      });
  });
})();
