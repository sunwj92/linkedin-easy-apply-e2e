/* Client-side Easy Apply modal for the local LinkedIn-compatible fixture. */
(function () {
  const job = window.__JOB__;
  const root = document.getElementById('easy-apply-root');
  const trigger = document.querySelector('.jobs-apply-button');
  if (!job || !root || !trigger || !job.easyApply || job.broken) return;

  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_BYTES = 2 * 1024 * 1024;
  const message = {
    required: 'Please enter a valid answer',
    email: 'Please enter a valid email address',
    requiredResume: 'Please upload a resume.',
    fileType: "This file type isn't supported. Please upload a PDF, DOC or DOCX file.",
    fileSize: 'This file is larger than 2 MB. Please upload a smaller file.',
  };

  let modal = null;
  let stepIndex = 0;
  let values = {};
  let resumeFile = null;
  let resumeError = null;
  const touched = new Set();

  const esc = (value = '') =>
    String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  const currentStep = () => job.steps[stepIndex];
  const isReview = (step) => Boolean(step.review);
  const isFileStep = (step) => step.fields.some((field) => field.type === 'file');

  trigger.addEventListener('click', open);

  function open() {
    stepIndex = 0;
    values = {};
    resumeFile = null;
    resumeError = null;
    touched.clear();

    root.innerHTML = `
      <div class="artdeco-modal jobs-easy-apply-modal" role="dialog" aria-modal="true" aria-labelledby="ea-title">
        <header class="artdeco-modal__header">
          <h2 id="ea-title">Apply to ${esc(job.company)}</h2>
          <button type="button" class="artdeco-modal__dismiss" aria-label="Dismiss">✕</button>
        </header>
        <div class="artdeco-modal__content jobs-easy-apply-content"></div>
        <footer class="artdeco-modal__actionbar" data-test-modal-footer></footer>
      </div>`;

    modal = root.querySelector('.jobs-easy-apply-modal');
    modal.querySelector('.artdeco-modal__dismiss').addEventListener('click', close);
    document.body.classList.add('modal-open');
    render();
  }

  function close() {
    root.innerHTML = '';
    modal = null;
    document.body.classList.remove('modal-open');
  }

  function render() {
    const step = currentStep();
    const content = modal.querySelector('.jobs-easy-apply-content');
    const footer = modal.querySelector('.artdeco-modal__actionbar');

    content.innerHTML = progressHtml() + (isReview(step) ? reviewHtml() : formHtml(step));
    footer.innerHTML = footerHtml(step);

    if (isReview(step)) {
      footer.querySelector('[data-easy-apply-submit-button]').addEventListener('click', submit);
      return;
    }

    bindForm(step);
    updateFooterState();
  }

  function progressHtml() {
    const percent = Math.round(((stepIndex + 1) / job.steps.length) * 100);
    return `
      <div class="ea-progress">
        <span class="t-14" data-test-step-label>Step ${stepIndex + 1} of ${job.steps.length}</span>
        <div class="artdeco-completeness-meter-linear__progress-element" role="progressbar"
             aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
          <span style="width:${percent}%"></span>
        </div>
      </div>`;
  }

  function formHtml(step) {
    return `<form id="ea-form" novalidate>${step.fields.map(fieldHtml).join('')}</form>`;
  }

  function fieldHtml(field) {
    const id = `field-${field.id}`;
    const requiredAttr = field.required ? 'required aria-required="true"' : '';

    if (field.type === 'file') {
      return `
        <div class="fb-dash-form-element" data-test-form-element>
          <label class="fb-dash-form-element__label" for="${id}">${esc(field.label)}
            ${field.required ? '<span class="required" aria-hidden="true">*</span>' : ''}</label>
          <input type="file" id="${id}" name="${field.id}" accept="${esc(field.accept)}" ${requiredAttr}>
          <p class="hint">${esc(field.hint)}</p>
          <div class="file-name" data-test-resume-filename>${resumeFile ? esc(resumeFile.name) : ''}</div>
          <div class="artdeco-inline-feedback artdeco-inline-feedback--error" role="alert" hidden></div>
        </div>`;
    }

    return `
      <div class="fb-dash-form-element" data-test-form-element>
        <label class="fb-dash-form-element__label" for="${id}">${esc(field.label)}
          ${field.required ? '<span class="required" aria-hidden="true">*</span>' : ''}</label>
        <input class="artdeco-text-input--input" type="${field.type}" id="${id}" name="${field.id}"
               value="${esc(values[field.id] ?? '')}" autocomplete="${field.autocomplete ?? 'off'}" ${requiredAttr}>
        <div class="artdeco-inline-feedback artdeco-inline-feedback--error" role="alert" hidden></div>
      </div>`;
  }

  function reviewHtml() {
    const rows = job.steps
      .flatMap((step) => step.fields ?? [])
      .map((field) => {
        const value = field.type === 'file' ? (resumeFile ? resumeFile.name : '—') : values[field.id] || '—';
        return `<dt>${esc(field.label)}</dt><dd>${esc(value)}</dd>`;
      })
      .join('');
    return `
      <div class="ea-review" data-test-review>
        <h3>Review your application</h3>
        <dl>${rows}</dl>
        <p class="muted">Submitting sends this application to ${esc(job.company)}.</p>
      </div>`;
  }

  function footerHtml(step) {
    if (isReview(step)) {
      return `<button type="button" class="artdeco-button artdeco-button--primary" data-easy-apply-submit-button
                      aria-label="Submit application">Submit application</button>`;
    }
    const last = stepIndex === job.steps.length - 2;
    return `<button type="button" class="artdeco-button artdeco-button--primary" data-easy-apply-next-button
                    aria-label="${last ? 'Review your application' : 'Continue to next step'}">${last ? 'Review' : 'Next'}</button>`;
  }

  function bindForm(step) {
    const form = modal.querySelector('#ea-form');
    form.addEventListener('submit', (event) => event.preventDefault());

    for (const field of step.fields) {
      const input = modal.querySelector(`#field-${field.id}`);

      if (field.type === 'file') {
        input.addEventListener('change', () => handleFile(input));
        continue;
      }

      input.addEventListener('input', () => {
        values[field.id] = input.value;
        if (touched.has(field.id)) showError(field, validateValue(field, input.value));
        updateFooterState();
      });
      input.addEventListener('blur', () => {
        touched.add(field.id);
        showError(field, validateValue(field, input.value));
      });
    }

    modal.querySelector('[data-easy-apply-next-button]').addEventListener('click', () => {
      if (!validateStep(step)) return;
      if (stepIndex < job.steps.length - 1) {
        stepIndex += 1;
        render();
      }
    });
  }

  function handleFile(input) {
    const file = input.files && input.files[0];
    if (!file) {
      resumeFile = null;
      resumeError = null;
      setFilename('');
      updateFooterState();
      return;
    }

    const error = validateFile(file);
    if (error) {
      resumeFile = null;
      resumeError = error;
      input.value = '';
      setFilename('');
      showError({ id: 'resume' }, error);
    } else {
      resumeFile = file;
      resumeError = null;
      setFilename(file.name);
      showError({ id: 'resume' }, null);
    }
    updateFooterState();
  }

  function validateFile(file) {
    const name = file.name.toLowerCase();
    if (!/\.(pdf|doc|docx)$/.test(name)) return message.fileType;
    if (file.size > MAX_BYTES) return message.fileSize;
    return null;
  }

  function validateValue(field, value) {
    const trimmed = (value ?? '').trim();
    if (field.required && !trimmed) return message.required;
    if (field.type === 'email' && trimmed && !EMAIL.test(trimmed)) return message.email;
    return null;
  }

  function validateStep(step) {
    let valid = true;
    for (const field of step.fields) {
      touched.add(field.id);
      let error = null;
      if (field.type === 'file') {
        if (resumeError) error = resumeError;
        else if (!resumeFile) error = message.requiredResume;
      } else {
        error = validateValue(field, values[field.id] ?? '');
      }
      showError(field, error);
      if (error) valid = false;
    }
    return valid;
  }

  function showError(field, error) {
    const input = modal.querySelector(`#field-${field.id}`);
    if (!input) return;
    const group = input.closest('.fb-dash-form-element');
    const feedback = group.querySelector('.artdeco-inline-feedback--error');
    if (!feedback) return;
    if (error) {
      feedback.textContent = error;
      feedback.hidden = false;
    } else {
      feedback.textContent = '';
      feedback.hidden = true;
    }
  }

  function setFilename(name) {
    const element = modal.querySelector('[data-test-resume-filename]');
    if (element) element.textContent = name;
  }

  function updateFooterState() {
    const step = currentStep();
    if (!step || isReview(step)) return;
    const button = modal.querySelector('[data-easy-apply-next-button]');
    if (!button) return;

    let blocked = false;
    if (isFileStep(step)) {
      blocked = !resumeFile || Boolean(resumeError);
    }
    button.disabled = blocked;
    button.setAttribute('aria-disabled', String(blocked));
  }

  async function submit() {
    const button = modal.querySelector('[data-easy-apply-submit-button]');
    button.disabled = true;
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, title: job.title, values, resume: resumeFile ? resumeFile.name : null }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      modal.querySelector('.jobs-easy-apply-content').innerHTML = `
        <div class="ea-success" data-test-application-sent>
          <h3>Application sent</h3>
          <p>Your application was submitted. (Fixture only — no real application was made.)</p>
        </div>`;
      modal.querySelector('.artdeco-modal__actionbar').innerHTML =
        '<button type="button" class="artdeco-button artdeco-button--primary">Done</button>';
      modal.querySelector('.artdeco-modal__actionbar button').addEventListener('click', close);
    } catch (error) {
      button.disabled = false;
      showError({ id: 'resume' }, `Could not submit: ${error.message}`);
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal) close();
  });
})();
