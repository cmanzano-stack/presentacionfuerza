// ============================================================
// FUERZA GENERATOR — app.js v4.0
// ============================================================

const CONFIG = {
  // Cloudflare Worker URL — reemplaza TUUSUARIO tras el deploy
  PROXY_URL: 'https://hidden-silence-a27f.cmanzano.workers.dev',
  get N8N_WEBHOOK_URL() { return this.PROXY_URL + '/generate'; },
  get N8N_LIST_CLIENTS_URL() { return this.PROXY_URL + '/clients'; },
  MAX_FILE_SIZE: 10 * 1024 * 1024,
};

const state = {
  currentStep: 1,
  totalSteps: 5,
  clientType: 'nuevo',
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
// CLIENTE SELECTOR DINÁMICO
// ============================================================

let clientesLoaded = false;

async function loadExistingClients() {
  if (clientesLoaded) return;
  const loading = document.getElementById('client-loading');
  const select = document.getElementById('existing-client');

  try {
    const res = await fetch(CONFIG.N8N_LIST_CLIENTS_URL);
    if (!res.ok) throw new Error('Error al cargar');
    const data = await res.json();
    const clients = data.clients || [];

    select.innerHTML = '<option value="">Selecciona un cliente…</option>';
    clients.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    if (clients.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No hay clientes existentes aún';
      opt.disabled = true;
      select.appendChild(opt);
    }

    clientesLoaded = true;
  } catch (e) {
    console.error('Error cargando clientes:', e);
    select.innerHTML = '<option value="">Error al cargar — recarga la página</option>';
  } finally {
    loading.style.display = 'none';
    select.style.display = 'block';
  }
}

function setClientType(type) {
  state.clientType = type;
  document.getElementById('btn-nuevo').classList.toggle('active', type === 'nuevo');
  document.getElementById('btn-existente').classList.toggle('active', type === 'existente');
  const existingWrap = document.getElementById('client-existing-wrap');
  const newWrap = document.getElementById('client-new-wrap');
  if (type === 'existente') {
    existingWrap.classList.add('visible');
    newWrap.style.display = 'none';
    loadExistingClients();
  } else {
    existingWrap.classList.remove('visible');
    newWrap.style.display = 'block';
  }
}

function getCompanyName() {
  if (state.clientType === 'existente') {
    return document.getElementById('existing-client').value;
  }
  return document.getElementById('company-name').value.trim();
}

// ============================================================
// NAVEGACIÓN
// ============================================================

function goToStep(step) {
  if (step > state.currentStep) return;
  showStep(step);
}

function nextStep(from) {
  if (!validateStep(from)) return;
  if (from === state.totalSteps - 1) buildSummary();
  showStep(from + 1);
}

function prevStep(from) {
  showStep(from - 1);
}

function showStep(step) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + step).classList.add('active');
  for (let i = 1; i <= state.totalSteps; i++) {
    const ind = document.getElementById('step-ind-' + i);
    ind.classList.remove('active', 'done');
    if (i === step) ind.classList.add('active');
    else if (i < step) ind.classList.add('done');
  }
  state.currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// VALIDACIÓN
// ============================================================

function validateStep(step) {
  let valid = true;

  if (step === 1) {
    if (state.clientType === 'existente') {
      const sel = document.getElementById('existing-client');
      const err = document.getElementById('err-existing');
      const empty = !sel.value;
      sel.classList.toggle('error', empty);
      err.classList.toggle('visible', empty);
      if (empty) valid = false;
    } else {
      valid = requireField('company-name', 'err-company') && valid;
    }
    valid = requireSelect('industry', 'err-industry') && valid;
    valid = requireSelect('team-size', 'err-team-size') && valid;
    valid = requireSelect('team-area', 'err-team-area') && valid;
    valid = requireField('contact-name', 'err-contact') && valid;
    valid = requireEmail('email-kam', 'err-email') && valid;
  }

  if (step === 2) {
    valid = requireField('pain-main', 'err-pain') && valid;
    valid = requireField('pain-impact', 'err-impact') && valid;
    valid = requireField('change-goal', 'err-change') && valid;
  }

  if (step === 3) {
    const driver = document.querySelector('input[name="driver"]:checked');
    const err = document.getElementById('err-driver');
    if (!driver) { err.classList.add('visible'); valid = false; }
    else { err.classList.remove('visible'); }
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

function requireEmail(id, errId) {
  const el = document.getElementById(id);
  const err = document.getElementById(errId);
  const val = el.value.trim();
  const invalid = !val || !val.includes('@');
  el.classList.toggle('error', invalid);
  err.classList.toggle('visible', invalid);
  return !invalid;
}

// ============================================================
// MADUREZ
// ============================================================

function updateMaturity(val) {
  document.getElementById('maturity-label').textContent = MATURITY_LABELS[val] || `Nivel ${val}`;
}

// ============================================================
// ARCHIVOS
// ============================================================

const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });

function handleFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE) { alert(`"${file.name}" supera el límite de 10MB.`); return; }
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
    const icon = file.name.endsWith('.pdf') ? '📄' : file.name.match(/\.pptx?$/) ? '📊' : '📝';
    const size = (file.size / 1024).toFixed(0) + ' KB';
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `<span>${icon}</span><span class="file-chip-name">${file.name}</span><span class="file-chip-size">${size}</span><span class="file-chip-remove" onclick="removeFile('${file.name}')" title="Quitar">×</span>`;
    list.appendChild(chip);
  });
}

// ============================================================
// RESUMEN
// ============================================================

function buildSummary() {
  const get = id => document.getElementById(id).value;
  const getText = (sel, val) => { const o = document.querySelector(`${sel} option[value="${val}"]`); return o ? o.textContent : val; };
  const driver = document.querySelector('input[name="driver"]:checked');

  document.getElementById('summary-empresa').innerHTML = '<div class="card-title">Empresa</div>' + rows([
    ['Cliente', getCompanyName()],
    ['Tipo', state.clientType === 'existente' ? 'Cliente existente' : 'Cliente nuevo'],
    ['Industria', getText('#industry', get('industry'))],
    ['Tamaño equipo', getText('#team-size', get('team-size'))],
    ['Área', getText('#team-area', get('team-area'))],
    ['Contacto', get('contact-name')],
    ['Correo KAM', get('email-kam')],
    ['Inicio', getText('#start-date', get('start-date'))],
  ]);

  document.getElementById('summary-desafio').innerHTML = '<div class="card-title">Desafío</div>' + rows([
    ['Dolor principal', get('pain-main')],
    ['Intentos previos', get('pain-tried') || '—'],
    ['Impacto en negocio', get('pain-impact')],
    ['Cambio esperado', get('change-goal')],
    ['Métrica de éxito', get('success-metric') || '—'],
    ['Madurez digital', MATURITY_LABELS[get('digital-maturity')]],
    ['Objetivo / Driver', driver ? driver.value : '—'],
  ]);

  const mods = [...document.querySelectorAll('.check-grid input:checked')].map(el => {
    const span = el.closest('.check-item')?.querySelector('.check-text');
    if (!span) return el.value;
    const textNode = [...span.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    return textNode ? textNode.textContent.trim() : span.textContent.trim().split('\n')[0].trim();
  }).filter(Boolean);

  document.getElementById('summary-modulos').innerHTML = '<div class="card-title">Módulos y archivos</div>' + rows([
    ['Módulos', mods.length ? mods.join(', ') : 'Todos (no especificados)'],
    ['Archivos adjuntos', state.uploadedFiles.map(f => f.name).join(', ') || 'Ninguno'],
    ['Contexto adicional', get('extra-context') || '—'],
  ]);
}

function rows(pairs) {
  return pairs.map(([k, v]) => `<div class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v || '—'}</span></div>`).join('');
}

// ============================================================
// GENERAR
// ============================================================

async function generatePresentation() {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  showOverlay();

  try {
    setGenStep(1, 'active');
    const filesData = await encodeFiles(state.uploadedFiles);
    setGenStep(1, 'done');

    setGenStep(2, 'active');
    const payload = buildPayload(filesData);
    setGenStep(2, 'done');

    setGenStep(3, 'active');
    const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    setGenStep(3, 'done');

    setGenStep(4, 'active');
    const result = await response.json();
    console.log('🔍 N8N RESPONSE:', JSON.stringify(result).substring(0, 300));
    setGenStep(4, 'done');

    setGenStep(5, 'active');
    const slideUrl = result.presentationUrl || null;
    const exportUrl = result.exportUrl || (slideUrl ? slideUrl.replace('/edit', '/export/pptx') : null);
    setGenStep(5, 'done');

    setTimeout(() => showSuccess(slideUrl, exportUrl, getCompanyName()), 600);

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
  const driver = document.querySelector('input[name="driver"]:checked');

  return {
    company: {
      name: getCompanyName(),
      industry: get('industry'),
      team_size: get('team-size'),
      team_area: get('team-area'),
      contact_name: get('contact-name'),
      start_date: get('start-date'),
    },
    challenge: {
      pain_main: get('pain-main'),
      pain_tried: get('pain-tried'),
      pain_impact: get('pain-impact'),
      change_goal: get('change-goal'),
      success_metric: get('success-metric'),
      digital_maturity: parseInt(get('digital-maturity')),
    },
    driver: driver ? driver.value : '',
    modules: mods.length ? mods : ['reconocimiento_p2p', 'challenges', 'encuestas', 'entrenamientos', 'worklife_rewards', 'premios_nominaciones'],
    extra_context: get('extra-context'),
    email_cliente: get('email-kam'),
    es_cliente_existente: state.clientType === 'existente',
    files: filesData,
    meta: { generated_at: new Date().toISOString(), generator_version: '4.0' },
  };
}

async function encodeFiles(files) {
  const results = [];
  for (const file of files) {
    const base64 = await fileToBase64(file);
    results.push({ name: file.name, type: file.type, size: file.size, data: base64 });
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
// OVERLAY Y SUCCESS
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
  document.getElementById('gstep-' + n).className = 'gen-step ' + status;
  if (status === 'active') {
    const labels = {
      1: 'Preparando archivos adjuntos…',
      2: 'Recopilando datos del formulario…',
      3: 'Generando contenido personalizado con IA…',
      4: 'Creando presentación en Google Slides…',
      5: 'Finalizando y enviando por correo…',
    };
    document.getElementById('gen-status').textContent = labels[n] || '';
  }
}

function showSuccess(slideUrl, exportUrl, companyName) {
  hideOverlay();
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  for (let i = 1; i <= state.totalSteps; i++) {
    const ind = document.getElementById('step-ind-' + i);
    ind.classList.remove('active');
    ind.classList.add('done');
  }
  document.getElementById('success-company').textContent = companyName;
  const btnSlides = document.getElementById('btn-download');
  if (slideUrl) { btnSlides.href = slideUrl; btnSlides.target = '_blank'; btnSlides.style.display = 'inline-flex'; }
  else { btnSlides.style.display = 'none'; }
  document.getElementById('success-state').classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  document.getElementById('success-state').classList.remove('visible');
  document.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(el => el.value = '');
  document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(el => el.checked = false);
  document.getElementById('files-list').innerHTML = '';
  state.uploadedFiles = [];
  state.presentationUrl = null;
  state.exportUrl = null;
  state.clientType = 'nuevo';
  document.getElementById('btn-generate').disabled = false;
  document.getElementById('maturity-label').textContent = MATURITY_LABELS[3];
  document.getElementById('digital-maturity').value = 3;
  setClientType('nuevo');
  showStep(1);
}