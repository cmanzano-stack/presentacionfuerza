// ============================================================
// FUERZA GENERATOR — app.js
// Configura estas variables antes de desplegar:
// ============================================================

const CONFIG = {
  // URL del webhook de n8n (reemplaza con tu URL real)
  N8N_WEBHOOK_URL: 'https://TU_N8N.com/webhook/fuerza-generator',
  // Máximo tamaño de archivo en bytes (10MB)
  MAX_FILE_SIZE: 10 * 1024 * 1024,
};

// ============================================================
// STATE
// ============================================================

const state = {
  currentStep: 1,
  companyInfo: null,
  uploadedFiles: [],
  generatedFileUrl: null,
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
  if (step > state.currentStep) return; // can only go back
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

  // Update step indicators
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
// COMPANY SEARCH (via n8n or direct)
// ============================================================

async function searchCompany() {
  const name = document.getElementById('company-name').value.trim();
  if (!name) {
    document.getElementById('company-name').classList.add('error');
    return;
  }

  const indicator = document.getElementById('searching-ind');
  const card = document.getElementById('company-info-card');
  card.classList.remove('visible');
  indicator.classList.add('visible');

  try {
    // Call n8n webhook endpoint for company lookup
    const res = await fetch(CONFIG.N8N_WEBHOOK_URL + '/company-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: name }),
    });

    if (res.ok) {
      const data = await res.json();
      state.companyInfo = data;
      document.getElementById('ci-name').textContent = data.name || name;
      document.getElementById('ci-desc').textContent = data.summary || 'Información encontrada.';

      // Auto-fill industry if detected
      if (data.industry_code) {
        const sel = document.getElementById('industry');
        if (sel.querySelector(`option[value="${data.industry_code}"]`)) {
          sel.value = data.industry_code;
        }
      }
      card.classList.add('visible');
    } else {
      // Fallback: just store the name
      state.companyInfo = { name };
      document.getElementById('ci-name').textContent = name;
      document.getElementById('ci-desc').textContent = 'No se encontró información adicional. El plan se generará con los datos del formulario.';
      card.classList.add('visible');
    }
  } catch (e) {
    state.companyInfo = { name };
    document.getElementById('ci-name').textContent = name;
    document.getElementById('ci-desc').textContent = 'Búsqueda no disponible. El plan se generará con los datos del formulario.';
    card.classList.add('visible');
  } finally {
    indicator.classList.remove('visible');
  }
}

// Search on Enter
document.getElementById('company-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); searchCompany(); }
});

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

  // Empresa
  const empCard = document.getElementById('summary-empresa');
  empCard.innerHTML = '<h4>Empresa</h4>' + rows([
    ['Empresa', get('company-name')],
    ['Industria', getText('#industry', get('industry'))],
    ['Equipo', getText('#team-size', get('team-size'))],
    ['Área', getText('#team-area', get('team-area'))],
    ['Contacto / Sponsor', get('contact-name')],
    ['Inicio estimado', getText('#start-date', get('start-date') || 'inmediato')],
  ]);

  // Desafío
  const desCard = document.getElementById('summary-desafio');
  desCard.innerHTML = '<h4>Desafío</h4>' + rows([
    ['Dolor principal', get('pain-main')],
    ['Intentos previos', get('pain-tried') || '—'],
    ['Cambio esperado', get('change-goal')],
    ['Métrica de éxito (D90)', get('success-metric') || '—'],
    ['Madurez digital', MATURITY_LABELS[get('digital-maturity')]],
  ]);

  // Módulos
  const mods = [...document.querySelectorAll('.check-grid input:checked')].map(el => el.closest('label').querySelector('.check-label-text').childNodes[0].textContent.trim());
  const files = state.uploadedFiles.map(f => f.name).join(', ') || 'Ninguno';
  const modCard = document.getElementById('summary-modulos');
  modCard.innerHTML = '<h4>Módulos y archivos</h4>' + rows([
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
    document.getElementById('gen-status').textContent = 'Gemini está generando el contenido…';

    const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    setGenStep(3, 'done');

    // Step 4 & 5: Building PPTX
    setGenStep(4, 'active');
    document.getElementById('gen-status').textContent = 'Construyendo el PPTX…';

    const result = await response.json();
    setGenStep(4, 'done');

    setGenStep(5, 'active');

    // Result can be a direct file URL or base64
    let downloadUrl = null;
    let filename = `Fuerza_Plan_${payload.company.name.replace(/\s+/g, '_')}_D14-D30-D90.pptx`;

    if (result.file_url) {
      downloadUrl = result.file_url;
    } else if (result.file_base64) {
      const binary = atob(result.file_base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      downloadUrl = URL.createObjectURL(blob);
    }

    setGenStep(5, 'done');

    // Show success
    setTimeout(() => showSuccess(downloadUrl, filename, payload.company.name), 600);

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
      web_info: state.companyInfo || null,
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
      generator_version: '1.0',
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
  // Reset steps
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
      3: 'Gemini generando contenido personalizado…',
      4: 'Construyendo el PPTX…',
      5: 'Finalizando descarga…',
    };
    document.getElementById('gen-status').textContent = labels[n] || '';
  }
}

// ============================================================
// SUCCESS
// ============================================================

function showSuccess(url, filename, companyName) {
  hideOverlay();

  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById('step-ind-' + i);
    ind.classList.remove('active');
    ind.classList.add('done');
  }

  state.generatedFileUrl = url;
  document.getElementById('success-company').textContent = companyName;

  const dl = document.getElementById('btn-download');
  if (url) {
    dl.href = url;
    dl.download = filename;
    dl.style.display = 'inline-flex';
  } else {
    dl.style.display = 'none';
  }

  document.getElementById('success-state').classList.add('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
  // Reset form state
  document.getElementById('success-state').classList.remove('visible');
  document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
  document.querySelectorAll('select').forEach(el => el.selectedIndex = 0);
  document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
  document.getElementById('company-info-card').classList.remove('visible');
  document.getElementById('files-list').innerHTML = '';
  state.uploadedFiles = [];
  state.companyInfo = null;
  state.generatedFileUrl = null;
  document.getElementById('btn-generate').disabled = false;
  document.getElementById('maturity-label').textContent = MATURITY_LABELS[3];
  document.getElementById('digital-maturity').value = 3;
  showStep(1);
}
