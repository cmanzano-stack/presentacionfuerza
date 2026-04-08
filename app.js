// ============================================================
// FUERZA GENERATOR — app.js (Versión Estabilizada Local)
// Configura estas variables antes de desplegar:
// ============================================================

const CONFIG = {
  // URL del webhook de n8n (reemplaza con tu URL real)
  N8N_WEBHOOK_URL: 'https://n8n.openip.cl/webhook/fuerza-generator',
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
  if (!el || !err) return true; // Elementos no existen en esta vista
  const empty = !el.value.trim();
  el.classList.toggle('error', empty);
  err.classList.toggle('visible', empty);
  return !empty;
}

function requireSelect(id, errId) {
  const el = document.getElementById(id);
  const err = document.getElementById(errId);
  if (!el || !err) return true;
  const empty = !el.value;
  el.classList.toggle('error', empty);
  err.classList.toggle('visible', empty);
  return !empty;
}

// ============================================================
// COMPANY SEARCH (via n8n)
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
    const res = await fetch('https://n8n.openip.cl/webhook/fuerza-company-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: name }),
    });

    if (res.ok) {
      const data = await res.json();
      state.companyInfo = data;
      document.getElementById('ci-name').textContent = data.name || name;
      document.getElementById('ci-desc').textContent = data.summary || 'Información encontrada.';

      if (data.industry_code) {
        const sel = document.getElementById('industry');
        if (sel.querySelector(`option[value="${data.industry_code}"]`)) sel.value = data.industry_code;
      }
      card.classList.add('visible');
    } else {
      throw new Error('Lookup failed');
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
if (uploadZone) {
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', e => { e.preventDefault(); uploadZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
}

function handleFiles(fileList) {
  Array.from(fileList).forEach(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE) { alert(`El archivo "${file.name}" supera el límite de 10MB.`); return; }
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
  if (!list) return;
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
    ['Empresa', get('company-name')],
    ['Industria', getText('#industry', get('industry'))],
    ['Equipo', getText('#team-size', get('team-size'))],
    ['Área', getText('#team-area', get('team-area'))],
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

  const mods = [...document.querySelectorAll('.check-grid input:checked')].map(el => el.nextElementSibling.querySelector('.check-text').childNodes[0].textContent.trim());
  const files = state.uploadedFiles.map(f => f.name).join(', ') || 'Ninguno';
  const modCard = document.getElementById('summary-modulos');
  modCard.innerHTML = '<div class="card-title">Módulos y archivos</div>' + rows([
    ['Módulos seleccionados', mods.length ? mods.join(', ') : 'Todos (no especificados)'],
    ['Archivos adjuntos', files],
    ['Contexto adicional', get('extra-context') || '—'],
  ]);
}

function rows(pairs) {
  return pairs.map(([k, v]) => `<div class="summary-row"><span class="summary-key">${k}</span><span class="summary-val">${v}</span></div>`).join('');
}

// ============================================================
// GENERATE PRESENTATION (LOCAL PPTX GENERATION)
// ============================================================

async function generatePresentation() {
  const btn = document.getElementById('btn-generate');
  btn.disabled = true;
  showOverlay();

  // Guardamos el nombre de la empresa antes de cualquier error
  const companyName = document.getElementById('company-name').value || 'Empresa';

  try {
    // Paso 1: Codificar archivos
    setGenStep(1, 'active');
    const filesData = await encodeFiles(state.uploadedFiles);
    setGenStep(1, 'done');

    // Paso 2: Preparar Payload
    setGenStep(2, 'active');
    const payload = buildPayload(filesData);
    setGenStep(2, 'done');

    // Paso 3: Llamar a n8n (Gemini genera el contenido crudo)
    setGenStep(3, 'active');
    document.getElementById('gen-status').textContent = 'Gemini está generando el contenido personalizado…';

    const response = await fetch(CONFIG.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
    
    // Obtenemos el JSON estructurado desde n8n
    const result = await response.json();
    const plan = result.plan || { cover_subtitle: "Plan de Implementación Fuerza" }; 
    setGenStep(3, 'done');

    // Paso 4: Construir PPTX localmente (OOXML Completo)
    setGenStep(4, 'active');
    document.getElementById('gen-status').textContent = 'Generando archivo PowerPoint válido…';

    // Verificamos que JSZip esté cargado en el navegador
    if (typeof JSZip === 'undefined') {
        throw new Error('La librería JSZip no está cargada. Asegúrate de incluirla en el HTML.');
    }

    const zip = new JSZip();
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // --- A. Estructura de archivos OBLIGATORIOS OOXML ---
    
    // 1. [Content_Types].xml - Define qué es cada archivo dentro del ZIP
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);
    
    // 2. _rels/.rels - Relación principal del paquete
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

    // 3. ppt/presentation.xml - Define la estructura global de la presentación
    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

    // 4. ppt/_rels/presentation.xml.rels - Relaciona la presentación con la slide 1
    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
</Relationships>`);

    // --- B. Creación de la Slide Content ---

    // 5. ppt/slides/slide1.xml - El contenido visual de la diapositiva
    const slide1Content = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Título Portada"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="2000000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="FA345E"/></a:solidFill> </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/><a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr sz="4400" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>
              <a:t>${esc(plan.cover_subtitle || `Plan para ${payload.company.name}`)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtítulo"/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="2500000"/><a:ext cx="10192000" cy="1000000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/><a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr sz="2800"><a:solidFill><a:srgbClr val="1A1A2E"/></a:solidFill></a:rPr>
              <a:t>${esc(payload.company.name.toUpperCase())}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
</p:sld>`;

    zip.file('ppt/slides/slide1.xml', slide1Content);

    // --- C. Generación Final del Archivo ---

    // Generar el blob con el MimeType correcto de PowerPoint
    const blob = await zip.generateAsync({
        type: "blob", 
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        compression: "DEFLATE" // Asegura compatibilidad
    });
    
    const url = URL.createObjectURL(blob);
    const filename = `Fuerza_Plan_${payload.company.name.replace(/\s+/g,'_')}.pptx`;
    
    setGenStep(4, 'done');

    // Paso 5: Finalizar
    setGenStep(5, 'active');
    setGenStep(5, 'done');

    // Mostrar éxito y permitir descarga directa en el navegador
    setTimeout(() => showSuccess(url, filename, payload.company.name), 600);

  } catch (err) {
    console.error(err);
    hideOverlay();
    btn.disabled = false;
    // Usamos el nombre capturado al inicio
    alert(`Hubo un error al generar la presentación para ${companyName}:\n${err.message}`);
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
  for (let i = 1; i <= 5; i++) {
      const stepEl = document.getElementById('gstep-' + i);
      if (stepEl) stepEl.className = 'gen-step';
  }
  document.getElementById('gen-status').textContent = 'Iniciando proceso…';
  document.getElementById('generating-overlay').classList.add('visible');
}

function hideOverlay() {
  document.getElementById('generating-overlay').classList.remove('visible');
}

function setGenStep(n, status) {
  const el = document.getElementById('gstep-' + n);
  if (!el) return;
  el.className = 'gen-step ' + status;
  if (status === 'active') {
    const labels = {
      1: 'Preparando archivos adjuntos…',
      2: 'Recopilando datos del formulario…',
      3: 'Gemini generando contenido personalizado…',
      4: 'Construyendo el PPTX válido en tu navegador…',
      5: 'Finalizando descarga…',
    };
    document.getElementById('gen-status').textContent = labels[n] || '';
  }
}

// ============================================================
// SUCCESS & DOWNLOAD
// ============================================================

function showSuccess(url, filename, companyName) {
  hideOverlay();

  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  for (let i = 1; i <= 4; i++) {
    const ind = document.getElementById('step-ind-' + i);
    if (ind) {
        ind.classList.remove('active');
        ind.classList.add('done');
    }
  }

  state.generatedFileUrl = url;
  document.getElementById('success-company').textContent = companyName;

  const dl = document.getElementById('btn-download');
  if (url) {
    dl.href = url;
    dl.download = filename;
    dl.style.display = 'inline-flex';
    // Opcional: Forzar la descarga automáticamente
    // dl.click();
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
  const infoCard = document.getElementById('company-info-card');
  if (infoCard) infoCard.classList.remove('visible');
  const filesList = document.getElementById('files-list');
  if (filesList) filesList.innerHTML = '';
  
  state.uploadedFiles = [];
  state.companyInfo = null;
  state.generatedFileUrl = null;
  document.getElementById('btn-generate').disabled = false;
  
  const maturityLbl = document.getElementById('maturity-label');
  const maturitySlider = document.getElementById('digital-maturity');
  if (maturityLbl && maturitySlider) {
      maturityLbl.textContent = MATURITY_LABELS[3];
      maturitySlider.value = 3;
  }
  showStep(1);
}
