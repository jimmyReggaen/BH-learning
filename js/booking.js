/* ============================================
   BIOMETRICS HOUSE — Booking Flow Controller
   ============================================ */

const STATE_KEY = 'bh-booking-state';

const SK_MONTHS = [
  'JANUÁR', 'FEBRUÁR', 'MAREC', 'APRÍL', 'MÁJ', 'JÚN',
  'JÚL', 'AUGUST', 'SEPTEMBER', 'OKTÓBER', 'NOVEMBER', 'DECEMBER',
];

const TODAY = new Date(2026, 3, 11); // April 11, 2026 — the brief's "today"
TODAY.setHours(0, 0, 0, 0);

/* Mock bookings — replace with backend data later.
   Each entry: { date: 'YYYY-MM-DD', title, full: bool } */
const BOOKED_EVENTS = [
  { date: '2026-04-13', title: 'Konferencia SK-Tech', full: false },
  { date: '2026-04-15', title: 'Launch Pharma AG',    full: false },
  { date: '2026-04-17', title: 'Svadba Nováková',    full: true  },
  { date: '2026-04-18', title: 'Svadba Nováková',    full: true  },
  { date: '2026-04-21', title: 'Workshop UX',        full: false },
  { date: '2026-04-24', title: 'Gala VÚB',           full: true  },
  { date: '2026-04-28', title: 'Meetup AI SK',       full: false },
  { date: '2026-05-02', title: 'Konferencia DEMO',   full: false },
  { date: '2026-05-06', title: 'Private event',      full: true  },
  { date: '2026-05-12', title: 'TEDx Bratislava',    full: false },
];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getBookingsForDate(d) {
  const key = ymd(d);
  return BOOKED_EVENTS.filter((e) => e.date === key);
}

/* ---- ROOMS CATALOG ---- */

const ROOMS = [
  {
    id: 'nexus',
    num: '01',
    name: 'Nexus Gallery',
    capacity: 200,
    area: 594,
    pricePerHour: 180,
    color: '#7B4FFF',
  },
  {
    id: 'observatory',
    num: '02',
    name: 'Observatory',
    capacity: 60,
    area: 120,
    pricePerHour: 140,
    color: '#18D8D0',
  },
  {
    id: 'training',
    num: '03',
    name: 'Training Room',
    capacity: 40,
    area: 65,
    pricePerHour: 95,
    color: '#FF8A3D',
  },
  {
    id: 'bistro',
    num: '04',
    name: 'Bistro Bite',
    capacity: 80,
    area: 95,
    pricePerHour: 110,
    color: '#C558FF',
  },
];

function getRoom(id) {
  return ROOMS.find((r) => r.id === id);
}

/* ---- SEATING CATALOG ---- */

const SEATING_TYPES = [
  {
    id: 'divadlo',
    name: 'Divadlo',
    desc: 'Rady stoličiek bez stolov',
    icon: 'theater',
    capacityFactor: 1.0,   // 100% of room max capacity
    priceExtra: 0,
  },
  {
    id: 'banket',
    name: 'Banket',
    desc: 'Okrúhle stoly po 8–10 osôb',
    icon: 'circle',
    capacityFactor: 0.6,
    priceExtra: 120,
  },
  {
    id: 'classroom',
    name: 'Classroom',
    desc: 'Stoly v radoch s priestorom na písanie',
    icon: 'table',
    capacityFactor: 0.5,
    priceExtra: 80,
  },
  {
    id: 'boardroom',
    name: 'Boardroom',
    desc: 'Jeden dlhý stôl pre rokovanie',
    icon: 'rectangle-horizontal',
    capacityFactor: 0.2,
    priceExtra: 60,
  },
  {
    id: 'cocktail',
    name: 'Cocktail',
    desc: 'Stand-up formát, vysoké stolíky',
    icon: 'wine',
    capacityFactor: 1.2,
    priceExtra: 40,
  },
];

function getSeatingType(id) {
  return SEATING_TYPES.find((s) => s.id === id);
}

/* Seating floorplan images — will be replaced with real PSD exports.
   Key: `${roomId}-${seatingId}`, value: image path.
   When an image is available, it replaces the placeholder. */
const SEATING_IMAGES = {
  // Example: 'nexus-banket': 'images/seating/nexus-banket.png',
};

function hoursBetween(from, to) {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const diff = (th * 60 + tm) - (fh * 60 + fm);
  return Math.max(0, diff / 60);
}

function recomputeTotal() {
  const hours = hoursBetween(state.timeFrom, state.timeTo);
  const roomsSum = state.rooms.reduce((acc, id) => {
    const r = getRoom(id);
    return acc + (r ? r.pricePerHour : 0);
  }, 0);

  // Seating extras — flat fee per room
  const seatingExtra = Object.values(state.seating).reduce((acc, seatId) => {
    const s = getSeatingType(seatId);
    return acc + (s ? s.priceExtra : 0);
  }, 0);

  state.total = Math.round(hours * roomsSum + seatingExtra);
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function formatSk(date) {
  return date.toLocaleDateString('sk-SK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/* ---- STATE ---- */

const defaultState = () => ({
  step: 1,
  maxStepReached: 1,
  date: null,
  timeFrom: '18:00',
  timeTo: '23:00',
  guestCount: 0,
  rooms: [],
  seating: {},
  equipment: [],
  staff: [],
  total: 0,
  viewDate: getMonday(TODAY).toISOString(),
});

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---- NAVIGATION ---- */

function goToStep(n) {
  if (n < 1 || n > 6) return;
  if (n > state.maxStepReached) return; // locked

  // Exit animation on current panel
  const currentPanel = document.querySelector('.step-panel.is-active');
  if (currentPanel && n !== state.step) {
    currentPanel.classList.add('is-exiting');
    currentPanel.addEventListener('animationend', () => {
      currentPanel.classList.remove('is-exiting');
      state.step = n;
      saveState();
      renderStepper();
      renderPanels();
      renderBottomBar();
      const main = document.querySelector('.booking-main');
      if (main) main.scrollTop = 0;
    }, { once: true });
    return;
  }

  state.step = n;
  saveState();
  renderStepper();
  renderPanels();
  renderBottomBar();

  const main = document.querySelector('.booking-main');
  if (main) main.scrollTop = 0;
}

function advance() {
  if (state.step < 6) {
    state.maxStepReached = Math.max(state.maxStepReached, state.step + 1);
    goToStep(state.step + 1);
  } else {
    // Final step: submit inquiry
    alert('Dopyt bude odoslaný tímu Biometrics House.\n\n(Toto je náhľad — submit sa napojí neskôr.)');
  }
}

function goBack() {
  if (state.step > 1) goToStep(state.step - 1);
}

/* ---- RENDER: STEPPER ---- */

function renderStepper() {
  document.querySelectorAll('.step').forEach((el) => {
    const n = parseInt(el.dataset.step, 10);
    el.classList.toggle('is-active', n === state.step);
    el.classList.toggle('is-completed', n < state.maxStepReached);
    el.classList.toggle('is-locked', n > state.maxStepReached);
  });

  // Progress line — fills proportionally to current step
  const ol = document.querySelector('.booking-stepper ol');
  if (ol) {
    const pct = ((state.step - 1) / 5) * 100; // 6 steps, 5 gaps
    ol.style.setProperty('--progress', `${pct}%`);
  }
}

/* ---- RENDER: PANELS ---- */

function renderPanels() {
  document.querySelectorAll('.step-panel').forEach((el) => {
    const n = parseInt(el.dataset.stepPanel, 10);
    el.classList.toggle('is-active', n === state.step);
  });

  // Render step-specific dynamic content
  if (state.step === 2) {
    renderRooms();
    // Sync guest count into step 2 input
    const s2g = document.getElementById('step2GuestCount');
    if (s2g) s2g.value = state.guestCount > 0 ? state.guestCount : '';
  }
  if (state.step === 3) renderSeating();
}

/* ---- RENDER: BOTTOM BAR ---- */

function renderBottomBar() {
  document.getElementById('backBtn').disabled = state.step === 1;
  const nextBtn = document.getElementById('nextBtn');
  nextBtn.textContent = state.step === 6 ? 'Odoslať dopyt →' : 'Pokračovať →';

  // Gate the Next button per step
  if (state.step === 1) {
    nextBtn.disabled = !state.date;
  } else if (state.step === 2) {
    nextBtn.disabled = state.rooms.length === 0;
  } else if (state.step === 3) {
    // All selected rooms must have a seating type
    const allConfigured = state.rooms.length > 0 && state.rooms.every((id) => state.seating[id]);
    nextBtn.disabled = !allConfigured;
  } else {
    nextBtn.disabled = false;
  }

  // Toggle bottom bar variants
  const bottomDefault = document.getElementById('bottomDefault');
  const bottomStep2 = document.getElementById('bottomStep2');
  if (bottomDefault && bottomStep2) {
    const isStep2 = state.step === 2;
    bottomDefault.style.display = isStep2 ? 'none' : '';
    bottomStep2.classList.toggle('is-visible', isStep2);

    if (isStep2) {
      const h = hoursBetween(state.timeFrom, state.timeTo);
      document.getElementById('s2Count').textContent = String(state.rooms.length);
      document.getElementById('s2Hours').textContent = `${h % 1 === 0 ? h : h.toFixed(1)}h`;
      document.getElementById('s2Subtotal').textContent = `${state.total.toLocaleString('sk-SK')} €`;
    }
  }

  // Total value (for non-step-2 views)
  const valueEl = document.getElementById('totalValue');
  const oldText = valueEl.textContent;
  const newText = `${state.total.toLocaleString('sk-SK')} €`;
  valueEl.textContent = newText;

  // Pulse when value actually changes
  if (oldText !== newText && oldText !== '0 €') {
    valueEl.classList.remove('is-pulse');
    void valueEl.offsetWidth; // force reflow for re-trigger
    valueEl.classList.add('is-pulse');
    valueEl.addEventListener('animationend', () => {
      valueEl.classList.remove('is-pulse');
    }, { once: true });
  }
}

/* ---- RENDER: MONTH GRID ---- */

function renderMonthGrid() {
  const viewDate = new Date(state.viewDate);
  const viewMonth = viewDate.getMonth();
  const viewYear = viewDate.getFullYear();

  document.getElementById('monthLabel').textContent =
    `${SK_MONTHS[viewMonth]} ${viewYear}`;

  const grid = document.getElementById('monthGrid');
  grid.innerHTML = '';

  // First day of month, then back up to Monday
  const first = new Date(viewYear, viewMonth, 1);
  const gridStart = getMonday(first);

  const selectedDate = state.date ? new Date(state.date) : null;

  // 6 rows × 7 cols = 42 cells
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);

    const isOtherMonth = d.getMonth() !== viewMonth;
    const isPast = d < TODAY;
    const isToday = sameDay(d, TODAY);
    const isSelected = selectedDate && sameDay(selectedDate, d);
    const bookings = getBookingsForDate(d);
    const isFull = bookings.some((b) => b.full);

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'daycell';
    if (isOtherMonth) cell.classList.add('is-other-month');
    if (isPast) { cell.classList.add('is-past'); cell.disabled = true; }
    if (isFull && !isPast) { cell.classList.add('is-full'); cell.disabled = true; }
    if (isSelected) cell.classList.add('is-selected');
    if (isToday) cell.setAttribute('data-today', 'true');

    const num = document.createElement('span');
    num.className = 'daycell__num';
    num.textContent = d.getDate();
    cell.appendChild(num);

    if (!isOtherMonth && bookings.length) {
      const evs = document.createElement('span');
      evs.className = 'daycell__events';
      bookings.slice(0, 2).forEach((b) => {
        const chip = document.createElement('span');
        chip.className = 'daycell__event' + (b.full ? ' daycell__event--full' : '');
        chip.textContent = b.title;
        evs.appendChild(chip);
      });
      cell.appendChild(evs);
    }

    if (!cell.disabled && !isOtherMonth) {
      cell.addEventListener('click', () => selectDate(d));
    }
    grid.appendChild(cell);
  }

  // Update selection hint
  const hint = document.getElementById('selectedDateHint');
  if (hint) {
    if (selectedDate) {
      hint.textContent = `Vybraté: ${formatSk(selectedDate)}`;
      hint.classList.add('is-visible');
    } else {
      hint.textContent = 'Zatiaľ nie je vybratý žiadny deň.';
      hint.classList.remove('is-visible');
    }
  }
}

function selectDate(d) {
  state.date = d.toISOString();
  saveState();
  renderMonthGrid();
  renderStep1Rail();
  renderBottomBar();
}

/* ---- ROOM RECOMMENDATION ENGINE ---- */

function recommendRooms(guestCount) {
  if (!guestCount || guestCount < 1) return null;

  const sorted = [...ROOMS].sort((a, b) => a.capacity - b.capacity);
  const totalCapacity = ROOMS.reduce((s, r) => s + r.capacity, 0);

  // Over max capacity
  if (guestCount > totalCapacity) {
    return { type: 'over', maxCapacity: totalCapacity };
  }

  // Try single room — smallest that fits
  const single = sorted.find((r) => r.capacity >= guestCount);
  if (single) {
    return { type: 'single', rooms: [single], totalCapacity: single.capacity };
  }

  // Try two-room combos — find the pair with smallest excess capacity
  let bestCombo = null;
  let bestExcess = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const cap = sorted[i].capacity + sorted[j].capacity;
      if (cap >= guestCount && cap - guestCount < bestExcess) {
        bestExcess = cap - guestCount;
        bestCombo = [sorted[i], sorted[j]];
      }
    }
  }
  if (bestCombo) {
    const totalCap = bestCombo.reduce((s, r) => s + r.capacity, 0);
    return { type: 'combo', rooms: bestCombo, totalCapacity: totalCap };
  }

  // Three or more rooms
  const allNeeded = sorted.filter(Boolean);
  const totalCap = allNeeded.reduce((s, r) => s + r.capacity, 0);
  if (totalCap >= guestCount) {
    // Greedily add rooms from largest until we hit count
    const desc = [...ROOMS].sort((a, b) => b.capacity - a.capacity);
    const result = [];
    let running = 0;
    for (const r of desc) {
      result.push(r);
      running += r.capacity;
      if (running >= guestCount) break;
    }
    return { type: 'combo', rooms: result, totalCapacity: running };
  }

  return { type: 'over', maxCapacity: totalCapacity };
}

function renderStep1Rail() {
  const rail = document.querySelector('.step1-rail');
  if (!rail) return;
  rail.classList.toggle('is-inactive', !state.date);
}

function renderRecommendation() {
  const recoEl = document.getElementById('roomReco');
  if (!recoEl) return;

  const count = state.guestCount;
  const reco = recommendRooms(count);

  if (!reco) {
    recoEl.classList.remove('is-visible');
    state.rooms = [];
    recomputeTotal();
    saveState();
    renderBottomBar();
    return;
  }

  recoEl.classList.remove('is-visible');
  // Force reflow for re-animation
  void recoEl.offsetWidth;

  if (reco.type === 'over') {
    recoEl.innerHTML = `
      <span class="room-reco__title">Kapacita</span>
      <p class="room-reco__over">
        Maximálna kapacita všetkých priestorov je <strong>${reco.maxCapacity} osôb</strong>.
        Pre ${count} hostí nás kontaktujte — nájdeme riešenie.
      </p>
    `;
    recoEl.classList.add('is-visible');
    return;
  }

  const isSingle = reco.type === 'single';
  const roomNames = reco.rooms.map((r) => `<strong>${r.name}</strong>`).join(' + ');
  const text = isSingle
    ? `Pre ${count} hostí odporúčame ${roomNames}.`
    : `Pre ${count} hostí odporúčame kombináciu ${roomNames}.`;

  const chips = reco.rooms.map((r) =>
    `<button type="button" class="room-reco__chip" data-reco-room="${r.id}">
      <span class="room-reco__chip-dot" style="background:${r.color}"></span>
      ${r.name}
      <span class="room-reco__chip-cap">${r.capacity} os.</span>
    </button>`
  ).join('');

  recoEl.innerHTML = `
    <span class="room-reco__title">Odporúčanie</span>
    <p class="room-reco__text">${text}</p>
    <div class="room-reco__chips">${chips}</div>
  `;
  recoEl.classList.add('is-visible');

  // Auto-apply recommended rooms to state so price updates live
  const recoIds = reco.rooms.map((r) => r.id);
  state.rooms = [...recoIds];
  recomputeTotal();
  saveState();
  renderBottomBar();
}

/* ---- RENDER: ROOMS + FLOORPLAN (step 2) ---- */

function renderRooms() {
  const list = document.getElementById('roomsList');
  if (!list) return;
  list.innerHTML = '';

  ROOMS.forEach((r) => {
    const selected = state.rooms.includes(r.id);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'room' + (selected ? ' is-selected' : '');
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.setAttribute('data-room-row', r.id);
    btn.style.setProperty('--room-color', r.color);
    btn.innerHTML = `
      <span class="room__num">${r.num}</span>
      <span class="room__body">
        <span class="room__name">${r.name}</span>
        <span class="room__meta">${r.capacity} ľudí · ${r.area} m²</span>
        <span class="room__price">${r.pricePerHour} €<span> / hod</span></span>
      </span>
      <span class="room__toggle">+</span>
    `;
    btn.addEventListener('click', () => toggleRoom(r.id));
    btn.addEventListener('mouseenter', () => previewRoom(r.id, true));
    btn.addEventListener('mouseleave', () => previewRoom(r.id, false));
    list.appendChild(btn);
  });

  renderFloorplan();
  updateFloorplanCounter();
}

function renderFloorplan() {
  // Hit-zone rings (SVG)
  document.querySelectorAll('.fp-room').forEach((g) => {
    const id = g.dataset.room;
    const room = getRoom(id);
    const selected = state.rooms.includes(id);
    g.classList.toggle('is-selected', selected);
    g.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (room) g.style.setProperty('--room-color', room.color);
  });
  // PNG overlays
  document.querySelectorAll('.fp-overlay').forEach((img) => {
    const id = img.dataset.roomOverlay;
    img.classList.toggle('is-visible', state.rooms.includes(id));
  });
}

function updateFloorplanCounter() {
  const el = document.getElementById('floorplanCounter');
  if (el) {
    const n = state.rooms.length;
    const word = n === 1 ? 'miestnosť vybraná' : (n >= 2 && n <= 4) ? 'miestnosti vybrané' : 'miestností vybraných';
    el.textContent = `${n} ${word}`;
  }
  renderRailSummary();
}

function renderRailSummary() {}

function toggleRoom(id) {
  const wasSelected = state.rooms.includes(id);
  const idx = state.rooms.indexOf(id);
  if (idx === -1) state.rooms.push(id);
  else state.rooms.splice(idx, 1);
  recomputeTotal();
  saveState();
  renderRooms();
  renderBottomBar();

  // Pop feedback on newly selected room
  if (!wasSelected) {
    const row = document.querySelector(`.room[data-room-row="${id}"]`);
    if (row) {
      row.classList.add('just-toggled');
      row.addEventListener('animationend', () => {
        row.classList.remove('just-toggled');
      }, { once: true });
    }
  }
}

function previewRoom(id, on) {
  const overlay = document.querySelector(`.fp-overlay[data-room-overlay="${id}"]`);
  if (overlay) overlay.classList.toggle('is-preview', on);
  const hit = document.querySelector(`.fp-room[data-room="${id}"]`);
  if (hit) hit.classList.toggle('is-preview', on);
  const row = document.querySelector(`.room[data-room-row="${id}"]`);
  if (row) row.classList.toggle('is-preview', on);
}

/* ---- RENDER: SEATING (step 3) ---- */

/* Track which room tab is active in step 3 */
let activeSeatingRoom = null;

function renderSeating() {
  renderSeatingTabs();
  renderSeatingTypes();
  renderSeatingFloorplan();
  renderSeatingSummary();
}

function renderSeatingTabs() {
  const wrap = document.getElementById('seatingRoomTabs');
  if (!wrap) return;
  wrap.innerHTML = '';

  // Only show rooms selected in step 2
  const selectedRooms = state.rooms.map(getRoom).filter(Boolean);
  if (selectedRooms.length === 0) {
    wrap.innerHTML = '<span class="seating-floorplan__hint">Najprv vyberte miestnosti v kroku 2.</span>';
    return;
  }

  // Auto-select first room if none active or active no longer selected
  if (!activeSeatingRoom || !state.rooms.includes(activeSeatingRoom)) {
    activeSeatingRoom = state.rooms[0];
  }

  selectedRooms.forEach((r) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'step3-tab' + (r.id === activeSeatingRoom ? ' is-active' : '');
    btn.innerHTML = `<span class="step3-tab__dot" style="color:${r.color}"></span>${r.name}`;
    btn.addEventListener('click', () => {
      activeSeatingRoom = r.id;
      renderSeating();
    });
    wrap.appendChild(btn);
  });
}

function renderSeatingTypes() {
  const list = document.getElementById('seatingTypesList');
  if (!list) return;
  list.innerHTML = '';

  const room = getRoom(activeSeatingRoom);
  if (!room) return;

  const currentSeat = state.seating[activeSeatingRoom] || null;

  SEATING_TYPES.forEach((s) => {
    const maxCap = Math.floor(room.capacity * s.capacityFactor);
    const selected = currentSeat === s.id;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'seat-type' + (selected ? ' is-selected' : '');
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.innerHTML = `
      <span class="seat-type__icon"><i data-lucide="${s.icon}"></i></span>
      <span class="seat-type__body">
        <span class="seat-type__name">${s.name}</span>
        <span class="seat-type__meta">max ${maxCap} osôb${s.priceExtra ? ' · +' + s.priceExtra + ' €' : ' · v cene'}</span>
      </span>
      <span class="seat-type__check"></span>
    `;
    btn.addEventListener('click', () => {
      if (state.seating[activeSeatingRoom] === s.id) {
        delete state.seating[activeSeatingRoom];
      } else {
        state.seating[activeSeatingRoom] = s.id;
      }
      recomputeTotal();
      saveState();
      renderSeatingTypes();
      renderSeatingFloorplan();
      renderSeatingSummary();
      renderBottomBar();
    });
    list.appendChild(btn);
  });

  // Re-init lucide icons for the new elements
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderSeatingFloorplan() {
  const canvas = document.getElementById('seatingCanvas');
  if (!canvas) return;

  const room = getRoom(activeSeatingRoom);
  const seatId = state.seating[activeSeatingRoom];
  const imageKey = `${activeSeatingRoom}-${seatId}`;

  // Check if we have a real image for this combo
  if (seatId && SEATING_IMAGES[imageKey]) {
    canvas.innerHTML = `<img src="${SEATING_IMAGES[imageKey]}" alt="${room?.name} — ${getSeatingType(seatId)?.name}" />`;
  } else {
    // Placeholder with seating type hint
    const seatType = seatId ? getSeatingType(seatId) : null;
    const label = seatType
      ? `${room?.name} — ${seatType.name}`
      : 'Vyberte typ sedenia';
    canvas.innerHTML = `
      <div class="seating-floorplan__placeholder">
        <i data-lucide="${seatType ? seatType.icon : 'layout-grid'}"></i>
        <span>${label}</span>
        <span class="seating-floorplan__hint">Pôdorys bude doplnený</span>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  // Info row beneath canvas
  const info = document.getElementById('seatingInfo');
  if (!info || !room) return;

  const seatType = seatId ? getSeatingType(seatId) : null;
  const maxCap = seatType ? Math.floor(room.capacity * seatType.capacityFactor) : room.capacity;

  info.innerHTML = `
    <div class="seating-floorplan__stat">
      <span class="seating-floorplan__stat-label">Miestnosť</span>
      <span class="seating-floorplan__stat-value">${room.name}</span>
    </div>
    <div class="seating-floorplan__stat">
      <span class="seating-floorplan__stat-label">Plocha</span>
      <span class="seating-floorplan__stat-value">${room.area} m²</span>
    </div>
    <div class="seating-floorplan__stat">
      <span class="seating-floorplan__stat-label">Kapacita</span>
      <span class="seating-floorplan__stat-value">${maxCap} osôb</span>
    </div>
    ${seatType ? `<div class="seating-floorplan__stat">
      <span class="seating-floorplan__stat-label">Sedenie</span>
      <span class="seating-floorplan__stat-value">${seatType.name}</span>
    </div>` : ''}
  `;
}

function renderSeatingSummary() {
  const wrap = document.getElementById('seatingSummary');
  if (!wrap) return;

  const configured = state.rooms.filter((id) => state.seating[id]);
  const total = state.rooms.length;
  const seatingExtra = Object.values(state.seating).reduce((acc, seatId) => {
    const s = getSeatingType(seatId);
    return acc + (s ? s.priceExtra : 0);
  }, 0);

  wrap.innerHTML = `
    <div class="seating-summary__row">
      <span class="seating-summary__label">Nastavené</span>
      <span class="seating-summary__value">${configured.length} / ${total}</span>
    </div>
    <div class="seating-summary__row">
      <span class="seating-summary__label">Príplatok</span>
      <span class="seating-summary__value">${seatingExtra > 0 ? '+' + seatingExtra.toLocaleString('sk-SK') + ' €' : 'v cene'}</span>
    </div>
  `;
}

/* ---- QUERY PARAM PRESELECT ---- */

function applyQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room');
  if (room && getRoom(room) && !state.rooms.includes(room)) {
    state.rooms.push(room);
    recomputeTotal();
    saveState();
  }
}

function shiftMonth(delta) {
  const d = new Date(state.viewDate);
  d.setMonth(d.getMonth() + delta);
  state.viewDate = d.toISOString();
  saveState();

  // Add directional slide class before render
  const grid = document.getElementById('monthGrid');
  if (grid) {
    grid.classList.remove('slide-left', 'slide-right');
    grid.classList.add(delta > 0 ? 'slide-left' : 'slide-right');
    // Remove after animation completes
    setTimeout(() => {
      grid.classList.remove('slide-left', 'slide-right');
    }, 500);
  }

  renderMonthGrid();
}

/* ---- INIT ---- */

document.addEventListener('DOMContentLoaded', () => {
  // Stepper clicks
  document.querySelectorAll('.step').forEach((el) => {
    el.addEventListener('click', () => {
      const n = parseInt(el.dataset.step, 10);
      if (n <= state.maxStepReached) goToStep(n);
    });
  });

  // Nav buttons
  document.getElementById('backBtn').addEventListener('click', goBack);
  document.getElementById('nextBtn').addEventListener('click', advance);

  // Month nav
  document.querySelectorAll('[data-month-nav]').forEach((btn) => {
    btn.addEventListener('click', () => shiftMonth(parseInt(btn.dataset.monthNav, 10)));
  });

  // Time inputs
  ['timeFrom', 'timeTo'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state[id];
    el.addEventListener('change', (e) => {
      state[id] = e.target.value;
      recomputeTotal();
      saveState();
      renderBottomBar();
      renderRailSummary();
      updateTimeWarning();
    });
  });

  function updateTimeWarning() {
    const warn = document.getElementById('timeWarning');
    if (!warn) return;
    const toH = parseInt(state.timeTo.split(':')[0], 10);
    const fromH = parseInt(state.timeFrom.split(':')[0], 10);
    const isLate = toH >= 22 || toH === 0 || (fromH >= 22);
    warn.classList.toggle('is-visible', isLate);
  }
  updateTimeWarning();

  // Guest count inputs (step 1 + step 2 share the same state)
  const guestInput = document.getElementById('guestCount');
  const step2GuestInput = document.getElementById('step2GuestCount');

  function syncGuestInputs(sourceEl) {
    const val = parseInt(sourceEl.value, 10);
    state.guestCount = isNaN(val) ? 0 : Math.max(0, val);
    saveState();
    const hasVal = state.guestCount > 0;
    // Sync the other input
    if (guestInput && guestInput !== sourceEl) {
      guestInput.value = hasVal ? state.guestCount : '';
    }
    if (step2GuestInput && step2GuestInput !== sourceEl) {
      step2GuestInput.value = hasVal ? state.guestCount : '';
    }
    // Toggle blue color on confirmed value
    if (guestInput) guestInput.classList.toggle('has-value', hasVal);
    if (step2GuestInput) step2GuestInput.classList.toggle('has-value', hasVal);
    recomputeTotal();
    renderBottomBar();
    renderRecommendation();
  }

  if (guestInput) {
    guestInput.value = '';
    guestInput.addEventListener('input', (e) => syncGuestInputs(e.target));
    renderRecommendation();
  }

  if (step2GuestInput) {
    step2GuestInput.value = '';
    step2GuestInput.addEventListener('input', (e) => syncGuestInputs(e.target));
  }

  // Floorplan SVG click → toggle room (keyboard-accessible)
  document.querySelectorAll('.fp-room').forEach((g) => {
    const id = g.dataset.room;
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-label', `Prepnúť miestnosť ${getRoom(id)?.name || id}`);
    g.addEventListener('click', () => toggleRoom(id));
    g.addEventListener('mouseenter', () => previewRoom(id, true));
    g.addEventListener('mouseleave', () => previewRoom(id, false));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleRoom(id);
      }
    });
  });

  // Close button
  const closeBtn = document.querySelector('.booking-topbar__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (confirm('Naozaj chcete odísť? Váš priebeh ostáva uložený.')) {
        window.location.href = 'index.html';
      }
    });
  }

  // Total detail expand (bottom bar)
  const detailBtn = document.querySelector('.booking-total__detail');
  if (detailBtn) {
    detailBtn.addEventListener('click', () => {
      alert('Detail cenovej kalkulácie — bude implementovaný v kroku 6 (Súhrn).');
    });
  }

  // Fresh start — reset step 1 selections so user always begins clean
  state.guestCount = 0;
  state.rooms = [];
  state.seating = {};
  state.date = null;
  state.step = 1;
  state.maxStepReached = 1;
  state.total = 0;
  saveState();

  applyQueryParams();
  recomputeTotal();
  renderStepper();
  renderPanels();
  renderBottomBar();
  renderMonthGrid();
  renderStep1Rail();
  renderRooms();
});
