const API_URL = "http://127.0.0.1:5000";
const STORAGE_KEY = "routeflow_project_data_v3";

const LOCATIONS = ["Hafeezpet", "Miyapur", "Kondapur", "Gachibowli", "Madhapur"];

const DEFAULT_DELIVERIES = [
  { location: "Hafeezpet", weight: 20, time_start: "09:00", time_end: "11:00" },
  { location: "Miyapur", weight: 30, time_start: "10:00", time_end: "12:00" },
  { location: "Kondapur", weight: 25, time_start: "11:00", time_end: "13:00" },
  { location: "Gachibowli", weight: 35, time_start: "12:00", time_end: "14:00" }
];

const DEFAULT_VEHICLES = [
  { vehicle_id: "V-01", capacity: 100 },
  { vehicle_id: "V-02", capacity: 80 }
];

let currentDeliveries = [];
let currentVehicles = [];
let dashboardData = null;

const $ = id => document.getElementById(id);

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatTime(minutes) {
  const value = Math.max(0, Math.round(num(minutes)));
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatKg(value) {
  const n = num(value);
  return Number.isInteger(n) ? `${n} kg` : `${n.toFixed(1)} kg`;
}

function showToast(text, title = "Success") {
  $("toastTitle").textContent = title;
  $("toastText").textContent = text;
  $("toast").classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3000);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    deliveries: currentDeliveries,
    vehicles: currentVehicles
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.deliveries) && Array.isArray(saved.vehicles)) {
      currentDeliveries = saved.deliveries;
      currentVehicles = saved.vehicles;
      return;
    }
  } catch (_) {}
  currentDeliveries = structuredClone(DEFAULT_DELIVERIES);
  currentVehicles = structuredClone(DEFAULT_VEHICLES);
  saveState();
}

function today() {
  $("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  });
}

function openModal(id) { $(id).classList.add("show"); }
function closeModal(id) { $(id).classList.remove("show"); }

function setSection(name) {
  document.querySelectorAll(".page-section").forEach(section => section.classList.remove("active-section"));
  $(name).classList.add("active-section");
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.section === name));
  $("sectionLabel").textContent = name === "routes" ? "Optimized Routes" : name.charAt(0).toUpperCase() + name.slice(1);
}

function assignedVehicleFor(index) {
  if (!dashboardData?.vehicles) return "—";
  for (const vehicle of dashboardData.vehicles) {
    if (vehicle.deliveries?.some(d => d._index === index)) return vehicle.vehicle_id;
  }
  return dashboardData.unassigned?.some(d => d._index === index) ? "Unassigned" : "—";
}

function renderDeliveries() {
  const body = $("deliveryTable");
  body.innerHTML = "";
  $("deliveryEmpty").style.display = currentDeliveries.length ? "none" : "block";

  currentDeliveries.forEach((d, i) => {
    const assigned = assignedVehicleFor(i);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>D-${String(i + 1).padStart(3, "0")}</td>
      <td><b>${d.location}</b></td>
      <td>${formatKg(d.weight)}</td>
      <td>${d.time_start} – ${d.time_end}</td>
      <td>${assigned === "—" ? '<span class="muted">Pending</span>' : assigned === "Unassigned" ? '<span class="badge warning">Unassigned</span>' : `<span class="vehicle-tag">${assigned}</span>`}</td>
      <td><span class="badge success">Ready</span></td>
      <td><button class="table-action" data-delete-delivery="${i}">Delete</button></td>`;
    body.appendChild(tr);
  });
}

function renderVehicles() {
  const grid = $("vehicleGrid");
  grid.innerHTML = "";
  currentVehicles.forEach((v, i) => {
    const result = dashboardData?.vehicles?.find(x => x.vehicle_id === v.vehicle_id);
    const load = result ? num(result.current_load) : 0;
    const pct = v.capacity > 0 ? Math.min(100, (load / v.capacity) * 100) : 0;
    const card = document.createElement("div");
    card.className = "vehicle-card";
    card.innerHTML = `
      <div class="vehicle-top">
        <div><div class="vehicle-title">${v.vehicle_id}</div><div class="vehicle-sub">Delivery vehicle</div></div>
        <span class="badge success">Active</span>
      </div>
      <div class="capacity">
        <div class="capacity-head"><span>Capacity usage</span><b>${formatKg(load)} / ${formatKg(v.capacity)}</b></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
      </div>
      <div class="vehicle-details">
        <div><span>Assigned stops</span><b>${result?.deliveries?.length ?? 0}</b></div>
        <div><span>Route distance</span><b>${result ? `${num(result.distance)} km` : "—"}</b></div>
        <div><span>Fuel estimate</span><b>${result ? `${num(result.fuel_litres).toFixed(2)} L` : "—"}</b></div>
        <div><span>Finish time</span><b>${result?.completion_time || "—"}</b></div>
      </div>
      <div class="vehicle-actions"><button class="table-action" data-delete-vehicle="${i}">Remove</button></div>`;
    grid.appendChild(card);
  });
}

function groupedLocationLabels(deliveries) {
  const groups = new Map();
  (deliveries || []).forEach(d => {
    if (!groups.has(d.location)) groups.set(d.location, []);
    groups.get(d.location).push(d);
  });
  return groups;
}

function routeDisplayLocations(vehicle) {
  const groups = groupedLocationLabels(vehicle.deliveries);
  return (vehicle.route || []).slice(1, -1).map(location => ({
    location,
    count: (groups.get(location) || []).length
  }));
}

function renderRoutePath(vehicle) {
  const stops = routeDisplayLocations(vehicle);
  const points = [
    { label: "Warehouse", terminal: true },
    ...stops.map(s => ({ label: s.count > 1 ? `${s.location} ×${s.count}` : s.location })),
    { label: "End point", terminal: true }
  ];

  return points.map((p, i) => `
    <div class="route-point-wrap">
      <span class="route-node ${p.terminal ? "terminal" : ""}">${p.label}</span>
      ${i < points.length - 1 ? '<span class="route-connector"></span>' : ""}
    </div>`).join("");
}

function renderStopDetails(vehicle) {
  const groups = groupedLocationLabels(vehicle.deliveries);
  const order = (vehicle.route || []).slice(1, -1);
  const seen = new Set();
  const rows = [];

  order.forEach(location => {
    if (seen.has(location)) return;
    seen.add(location);
    (groups.get(location) || []).forEach(d => {
      rows.push(`
        <div class="stop-detail">
          <span class="stop-location">${location}</span>
          <div><b>${location} delivery</b><small>${formatKg(d.weight)} • ${d.time_start}–${d.time_end}</small></div>
        </div>`);
    });
  });

  return rows.join("") || `<div class="stop-empty">No assigned deliveries</div>`;
}

function updateDashboard() {
  if (!dashboardData) return;

  $("deliveryCount").textContent = dashboardData.total_deliveries;
  $("vehicleCount").textContent = dashboardData.active_vehicles;
  $("distanceValue").textContent = `${num(dashboardData.total_distance)} km`;
  $("timeValue").textContent = formatTime(dashboardData.estimated_time_minutes);
  $("fuelValue").textContent = `${num(dashboardData.estimated_fuel_litres).toFixed(2)} L`;
  $("deliverySub").textContent = `${dashboardData.assigned_count} assigned`;
  $("vehicleSub").textContent = `${num(dashboardData.total_capacity)} kg total capacity`;

  $("routeOverview").innerHTML = dashboardData.vehicles.map(v => `
    <div class="route-row">
      <div class="vehicle-name"><b>${v.vehicle_id}</b><small>${v.deliveries.length} deliveries • ${formatKg(v.current_load)} / ${formatKg(v.capacity)}</small></div>
      <div class="route-path">${renderRoutePath(v)}</div>
      <div class="route-metric"><b>${num(v.distance)} km</b><small>${formatTime(v.time_minutes)} • ${num(v.fuel_litres).toFixed(2)} L</small></div>
    </div>`).join("") || '<div class="empty" style="display:block">No vehicle routes yet.</div>';

  const satisfaction = num(dashboardData.constraint_satisfaction);
  $("constraintBadge").textContent = satisfaction === 100 ? "All checks passed" : `${satisfaction}% satisfied`;
  $("constraintBadge").className = satisfaction === 100 ? "status-good" : "status-warn";
  $("windowStatus").textContent = "Checked automatically";

  $("optimizedRoutes").innerHTML = dashboardData.vehicles.map(v => `
    <div class="route-card">
      <div class="route-card-head">
        <div><b>${v.vehicle_id}</b><small>${v.deliveries.length} deliveries • ${formatKg(v.current_load)} / ${formatKg(v.capacity)}</small></div>
        <span class="badge ${v.feasible ? "success" : "warning"}">${v.feasible ? "Ready" : "Check constraints"}</span>
      </div>
      <div class="route-visual">${renderRoutePath(v)}</div>
      <div class="route-stats">
        <div><span>Distance</span><b>${num(v.distance)} km</b></div>
        <div><span>Travel time</span><b>${formatTime(v.time_minutes)}</b></div>
        <div><span>Fuel used</span><b>${num(v.fuel_litres).toFixed(2)} L</b></div>
        <div><span>Finish</span><b>${v.completion_time || "—"}</b></div>
      </div>
      <div class="stop-details">
        <div class="stop-details-title">Assigned deliveries</div>
        ${renderStopDetails(v)}
      </div>
    </div>`).join("") || '<div class="empty" style="display:block">Run optimization to generate routes.</div>';

  $("performanceDistance").textContent = `${num(dashboardData.total_distance)} km`;
  $("performanceTime").textContent = formatTime(dashboardData.estimated_time_minutes);
  $("performanceFuel").textContent = `${num(dashboardData.estimated_fuel_litres).toFixed(2)} L`;
  $("performanceConstraint").textContent = satisfaction === 100 ? "All checks passed" : `${satisfaction}%`;
  $("baselineDistance").textContent = `${num(dashboardData.baseline_distance)} km`;
  $("summaryDistance").textContent = `${num(dashboardData.total_distance)} km`;
  $("savedDistance").textContent = `${num(dashboardData.distance_saved)} km`;
  $("improvement").textContent = `${num(dashboardData.improvement)}%`;
  $("algorithmName").textContent = dashboardData.algorithm || "Nearest Neighbor Heuristic";
  $("assignedCount").textContent = dashboardData.assigned_count;
  $("unassignedCount").textContent = dashboardData.unassigned_count;
  $("speedAssumption").textContent = `${dashboardData.average_speed_kmh} km/h`;
  $("fuelAssumption").textContent = `${dashboardData.fuel_efficiency_kmpl} km/L`;
  $("lastRun").textContent = new Date().toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit"});

  renderDeliveries();
  renderVehicles();
}

async function optimize() {
  const buttons = [$("optimizeBtn"), $("optimizeFromDeliveries"), $("optimizeFromRoutes")].filter(Boolean);
  buttons.forEach(b => { b.disabled = true; b.dataset.oldText = b.textContent; b.textContent = "⏳ Optimizing..."; });

  try {
    const response = await fetch(`${API_URL}/api/optimize`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({deliveries: currentDeliveries, vehicles: currentVehicles})
    });
    if (!response.ok) throw new Error("Backend optimization failed");
    dashboardData = await response.json();
    localStorage.setItem("routeflow_last_result", JSON.stringify(dashboardData));
    updateDashboard();
    showToast("Routes, time and fuel were calculated successfully.");
  } catch (error) {
    console.error(error);
    showToast("Start the Flask backend, then optimize again.", "Connection error");
  } finally {
    buttons.forEach(b => { b.disabled = false; b.textContent = b.dataset.oldText; });
  }
}

$("addDeliveryBtn").onclick = () => {
  $("deliveryLocationInput").value = LOCATIONS[currentDeliveries.length % LOCATIONS.length];
  $("deliveryWeightInput").value = "";
  $("windowStartInput").value = "09:00";
  $("windowEndInput").value = "11:00";
  openModal("deliveryModal");
};

$("saveDeliveryBtn").onclick = () => {
  const location = $("deliveryLocationInput").value;
  const weight = Number($("deliveryWeightInput").value);
  const start = $("windowStartInput").value;
  const end = $("windowEndInput").value;

  if (!location || !weight || weight <= 0 || !start || !end || start >= end) {
    showToast("Enter a valid location, package weight and delivery window.", "Input error");
    return;
  }

  currentDeliveries.push({location, weight, time_start: start, time_end: end});
  dashboardData = null;
  saveState();
  renderDeliveries();
  renderVehicles();
  closeModal("deliveryModal");
  showToast(`${location} delivery added. Optimize to calculate the route.`);
};

$("addVehicleBtn").onclick = () => {
  $("vehicleIdInput").value = `V-${String(currentVehicles.length + 1).padStart(2, "0")}`;
  $("vehicleCapacityInput").value = "";
  openModal("vehicleModal");
};

$("saveVehicleBtn").onclick = () => {
  const id = $("vehicleIdInput").value.trim().toUpperCase();
  const capacity = Number($("vehicleCapacityInput").value);
  if (!id || !capacity || capacity <= 0) {
    showToast("Enter a valid vehicle ID and capacity.", "Input error");
    return;
  }
  if (currentVehicles.some(v => v.vehicle_id === id)) {
    showToast("That vehicle ID already exists.", "Input error");
    return;
  }
  currentVehicles.push({vehicle_id: id, capacity});
  dashboardData = null;
  saveState();
  renderVehicles();
  closeModal("vehicleModal");
  showToast(`${id} added to the available fleet.`);
};

document.addEventListener("click", e => {
  const d = e.target.closest("[data-delete-delivery]");
  if (d) {
    currentDeliveries.splice(Number(d.dataset.deleteDelivery), 1);
    dashboardData = null;
    saveState();
    renderDeliveries();
    renderVehicles();
    showToast("Delivery removed. Optimize again for updated routes.");
    return;
  }

  const v = e.target.closest("[data-delete-vehicle]");
  if (v) {
    if (currentVehicles.length <= 1) {
      showToast("At least one vehicle is required.", "Cannot remove");
      return;
    }
    currentVehicles.splice(Number(v.dataset.deleteVehicle), 1);
    dashboardData = null;
    saveState();
    renderVehicles();
    showToast("Vehicle removed. Optimize again for updated assignments.");
    return;
  }

  const close = e.target.closest("[data-close]");
  if (close) closeModal(close.dataset.close);
});

document.querySelectorAll(".nav-item").forEach(n => n.addEventListener("click", () => setSection(n.dataset.section)));
$("optimizeBtn").onclick = optimize;
$("optimizeFromDeliveries").onclick = () => { setSection("dashboard"); optimize(); };
$("optimizeFromRoutes").onclick = optimize;
$("refreshBtn").onclick = async () => { await loadDashboard(); showToast("Current delivery and fleet data refreshed."); };

async function loadDashboard() {
  try {
    const response = await fetch(`${API_URL}/api/dashboard`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({deliveries: currentDeliveries, vehicles: currentVehicles})
    });
    if (!response.ok) throw new Error("Backend unavailable");
    dashboardData = await response.json();
    updateDashboard();
  } catch (e) {
    console.error(e);
    renderDeliveries();
    renderVehicles();
    showToast("Start the Flask backend first.", "Connection error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  today();
  renderDeliveries();
  renderVehicles();
  loadDashboard();
});
