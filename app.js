// ============================================================
// FUERZA GENERATOR — app.js
// ============================================================

const CONFIG = {
  N8N_WEBHOOK_URL: 'https://n8n.openip.cl/webhook/fuerza-generator',
  MAX_FILE_SIZE: 10 * 1024 * 1024,
};

// ============================================================
// STATE
// ============================================================

const state = {
  currentStep: 1,
  uploadedFiles: [],
  presentationUrl: null,
  exportUrl: null,
};

const MATURITY_LABELS = {
  1: 'Nivel 1 — Sin herramientas digitales',
  2: 'Nivel 2 — Uso básico (Excel, email)',
  3: 'Nivel 3 — Uso mixto de herramientas',
  4: 'Nivel 4 — Digital con datos limitados',
  5: 'Nivel 5 — 100% digital / data-driven',
};

// ============================================================
// STEP NAVIGATION
// ============================================================

function goToStep(step) {
  if (step > state.currentStep) return;
  showStep(step);
}

function nextStep(from) {
  if (!validateStep(from)) return;
  if (from === 3) buildSummary();
  showStep(from + 1);
}

function prevStep(from) {
  showStep(from - 1);
}

function showStep(step) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + step).classList.add('active');

  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById('step-ind-' + i);
    ind.classList.remove('active', 'done');
    if (i === step) ind.classList.add('active');
    else if (i < step) ind.classList.add('done');
  }

  state.currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// VALIDATION
// ============================================================

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    valid = requireField('company-name', 'err-company') && valid;
    valid = requireSelect('industry', 'err-industry') && valid;
    valid = requireSelect('team-size', 'err-team-size') && valid;
    valid = requireSelect('team-area', 'err-team-area') && valid;
    valid = requireField('contact-name', 'err-contact') && valid;
  }

  if (step === 2) {
    valid = requireField('pain-main', 'err-pain') && valid;
    valid = requireField('change-goal', 'err-change') && valid;
  }

  return valid;
}

function requireField(id, errId) {
  const el = document.getElementById(id);
  const err = document.getElementById(errId);
  const empty = !el.value.trim();
  el.classList.toggle('error', empty);
  err.classList.toggle('visible', empty);
  return !empty;
}

function requireSelect(id, errId) {
  const el = document.getElementById(id);
  const err = document.getElementById(errId);
  const empty = !el.value;
  el.classList.toggle('error', empty);
  err.classList.toggle('visible', empty);
  return !empty;
}

// ============================================================
// MATURITY SLIDER
// ============================================================

function updateMaturity(val) {
  document.getElementById('maturity-label').textContent = MATURITY_LABELS[val] || `Nivel ${val}`;
}

// ============================================================
// FILE UPLOAD
// ============================================================

const uploadZone = document.getElementById('upload-zone');

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));

uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer.files);
});

function handleFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      alert(`El archivo "${file.name}" supera el límite de 10MB.`);
      return;
    }
    if (state.uploadedFiles.find(f => f.name === file.name)) return;
    state.uploadedFiles.push(file);
  });
  renderFileList();
}

function removeFile(name) {
  state.uploadedFiles = state.uploadedFiles.filter(f => f.name !== name);
  renderFileList();
}

function renderFileList() {
  const list = document.getElementById('files-list');
  list.innerHTML = '';
  state.uploadedFiles.forEach(file => {
    const icon = file.name.endsWith('.pdf') ? '📄' : file.name.endsWith('.pptx') || file.name.endsWith('.ppt') ? '📊' : '📝';
    const size = (file.size / 1024).toFixed(0) + ' KB';
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <span class="file-chip-icon">${icon}</span>
      <span class="file-chip-name">${file.name}</span>
      <span class="file-chip-size">${size}</span>
      <span class="file-chip-remove" onclick="removeFile('${file.name}')" title="Quitar">×</span>
    `;
    list.appendChild(chip);
  });
}

// ============================================================
// SUMMARY BUILDER
// ============================================================

function buildSummary() {
  const get = id => document.getElementById(id).value;
  const getText = (sel, val) => { const o = document.querySelector(`${sel} option[value="${val}"]`); return o ? o.textContent : val; };

  const empCard = document.getElementById('summary-empresa');
  empCard.innerHTML = '<div class="card-title">Empresa</div>' + rows([
    ['Nombre', get('company-name')],
    ['Industria', getText('#industry', get('industry'))],
    ['Tamaño de equipo', getText('#team-size', get('team-size'))],
    ['Área / Departamento', getText('#team-area', get('team-area'))],
    ['Contacto / Sponsor', get('contact-name')],
    ['Inicio estimado', getText('#start-date', get('start-date') || 'inmediato')],
  ]);

  const desCard = document.getElementById('summary-desafio');
  desCard.innerHTML = '<div class="card-title">Desafío</div>' + rows([
    ['Dolor principal', get('pain-main')],
    ['Intentos previos', get('pain-tried') || '—'],
    ['Cambio esperado', get('change-goal')],
    ['Métrica de éxito', get('success-metric') || '—'],
    ['Madurez digital', MATURITY_LABELS[get('digital-maturity')]],
  ]);

  const mods = [...document.querySelectorAll('.check-grid input:checked')].map(el => {
    const label = el.closest('.check-item')?.querySelector('label');
    const span = label?.querySelector('.check-text');
    if (!span) return el.value;
    const textNode = [...span.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    return textNode ? textNode.textContent.trim() : span.textContent.trim().split('\n')[0].trim();
  }).filter(Boolean);
  const files = state.uploadedFiles.map(f => f.name).join(', ') || 'Ninguno';
  const modCard = document.getElementById('summary-modulos');
  modCard.innerHTML = '<div class="card-title">Módulos y archivos</div>' + rows([
    ['Módulos seleccionados', mods.length ? mods.join(', ') : 'Todos (no especificados)'],
    ['Archivos adjuntos', files],
    ['Contexto adicional', get('extra-context') || '—'],
  ]);
}

function rows(pairs) {
  return pairs.map(([k, v]) => `
    <div class="summary-row">
      <span class="summary-key">${k}</span>
      <span class="summary-val">${v}</span>
    </div>
  `).join('');
}

// ============================================================
// GENERATE PRESENTATION
// ============================================================

async function generatePresentation() {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;

  showOverlay();

  try {
    // Step 1: Encode files to base64
    setGenStep(1, 'active');
    const filesData = await encodeFiles(state.uploadedFiles);
    setGenStep(1, 'done');

    // Step 2: Prepare payload
    setGenStep(2, 'active');
    const payload = buildPayload(filesData);
    setGenStep(2, 'done');

    // Step 3: Call n8n webhook
    setGenStep(3, 'active');
    const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    setGenStep(3, 'done');

    // Step 4: Crear presentación
    setGenStep(4, 'active');
    const result = await response.json();
    console.log('N8N RESPONSE:', JSON.stringify(result).substring(0, 300));
    setGenStep(4, 'done');

    // Step 5: Finalizar
    setGenStep(5, 'active');
    const slideUrl = result.presentationUrl || null;
    const exportUrl = result.exportUrl || (slideUrl ? slideUrl.replace('/edit', '/export/pptx') : null);
    setGenStep(5, 'done');

    setTimeout(() => showSuccess(slideUrl, exportUrl, payload.company.name), 600);

  } catch (err) {
    console.error(err);
    hideOverlay();
    btn.disabled = false;
    alert('Hubo un error al generar la presentación:\n' + err.message + '\n\nVerifica que el webhook de n8n esté activo.');
  }
}

function buildPayload(filesData) {
  const get = id => document.getElementById(id).value;
  const mods = [...document.querySelectorAll('.check-grid input:checked')].map(el => el.value);

  return {
    company: {
      name: get('company-name'),
      industry: get('industry'),
      team_size: get('team-size'),
      team_area: get('team-area'),
      contact_name: get('contact-name'),
    },
    challenge: {
      pain_main: get('pain-main'),
      pain_tried: get('pain-tried'),
      change_goal: get('change-goal'),
      success_metric: get('success-metric'),
      digital_maturity: parseInt(get('digital-maturity')),
      start_date: get('start-date'),
    },
    modules: mods.length ? mods : ['reconocimiento_p2p', 'challenges', 'encuestas', 'entrenamientos', 'worklife_rewards', 'premios_nominaciones'],
    extra_context: get('extra-context'),
    files: filesData,
    meta: {
      generated_at: new Date().toISOString(),
      generator_version: '3.0',
    },
  };
}

async function encodeFiles(files) {
  const results = [];
  for (const file of files) {
    const base64 = await fileToBase64(file);
    results.push({
      name: file.name,
      type: file.type,
      size: file.size,
      data: base64,
    });
  }
  return results;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// OVERLAY UI
// ============================================================

function showOverlay() {
  for (let i = 1; i <= 5; i++) document.getElementById('gstep-' + i).className = 'gen-step';
  document.getElementById('gen-status').textContent = 'Iniciando proceso…';
  document.getElementById('generating-overlay').classList.add('visible');
}

function hideOverlay() {
  document.getElementById('generating-overlay').classList.remove('visible');
}

function setGenStep(n, status) {
  const el = document.getElementById('gstep-' + n);
  el.className = 'gen-step ' + status;
  if (status === 'active') {
    const labels = {
      1: 'Preparando archivos adjuntos…',
      2: 'Recopilando datos del formulario…',
      3: 'Generando contenido personalizado con IA…',
      4: 'Creando presentación en Google Slides…',
      5: 'Finalizando…',
    };
    document.getElementById('gen-status').textContent = labels[n] || '';
  }
}

// ============================================================
// SUCCESS
// ============================================================

function showSuccess(slideUrl, exportUrl, companyName) {
  hideOverlay();

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById('step-ind-' + i);
    ind.classList.remove('active');
    ind.classList.add('done');
  }

  state.presentationUrl = slideUrl;
  state.exportUrl = exportUrl;
  document.getElementById('success-company').textContent = companyName;

  // Botón Ver en Google Slides
  const btnSlides = document.getElementById('btn-download');
  if (slideUrl) {
    btnSlides.href = slideUrl;
    btnSlides.target = '_blank';
    btnSlides.textContent = 'Ver en Google Slides';
    btnSlides.style.display = 'inline-flex';
  } else {
    btnSlides.style.display = 'none';
  }

  // Botón Descargar PPTX
  const btnPptx = document.getElementById('btn-download-pptx');
  if (btnPptx) {
    if (exportUrl) {
      btnPptx.href = exportUrl;
      btnPptx.target = '_blank';
      btnPptx.style.display = 'inline-flex';
    } else {
      btnPptx.style.display = 'none';
    }
  }

  document.getElementById('success-state').classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('success-state').classList.remove('visible');
  document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
  document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
  document.getElementById('files-list').innerHTML = '';
  state.uploadedFiles = [];
  state.presentationUrl = null;
  state.exportUrl = null;
  document.getElementById('btn-generate').disabled = false;
  document.getElementById('maturity-label').textContent = MATURITY_LABELS[3];
  document.getElementById('digital-maturity').value = 3;
  showStep(1);
}
