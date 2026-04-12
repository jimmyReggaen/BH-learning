/* ============================================
   BIOMETRICS HOUSE — Booking Flow Controller
   ============================================ */

const STATE_KEY = 'bh-booking-state';

const STEP_NAMES = {
  1: 'Dátum',
  2: 'Priestor',
  3: 'Sedenie',
  4: 'Technika',
  5: 'Staff',
  6: 'Súhrn',
};

const SK_MONTHS = [
  'JANUÁR', 'FEBRUÁR', 'MAREC', 'APRÍL', 'MÁJ', 'JÚN',
  'JÚL', 'AUGUST', 'SEPTEMBER', 'OKTÓBER', 'NOVEMBER', 'DECEMBER',
];

const SK_DAYS = ['PO', 'UT', 'ST', 'ŠT', 'PI', 'SO', 'NE'];

const TODAY = new Date(2026, 3, 11); // April 11, 2026 — the brief's "today"
TODAY.setHours(0, 0, 0, 0);

/* Mock bookings — replace with backend data later.
   Each entry: { date: 'YYYY-MM-DD', title, full: bool } */
const BOOKED_EVENTS = [
  { date: '2026-04-13', title: 'Konferencia SK-Tech', full: false },
  { date: '2026-04-15', title: 'Launch Pharma AG',   full: false },
  { date: '2026-04-17', title: 'Svadba Nováková',    full: true  },
  { date: '2026-04-18', title: 'Svadba Nováková',    full: true  },
  { date: '2026-04-21', title: 'Workshop UX',        full: false },
  { date: '2026-04-24', title: 'Gala VÚB',           full: true  },
  { date: '2026-04-28', title: 'Meetup AI SK',       full: false },
  { date: '2026-05-02', title: 'Konferencia DEMO',   full: false },
  { date: '2026-05-06', title: 'Private event',     full: true  },
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
  state.total = Math.round(hours * roomsSum);
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
}

/* ---- RENDER: PANELS ---- */

function renderPanels() {
  document.querySelectorAll('.step-panel').forEach((el) => {
    const n = parseInt(el.dataset.stepPanel, 10);
    el.classList.toggle('is-active', n === state.step);
  });
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
  } else {
    nextBtn.disabled = false;
  }

  // Total (placeholder — actual pricing comes from selected items)
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

function renderRailSummary() {
  const count = document.getElementById('railCount');
  const hours = document.getElementById('railHours');
  const sub = document.getElementById('railSubtotal');
  if (!count || !hours || !sub) return;
  const h = hoursBetween(state.timeFrom, state.timeTo);
  count.textContent = String(state.rooms.length);
  hours.textContent = `${h % 1 === 0 ? h : h.toFixed(1)}h`;
  sub.textContent = `${state.total.toLocaleString('sk-SK')} €`;
}

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
    });
  });

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

  applyQueryParams();
  recomputeTotal();
  renderStepper();
  renderPanels();
  renderBottomBar();
  renderMonthGrid();
  renderRooms();
});
