const evcInput = document.getElementById('evcInput');
const libraryList = document.getElementById('libraryList');
const canvas = document.getElementById('canvas');
const wiresSvg = document.getElementById('wires');
const viewport = document.getElementById('viewport');
const workspace = document.getElementById('workspace');
const statusEl = document.getElementById('status');
const selectModeBtn = document.getElementById('selectMode');
const wireModeBtn = document.getElementById('wireMode');
const editWireModeBtn = document.getElementById('editWireMode');
const deleteWireModeBtn = document.getElementById('deleteWireMode');
const clearWiresBtn = document.getElementById('clearWires');
const thicknessInputs = document.querySelectorAll('input[name="wireThickness"]');
const wireColorPicker = document.getElementById('wireColorPicker');
const applyWireStyleBtn = document.getElementById('applyWireStyleBtn');
const saveProjectBtn = document.getElementById('saveProjectBtn');
const openProjectBtn = document.getElementById('openProjectBtn');
const projectInput = document.getElementById('projectInput');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');

let mode = 'select';
let componentId = 0;
let wireId = 0;
let pendingPort = null;
let currentWireThickness = 'thin';
let currentWireColor = '#2563eb';
let previewMousePoint = null;
let selectedWireId = null;
let draggingNode = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let panState = null;
const wires = [];
const library = [];
const libraryMap = new Map();
const pendingWaypoints = [];

selectModeBtn.addEventListener('click', () => setMode('select'));
wireModeBtn.addEventListener('click', () => setMode('wire'));
editWireModeBtn.addEventListener('click', () => setMode('edit-wire'));
deleteWireModeBtn.addEventListener('click', () => setMode('delete-wire'));
clearWiresBtn.addEventListener('click', () => {
  wires.length = 0;
  clearPendingWire();
  selectedWireId = null;
  drawWires();
  setStatus('Líneas borradas');
});
evcInput.addEventListener('change', handleFiles);
projectInput.addEventListener('change', openProjectFile);
saveProjectBtn.addEventListener('click', saveProject);
openProjectBtn.addEventListener('click', () => projectInput.click());
applyWireStyleBtn.addEventListener('click', applySelectedWireStyle);
zoomInBtn.addEventListener('click', () => changeZoom(1.1));
zoomOutBtn.addEventListener('click', () => changeZoom(0.9));
zoomResetBtn.addEventListener('click', () => {
  zoom = 1;
  panX = 0;
  panY = 0;
  updateViewportTransform();
  drawWires();
  setStatus('Zoom 100%');
});

thicknessInputs.forEach(input => {
  input.addEventListener('change', () => {
    currentWireThickness = input.value;
    setStatus('Espesor seleccionado: ' + (currentWireThickness === 'thin' ? 'delgado' : 'grueso'));
  });
});
wireColorPicker.addEventListener('input', () => {
  currentWireColor = wireColorPicker.value;
  setStatus('Color seleccionado: ' + currentWireColor);
});

workspace.addEventListener('wheel', (e) => {
  e.preventDefault();
  changeZoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
}, { passive: false });


workspace.addEventListener('mousemove', (e) => {
  if(draggingNode){
    const point = snapPoint(getWorkspacePoint(e));
    draggingNode.wire.waypoints[draggingNode.index] = point;
    drawWires();
    return;
  }
  if(mode !== 'wire' || !pendingPort) return;
  previewMousePoint = snapPoint(getWorkspacePoint(e));
  drawWires();
});

workspace.addEventListener('mouseup', () => {
  draggingNode = null;
});

workspace.addEventListener('click', (e) => {
  if (e.target.closest('.component')) return;
  if (e.target.closest('.wire-node')) return;
  if (e.target.closest('path')) return;

  clearSelection();

  if (mode === 'wire' && pendingPort) {
    const point = snapPoint(getWorkspacePoint(e));
    addWaypoint(point);
  }
});



function screenToWorld(clientX, clientY){
  const rect = workspace.getBoundingClientRect();
  return {
    x: (clientX - rect.left - panX) / zoom,
    y: (clientY - rect.top - panY) / zoom
  };
}

function canStartPan(target){
  return !target.closest('.component') && !target.closest('.wire-node');
}

workspace.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (!canStartPan(e.target)) return;
  panState = {
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    moved: false
  };
});

document.addEventListener('mousemove', (e) => {
  if (!panState) return;
  const dx0 = e.clientX - panState.startX;
  const dy0 = e.clientY - panState.startY;
  if (!panState.moved && Math.hypot(dx0, dy0) > 4) {
    panState.moved = true;
    workspace.classList.add('panning');
  }
  if (panState.moved) {
    panX += e.clientX - panState.lastX;
    panY += e.clientY - panState.lastY;
    panState.lastX = e.clientX;
    panState.lastY = e.clientY;
    updateViewportTransform();
    drawWires();
  }
});

document.addEventListener('mouseup', () => {
  if (!panState) return;
  workspace.classList.remove('panning');
  panState = null;
});


function clearSelection(){
  document.querySelectorAll('.component').forEach(c => c.classList.remove('selected'));
  selectedWireId = null;
  drawWires();
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function updateViewportTransform(){
  if (viewport) {
    viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  }
  if (zoomResetBtn) {
    zoomResetBtn.textContent = Math.round(zoom * 100) + '%';
  }
}

function changeZoom(factor, clientX = null, clientY = null){
  const rect = workspace.getBoundingClientRect();
  const mx = clientX === null ? rect.width / 2 : clientX - rect.left;
  const my = clientY === null ? rect.height / 2 : clientY - rect.top;
  const worldX = (mx - panX) / zoom;
  const worldY = (my - panY) / zoom;

  zoom = clamp(zoom * factor, 0.4, 3);

  panX = mx - worldX * zoom;
  panY = my - worldY * zoom;

  updateViewportTransform();
  drawWires();
  setStatus('Zoom ' + Math.round(zoom * 100) + '%');
}

function setMode(newMode){
  mode = newMode;
  selectModeBtn.classList.toggle('active', mode === 'select');
  wireModeBtn.classList.toggle('active', mode === 'wire');
  editWireModeBtn.classList.toggle('active', mode === 'edit-wire');
  deleteWireModeBtn.classList.toggle('active', mode === 'delete-wire');
  workspace.classList.toggle('connect-mode', mode === 'wire');
  if(mode !== 'wire') clearPendingWire();
  if(mode !== 'select') document.querySelectorAll('.component').forEach(c => c.classList.remove('selected'));
  drawWires();
  const label = mode === 'select' ? 'mover' : (mode === 'wire' ? 'conectar' : (mode === 'edit-wire' ? 'editar cable' : 'borrar cable'));
  setStatus('Modo: ' + label);
}

function setStatus(text){ statusEl.textContent = text; }

async function handleFiles(e){
  const files = [...e.target.files];
  for(const file of files){ await loadEvcFile(file, true); }
  renderLibrary();
  e.target.value = '';
}

async function loadEvcFile(file, rerender){
  try{
    const zip = await JSZip.loadAsync(file);
    const json = JSON.parse(await zip.file('component.json').async('string'));
    const imgFile = zip.file('original.png') || zip.file('preview.png');
    const base64 = await imgFile.async('base64');
    const id = json.id || file.name;
    const component = {
      id,
      fileName: file.name,
      name: json.name || file.name,
      width: json.graphics?.size?.width || 120,
      height: json.graphics?.size?.height || 120,
      category: json.category || 'General',
      image: 'data:image/png;base64,' + base64,
      terminals: json.terminals || []
    };
    libraryMap.set(id, component);
    const existing = library.findIndex(item => item.id === id);
    if(existing >= 0) library[existing] = component;
    else library.push(component);
    if(rerender) renderLibrary();
  }catch(err){
    console.error(err);
    alert('No se pudo leer ' + file.name);
  }
}


function getFamilyKey(def) {
  const text = `${def.name || ''} ${def.category || ''}`.toLowerCase();

  if (text.includes('contactor')) return 'contactor';
  if (text.includes('relé térmico') || text.includes('rele termico') || text.includes('térmico') || text.includes('termico')) return 'thermal';
  if (text.includes('guardamotor')) return 'guardamotor';
  if (text.includes('motor')) return 'motor';
  if (text.includes('piloto') || text.includes('led') || text.includes('foco')) return 'pilot';
  if (text.includes('pulsador') || text.includes('emergencia') || text.includes('parada')) return 'pushbutton';
  if (text.includes('barra')) return 'bar';
  if (text.includes('riel')) return 'rail';
  if (text.includes('power supply') || text.includes('fuente')) return 'supply';
  if (text.includes('itm') || text.includes('id ')) return 'breaker';
  if (text.includes('tomacorriente')) return 'socket';
  return 'generic';
}

function computeDisplaySize(def) {
  const sourceW = Number(def.width) || 1200;
  const sourceH = Number(def.height) || 1200;
  const family = getFamilyKey(def);

  const familyRules = {
    contactor:   { targetW: 118, targetH: 238 },
    thermal:     { targetW: 118, targetH: 158 },
    guardamotor: { targetW: 118, targetH: 238 },
    breaker:     { targetW: 82,  targetH: 238 },
    pushbutton:  { targetW: 76,  targetH: 88  },
    pilot:       { targetW: 82,  targetH: 144 },
    motor:       { targetW: 132, targetH: 140 },
    supply:      { targetW: 118, targetH: 206 },
    socket:      { targetW: 92,  targetH: 168 },
    bar:         { targetW: 40,  targetH: 238 },
    rail:        { targetW: 250, targetH: 50  },
    generic:     { targetW: 110, targetH: 150 }
  };

  const rule = familyRules[family] || familyRules.generic;
  const scale = Math.min(rule.targetW / sourceW, rule.targetH / sourceH);

  let width = Math.round(sourceW * scale);
  let height = Math.round(sourceH * scale);

  width = Math.max(28, width);
  height = Math.max(28, height);

  return { width, height };
}


function renderLibrary(){
  libraryList.innerHTML = '';
  library.forEach(component => {
    const div = document.createElement('div');
    div.className = 'library-item';
    div.innerHTML = `
      <img src="${component.image}" alt="${component.name}">
      <strong>${component.name}</strong>
      <small>${component.category} · ${component.terminals.length} bornes</small>
      <button>Insertar</button>
    `;
    div.querySelector('button').addEventListener('click', () => addComponent(component));
    libraryList.appendChild(div);
  });
}

function addComponent(def, options = {}){
  const numericId = ++componentId;
  const id = options.instanceId || ('cmp_' + numericId);
  const el = document.createElement('div');
  el.className = 'component';
  el.dataset.id = id;
  el.dataset.typeId = def.id;
  el.style.left = (options.x ?? 200) + 'px';
  el.style.top = (options.y ?? 150) + 'px';

  const size = computeDisplaySize(def);
  const w = size.width;
  const h = size.height;

  el.style.width = w + 'px';
  el.style.height = h + 'px';

  const img = document.createElement('img');
  img.src = def.image;
  img.alt = def.name;
  el.appendChild(img);

  def.terminals.forEach(t => {
    const x = t.nx ?? (t.position ? t.position.nx : undefined) ?? 0.5;
    const y = t.ny ?? (t.position ? t.position.ny : undefined) ?? 0.5;
    const direction = ((t.direction ?? (t.position ? t.position.direction : undefined) ?? 'top') + '').toLowerCase();

    const port = document.createElement('div');
    port.className = 'port';
    port.dataset.port = t.id;
    port.dataset.signal = t.signal || 'Control';
    port.style.left = `calc(${x * 100}% - 6px)`;
    port.style.top = `calc(${y * 100}% - 6px)`;
    port.title = t.label || t.id;
    port.onclick = (ev) => {
      ev.stopPropagation();
      if(mode !== 'wire') return;
      connectPort(port);
    };
    el.appendChild(port);

    const label = document.createElement('div');
    label.className = 'label';
    label.innerText = t.label || t.id;
    const offset = getLabelOffset(direction);
    label.style.left = `calc(${x * 100}% + ${offset.x}px)`;
    label.style.top = `calc(${y * 100}% + ${offset.y}px)`;
    el.appendChild(label);
  });

  el.addEventListener('mousedown', () => selectComponent(el));
  makeDrag(el);
  canvas.appendChild(el);
  selectComponent(el);

  const match = id.match(/(\d+)$/);
  if(match) componentId = Math.max(componentId, Number(match[1]));
  drawWires();
}

function getLabelOffset(direction){
  switch(direction){
    case 'top': return { x: -10, y: -22 };
    case 'bottom': return { x: -10, y: 12 };
    case 'left': return { x: -28, y: -8 };
    case 'right': return { x: 12, y: -8 };
    default: return { x: -10, y: -22 };
  }
}

function selectComponent(el){
  document.querySelectorAll('.component').forEach(c => c.classList.remove('selected'));
  selectedWireId = null;
  el.classList.add('selected');
  drawWires();
}

function connectPort(port){
  if(!pendingPort){
    pendingPort = port;
    pendingPort.classList.add('pending');
    pendingWaypoints.length = 0;
    previewMousePoint = null;
    setStatus('Conectando desde ' + port.dataset.port + '. Haz clic en el tablero para crear quiebres.');
    drawWires();
    return;
  }
  if(pendingPort === port){
    clearPendingWire();
    drawWires();
    setStatus('Conexión cancelada');
    return;
  }

  wireId += 1;
  wires.push({
    id: 'wire_' + wireId,
    from: getPortRef(pendingPort),
    to: getPortRef(port),
    thickness: currentWireThickness,
    color: currentWireColor,
    waypoints: pendingWaypoints.map(p => ({ x: p.x, y: p.y }))
  });

  selectedWireId = 'wire_' + wireId;
  clearPendingWire();
  drawWires();
  setStatus('Conexión creada');
}

function addWaypoint(point){
  const lastPoint = getPendingLastPoint();
  let snapped = point;
  if(lastPoint){
    const dx = Math.abs(point.x - lastPoint.x);
    const dy = Math.abs(point.y - lastPoint.y);
    snapped = dx >= dy ? { x: point.x, y: lastPoint.y } : { x: lastPoint.x, y: point.y };
  }
  pendingWaypoints.push(snapped);
  previewMousePoint = snapped;
  drawWires();
  setStatus('Quiebre agregado');
}

function getPendingLastPoint(){
  if(pendingWaypoints.length) return pendingWaypoints[pendingWaypoints.length - 1];
  if(pendingPort) return center(pendingPort);
  return null;
}

function clearPendingWire(){
  if(pendingPort) pendingPort.classList.remove('pending');
  pendingPort = null;
  pendingWaypoints.length = 0;
  previewMousePoint = null;
}

function getPortRef(p){
  const comp = p.closest('.component');
  return { componentId: comp.dataset.id, port: p.dataset.port };
}

function findPort(ref){
  const comp = document.querySelector(`[data-id="${ref.componentId}"]`);
  if(!comp) return null;
  return comp.querySelector(`[data-port="${ref.port}"]`);
}

function center(port){
  const r = port.getBoundingClientRect();
  const v = viewport.getBoundingClientRect();
  return {
    x: (r.left - v.left + r.width / 2) / zoom,
    y: (r.top - v.top + r.height / 2) / zoom
  };
}

function getWorkspacePoint(e){
  const rect = workspace.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - panX) / zoom,
    y: (e.clientY - rect.top - panY) / zoom
  };
}

function snapPoint(point){
  const grid = 24;
  return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
}

function buildSmoothCadPath(points){
  if(points.length < 2) return '';
  if(points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  const radius = 10;
  let d = `M ${points[0].x} ${points[0].y}`;
  for(let i = 1; i < points.length - 1; i++){
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if(len1 === 0 || len2 === 0){ d += ` L ${curr.x} ${curr.y}`; continue; }
    const r = Math.min(radius, len1 / 2, len2 / 2);
    const p1 = { x: curr.x - (v1x / len1) * r, y: curr.y - (v1y / len1) * r };
    const p2 = { x: curr.x + (v2x / len2) * r, y: curr.y + (v2y / len2) * r };
    d += ` L ${p1.x} ${p1.y} Q ${curr.x} ${curr.y} ${p2.x} ${p2.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function getWirePoints(wire){
  const fromPort = findPort(wire.from);
  const toPort = findPort(wire.to);
  if(!fromPort || !toPort) return null;

  const start = center(fromPort);
  const end = center(toPort);
  const points = [start, ...(wire.waypoints || []).map(p => ({ x: p.x, y: p.y }))];

  const last = points[points.length - 1];
  if(last.x !== end.x && last.y !== end.y){
    const dx = Math.abs(end.x - last.x);
    const dy = Math.abs(end.y - last.y);
    points.push(dx >= dy ? { x: end.x, y: last.y } : { x: last.x, y: end.y });
  }
  points.push(end);
  return points;
}

function drawWires(){
  wiresSvg.innerHTML = '';

  wires.forEach(w => {
    const points = getWirePoints(w);
    if(!points) return;

    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', buildSmoothCadPath(points));
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '16');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.pointerEvents = 'stroke';
    hitPath.style.cursor = mode === 'delete-wire' || mode === 'edit-wire' ? 'pointer' : 'default';
    hitPath.addEventListener('click', (e) => {
      e.stopPropagation();
      if(mode === 'delete-wire'){
        const idx = wires.findIndex(item => item.id === w.id);
        if(idx >= 0){
          wires.splice(idx, 1);
          if(selectedWireId === w.id) selectedWireId = null;
          drawWires();
          setStatus('Cable eliminado');
        }
      } else {
        document.querySelectorAll('.component').forEach(c => c.classList.remove('selected'));
        selectedWireId = w.id;
        wireColorPicker.value = w.color || '#2563eb';
        currentWireColor = wireColorPicker.value;
        currentWireThickness = w.thickness || 'thin';
        const matching = document.querySelector(`input[name="wireThickness"][value="${currentWireThickness}"]`);
        if(matching) matching.checked = true;
        drawWires();
        setStatus('Cable seleccionado');
      }
    });
    wiresSvg.appendChild(hitPath);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', buildSmoothCadPath(points));
    path.setAttribute('stroke', w.color || '#2563eb');
    path.setAttribute('stroke-width', w.thickness === 'thick' ? '6' : '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('class', 'wire-path' + (selectedWireId === w.id ? ' selected-wire' : ''));
    path.style.pointerEvents = 'none';
    wiresSvg.appendChild(path);

    const showNodes = selectedWireId === w.id;
    (w.waypoints || []).forEach((p, index) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      node.setAttribute('cx', p.x);
      node.setAttribute('cy', p.y);
      node.setAttribute('r', '6');
      node.setAttribute('class', 'wire-node' + (showNodes ? '' : ' hidden'));
      node.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if(mode === 'delete-wire') return;
        draggingNode = { wire: w, index };
      });
      wiresSvg.appendChild(node);
    });
  });

  drawPreviewWire();
}

function drawPreviewWire(){
  if(mode !== 'wire' || !pendingPort) return;
  const start = center(pendingPort);
  const points = [start, ...pendingWaypoints.map(p => ({ x: p.x, y: p.y }))];
  if(previewMousePoint){
    const last = points[points.length - 1];
    const dx = Math.abs(previewMousePoint.x - last.x);
    const dy = Math.abs(previewMousePoint.y - last.y);
    points.push(dx >= dy ? { x: previewMousePoint.x, y: last.y } : { x: last.x, y: previewMousePoint.y });
  }
  if(points.length < 2) return;
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', buildSmoothCadPath(points));
  path.setAttribute('stroke', currentWireColor);
  path.setAttribute('stroke-width', currentWireThickness === 'thick' ? '6' : '3');
  path.setAttribute('fill', 'none');
  path.setAttribute('class', 'preview-segment');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  wiresSvg.appendChild(path);
}

function applySelectedWireStyle(){
  if(!selectedWireId){
    setStatus('Primero selecciona un cable');
    return;
  }
  const wire = wires.find(w => w.id === selectedWireId);
  if(!wire){
    setStatus('Cable no encontrado');
    return;
  }
  wire.color = currentWireColor;
  wire.thickness = currentWireThickness;
  drawWires();
  setStatus('Estilo aplicado al cable seleccionado');
}

function makeDrag(el){
  let sx, sy, ox, oy;
  el.onmousedown = e => {
    if (e.target.closest('.port')) return;
    if (e.target.closest('.wire-node')) return;
    if (mode === 'delete-wire') return;

    sx = e.clientX;
    sy = e.clientY;
    ox = parseFloat(el.style.left) || 0;
    oy = parseFloat(el.style.top) || 0;

    document.onmousemove = m => {
      if (panState && panState.moved) return;
      const dx = (m.clientX - sx) / zoom;
      const dy = (m.clientY - sy) / zoom;
      const grid = 24;
      el.style.left = Math.round((ox + dx) / grid) * grid + 'px';
      el.style.top = Math.round((oy + dy) / grid) * grid + 'px';
      drawWires();
    };
    document.onmouseup = () => {
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
}

function saveProject(){
  const components = [...document.querySelectorAll('.component')].map(el => ({
    instanceId: el.dataset.id,
    typeId: el.dataset.typeId,
    x: parseFloat(el.style.left) || 0,
    y: parseFloat(el.style.top) || 0
  }));
  const payload = {
    version: 1,
    view: { zoom, panX, panY },
    library: library.map(item => ({ id: item.id, fileName: item.fileName, name: item.name })),
    components,
    wires,
    counters: { componentId, wireId }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'proyecto.evd';
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus('Proyecto guardado');
}

async function openProjectFile(e){
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    await restoreProject(data);
    setStatus('Proyecto abierto');
  }catch(err){
    console.error(err);
    alert('No se pudo abrir el proyecto');
  }
  e.target.value = '';
}

async function restoreProject(data){
  clearPendingWire();
  selectedWireId = null;
  canvas.innerHTML = '';
  wires.length = 0;

  const missing = [];
  for(const comp of data.components || []){
    if(!libraryMap.has(comp.typeId)) missing.push(comp.typeId);
  }
  if(missing.length){
    alert('Faltan componentes en la librería cargada: ' + [...new Set(missing)].join(', ') + '. Carga esos .evc antes de abrir el proyecto.');
  }

  componentId = data.counters?.componentId || 0;
  wireId = data.counters?.wireId || 0;
  zoom = data.view?.zoom || 1;
  panX = data.view?.panX || 0;
  panY = data.view?.panY || 0;
  updateViewportTransform();

  for(const comp of data.components || []){
    const def = libraryMap.get(comp.typeId);
    if(def) addComponent(def, { instanceId: comp.instanceId, x: comp.x, y: comp.y });
  }
  (data.wires || []).forEach(w => wires.push({
    id: w.id,
    from: w.from,
    to: w.to,
    thickness: w.thickness || 'thin',
    color: w.color || '#2563eb',
    waypoints: (w.waypoints || []).map(p => ({ x: p.x, y: p.y }))
  }));
  drawWires();
}

updateViewportTransform();



async function loadLibrary(){

  try{

    const response = await fetch("EVC/library.json");
    const data = await response.json();

    for(const path of data.components){

      const res = await fetch("EVC/" + path);
      const blob = await res.blob();

      const file = new File([blob], path);

      await loadEvcFile(file,false);

    }

    renderLibrary();
    setStatus("Biblioteca cargada");

  }catch(err){

    console.error(err);
    setStatus("No se pudo cargar biblioteca");

  }

}


loadLibrary();
