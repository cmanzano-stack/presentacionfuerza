// ================================
// CONFIG
// ================================
const CONFIG = {
  N8N_GENERATE_URL: 'https://TU-WORKER.workers.dev/generate',
  N8N_LIST_CLIENTS_URL: 'https://TU-WORKER.workers.dev/clients'
};

// ================================
// STATE
// ================================
let clientsList = [];
let clientsLoaded = false;

const state = {
  clientType: 'nuevo' // nuevo | existente
};

// ================================
// HELPERS
// ================================
function cleanName(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function similarity(a, b) {
  a = cleanName(a);
  b = cleanName(b);

  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / Math.max(a.length, b.length);
}

function findSimilar(name, clients) {
  return clients
    .map(c => ({ name: c, score: similarity(name, c) }))
    .filter(x => x.score > 0.75)
    .sort((a, b) => b.score - a.score);
}

// ================================
// LOAD CLIENTS
// ================================
async function loadExistingClients() {
  if (clientsLoaded) return;

  try {
    const res = await fetch(CONFIG.N8N_LIST_CLIENTS_URL);
    const data = await res.json();

    clientsList = data.clients || [];
    clientsLoaded = true;

  } catch (e) {
    console.error('Error cargando clientes:', e);
  }
}

// ================================
// AUTOCOMPLETE
// ================================
const searchInput = document.getElementById('client-search');
const suggestionsBox = document.getElementById('client-suggestions');

if (searchInput) {
  searchInput.addEventListener('focus', loadExistingClients);

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();

    if (!query) {
      suggestionsBox.innerHTML = '';
      return;
    }

    const filtered = clientsList.filter(c =>
      c.toLowerCase().includes(query.toLowerCase())
    );

    renderSuggestions(filtered.slice(0, 8));

    // fuzzy
    const similar = findSimilar(query, clientsList);
    if (similar.length > 0 && similar[0].score < 1) {
      showSuggestionHint(similar[0].name);
    }
  });
}

function renderSuggestions(list) {
  suggestionsBox.innerHTML = '';

  list.forEach(name => {
    const div = document.createElement('div');
    div.className = 'suggestion-item';
    div.textContent = name;

    div.onclick = () => {
      searchInput.value = name;
      suggestionsBox.innerHTML = '';
      clearHint();
    };

    suggestionsBox.appendChild(div);
  });
}

// ================================
// SUGGESTION HINT
// ================================
function showSuggestionHint(name) {
  let hint = document.getElementById('suggestion-hint');

  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'suggestion-hint';
    hint.style.fontSize = '11px';
    hint.style.color = '#666';
    hint.style.marginTop = '4px';

    searchInput.parentNode.appendChild(hint);
  }

  hint.innerHTML = `¿Quisiste decir <strong>${name}</strong>?`;

  hint.onclick = () => {
    searchInput.value = name;
    hint.innerHTML = '';
  };
}

function clearHint() {
  const hint = document.getElementById('suggestion-hint');
  if (hint) hint.innerHTML = '';
}

// ================================
// CLIENT TYPE SWITCH
// ================================
function setClientType(type) {
  state.clientType = type;

  document.getElementById('client-new').style.display =
    type === 'nuevo' ? 'block' : 'none';

  document.getElementById('client-existing').style.display =
    type === 'existente' ? 'block' : 'none';
}

// ================================
// GET COMPANY NAME
// ================================
function getCompanyName() {
  if (state.clientType === 'existente') {
    return document.getElementById('client-search').value.trim();
  } else {
    return document.getElementById('company-name').value.trim();
  }
}

// ================================
// VALIDATION
// ================================
function normalizeCompanyName(name) {
  const exactMatch = clientsList.find(c => cleanName(c) === cleanName(name));
  return exactMatch || name;
}

// ================================
// SUBMIT FORM
// ================================
async function handleSubmit(e) {
  e.preventDefault();

  let companyName = getCompanyName();

  if (!companyName) {
    alert('Debes ingresar el nombre del cliente');
    return;
  }

  // 🔥 normalizar (evita duplicados tipo falabella vs Falabella)
  companyName = normalizeCompanyName(companyName);

  const formData = new FormData(e.target);

  const payload = {};
  formData.forEach((value, key) => {
    payload[key] = value;
  });

  // sobrescribir con nombre limpio
  payload['Nombre de la empresa'] = companyName;

  try {
    const res = await fetch(CONFIG.N8N_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    console.log('Resultado:', result);

    alert('Presentación generada correctamente 🚀');

  } catch (error) {
    console.error(error);
    alert('Error generando presentación');
  }
}

// ================================
// INIT
// ================================
document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('form-fuerza');
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }

  // botones tipo cliente
  const btnNuevo = document.getElementById('btn-nuevo');
  const btnExistente = document.getElementById('btn-existente');

  if (btnNuevo) btnNuevo.onclick = () => setClientType('nuevo');
  if (btnExistente) btnExistente.onclick = () => setClientType('existente');
});