const API_BASE = "http://localhost:3000/api";
let currentPage = 1;
let currentPersonId = null;
let currentMode = "view";

function getRole() {
  return localStorage.getItem("userRole") || "guest";
}

function updateAuthUI() {
  const role = getRole();
  const authStatus = document.getElementById("authStatus");
  const addPersonBtn = document.getElementById("addPersonBtn");
  if (authStatus) authStatus.textContent = role === "guest" ? "Not logged in" : `Logged in as ${role}`;
  if (addPersonBtn) addPersonBtn.style.display = role === "admin" ? "inline-block" : "none";
}

async function loginAs(role) {
  const username = role === "admin" ? "admin" : "user";
  const password = role === "admin" ? "admin123" : "user123";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Login failed");
    localStorage.setItem("userRole", result.role);
    localStorage.setItem("userName", result.username);
    updateAuthUI();
    alert(`Logged in as ${result.role}`);
  } catch (err) {
    alert(err.message);
  }
}

function logout() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  updateAuthUI();
}

// --- Utility: Calculate Age ---
function toDateInputValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatDobLabel(value) {
  const text = toDateInputValue(value);
  if (!text) return "";
  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
}

function calculateAge(dobString) {
  if (!dobString) return "";

  const [year, month, day] = String(dobString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";

  const birthday = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age -= 1;
  }

  return age;
}

// --- Dropdown Management ---
function fillSelect(elementId, data, placeholder) {
  const select = document.getElementById(elementId);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  data.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name_khmer || item.name || "Unnamed";
    select.appendChild(opt);
  });
  select.disabled = false;
}

function populateSelectFromData(select, data, placeholder, selectedValue = "") {
  select.innerHTML = `<option value="">${placeholder}</option>`;
  data.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name_khmer || item.name || "Unnamed";
    if (String(item.id) === String(selectedValue)) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  select.disabled = false;
}

async function loadAddressSelects(prefix, selectedIds = {}) {
  const provinceSelect = document.getElementById(`${prefix}province`);
  const districtSelect = document.getElementById(`${prefix}district`);
  const communeSelect = document.getElementById(`${prefix}commune`);
  const villageSelect = document.getElementById(`${prefix}village`);

  const resetDependentSelects = (startLevel) => {
    const resetMap = {
      province: [districtSelect, communeSelect, villageSelect],
      district: [communeSelect, villageSelect],
      commune: [villageSelect],
    };

    (resetMap[startLevel] || []).forEach((select) => {
      const label = select.id.replace(`${prefix}`, "");
      select.innerHTML = `<option value="">Select ${label.charAt(0).toUpperCase() + label.slice(1)}</option>`;
      select.disabled = true;
    });
  };

  const provinces = await fetch(`${API_BASE}/provinces`).then((response) => response.json());
  populateSelectFromData(provinceSelect, provinces, "Select Province", selectedIds.province_id || "");

  provinceSelect.onchange = async (event) => {
    resetDependentSelects("province");
    if (!event.target.value) return;

    const districts = await fetch(`${API_BASE}/districts/${event.target.value}`).then((response) => response.json());
    populateSelectFromData(districtSelect, districts, "Select District");
  };

  districtSelect.onchange = async (event) => {
    resetDependentSelects("district");
    if (!event.target.value) return;

    const communes = await fetch(`${API_BASE}/communes/${event.target.value}`).then((response) => response.json());
    populateSelectFromData(communeSelect, communes, "Select Commune");
  };

  communeSelect.onchange = async (event) => {
    resetDependentSelects("commune");
    if (!event.target.value) return;

    const villages = await fetch(`${API_BASE}/villages/${event.target.value}`).then((response) => response.json());
    populateSelectFromData(villageSelect, villages, "Select Village");
  };

  if (!selectedIds.province_id) {
    resetDependentSelects("province");
    return;
  }

  const districts = await fetch(`${API_BASE}/districts/${selectedIds.province_id}`).then((response) => response.json());
  populateSelectFromData(districtSelect, districts, "Select District", selectedIds.district_id || "");

  if (!selectedIds.district_id) {
    resetDependentSelects("district");
    return;
  }

  const communes = await fetch(`${API_BASE}/communes/${selectedIds.district_id}`).then((response) => response.json());
  populateSelectFromData(communeSelect, communes, "Select Commune", selectedIds.commune_id || "");

  if (!selectedIds.commune_id) {
    resetDependentSelects("commune");
    return;
  }

  const villages = await fetch(`${API_BASE}/villages/${selectedIds.commune_id}`).then((response) => response.json());
  populateSelectFromData(villageSelect, villages, "Select Village", selectedIds.village_id || "");
}

function renderHistoryEntry(item, entryNumber) {
  const oldValues = item.old_values && typeof item.old_values === "string" ? JSON.parse(item.old_values) : item.old_values;
  const newValues = item.new_values && typeof item.new_values === "string" ? JSON.parse(item.new_values) : item.new_values;
  const fields = ["givenname", "surname", "gender", "dob", "province_id", "district_id", "commune_id", "village_id"];

  const changedFields = fields.filter((field) => {
    const referenceValue = oldValues?.[field];
    const currentValue = newValues?.[field];
    return String(referenceValue ?? "") !== String(currentValue ?? "");
  });

  const formatValue = (field, value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (field === "dob") return formatDobLabel(value);
    return String(value);
  };

  const fieldLabels = {
    givenname: "Given Name",
    surname: "Surname",
    gender: "Gender",
    dob: "Date of Birth",
    province_id: "Province",
    district_id: "District",
    commune_id: "Commune",
    village_id: "Village",
  };

  const headerBadge = changedFields.length
    ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#fff4d6;color:#9a6700;border:1px solid #ffd36b;">Changed fields: ' + changedFields.length + "</span>"
    : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;background:#e8f3ff;color:#0b6bcb;">No field change</span>';

  return `
    <div style="border:1px solid ${changedFields.length ? "#ffd36b" : "#e6e6e6"}; border-left:4px solid ${changedFields.length ? "#f0a500" : "#d9d9d9"}; border-radius:10px; padding:10px 12px; margin-bottom:10px; background:${changedFields.length ? "#fffaf0" : "#fff"};">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <strong>#${entryNumber} ${item.action}</strong>
          <span style="color:#666;">by ${item.changed_by}</span>
          <span style="color:#888; font-size:12px;">${new Date(item.changed_at).toLocaleString()}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${headerBadge}
          <button type="button" onclick="toggleHistoryDetails(this)" aria-expanded="false" style="width:30px;height:30px;border-radius:999px;border:1px solid #d0d7de;background:#fff;color:#0b6bcb;font-weight:700;line-height:1;cursor:pointer;">+</button>
        </div>
      </div>
      <div class="history-details" style="display:none; margin-top:8px; font-size:13px; line-height:1.6;">
        ${fields
          .map((field) => {
            const isChanged = changedFields.includes(field);
            return `<div style="${isChanged ? "color:#9a6700;font-weight:600;" : "color:#444;"}"><span style="min-width:110px;display:inline-block;">${fieldLabels[field]}:</span><span>${formatValue(field, newValues?.[field])}</span>${isChanged ? ' <span style="color:#d97706;font-size:12px;">(updated)</span>' : ""}</div>`;
          })
          .join("")}
        <div style="margin-top:8px;color:#666;"><small>Before: ${oldValues ? JSON.stringify(oldValues) : "—"}</small></div>
      </div>
    </div>
  `;
}

function toggleHistoryDetails(button) {
  const card = button.closest("div[style*='border-radius:10px']");
  const details = card?.querySelector(".history-details");
  if (!details) return;

  const isOpen = details.style.display !== "none";
  details.style.display = isOpen ? "none" : "block";
  button.textContent = isOpen ? "+" : "−";
  button.setAttribute("aria-expanded", String(!isOpen));
}

function resetSelects(ids) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    el.innerHTML = `<option value="">Select ${id.charAt(0).toUpperCase() + id.slice(1)}</option>`;
    el.disabled = true;
  });
}

// --- Cascading Listeners ---
window.addEventListener("DOMContentLoaded", async () => {
  updateAuthUI();
  document.getElementById("loginAdminBtn").onclick = () => loginAs("admin");
  document.getElementById("loginUserBtn").onclick = () => loginAs("user");
  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("addPersonBtn").onclick = () => openPersonModal("create");
  document.getElementById("closeModalBtn").onclick = closePersonModal;
  document.getElementById("savePersonBtn").onclick = savePerson;

  const res = await fetch(`${API_BASE}/provinces`);
  fillSelect("province", await res.json(), "Select Province");
});

document.getElementById("province").onchange = async (e) => {
  resetSelects(["district", "commune", "village"]);
  if (e.target.value) {
    const res = await fetch(`${API_BASE}/districts/${e.target.value}`);
    fillSelect("district", await res.json(), "Select District");
  }
};

document.getElementById("district").onchange = async (e) => {
  resetSelects(["commune", "village"]);
  if (e.target.value) {
    const res = await fetch(`${API_BASE}/communes/${e.target.value}`);
    fillSelect("commune", await res.json(), "Select Commune");
  }
};

document.getElementById("commune").onchange = async (e) => {
  resetSelects(["village"]);
  if (e.target.value) {
    const res = await fetch(`${API_BASE}/villages/${e.target.value}`);
    fillSelect("village", await res.json(), "Select Village");
  }
};

// --- Clear Results Function ---
function clearResults() {
  const tableBody = document.getElementById("tableBody");
  const reportTableBody = document.querySelector("#reportTable tbody");
  const paginationDiv = document.getElementById("pagination-controls");
  const statsDiv = document.getElementById("stats-container");

  tableBody.innerHTML =
    '<tr><td colspan="5" style="text-align:center;">Use filters to begin searching.</td></tr>';
  reportTableBody.innerHTML =
    '<tr><td style="text-align: center">Select filters and click Generate Report</td></tr>';
  paginationDiv.innerHTML = "";
  statsDiv.style.display = "none";
}

// --- Search Logic ---
async function searchPeople(page = 1) {
  currentPage = page;
  clearResults();
  const statsDiv = document.getElementById("stats-container");
  const tableBody = document.getElementById("tableBody");
  const paginationDiv = document.getElementById("pagination-controls");

  // Get Filter Values
  const getVal = (id) => document.getElementById(id).value;
  const getText = (id) => {
    const el = document.getElementById(id);
    return el.options[el.selectedIndex]?.text;
  };

  // Build Location Breadcrumb
  const locationPath = [
    getText("province"),
    getText("district"),
    getText("commune"),
    getText("village"),
  ]
    .filter((t) => t && !t.startsWith("Select"))
    .join(" > ");

  const params = new URLSearchParams({
    page: currentPage,
    givenname: getVal("givenname"),
    surname: getVal("surname"),
    gender: getVal("gender"),
    age_from: getVal("age_from"),
    age_to: getVal("age_to"),
    province_id: getVal("province"),
    district_id: getVal("district"),
    commune_id: getVal("commune"),
    village_id: getVal("village"),
  });

  tableBody.innerHTML =
    '<tr><td colspan="5" style="text-align:center;">Searching 2 million records...</td></tr>';

  try {
    const response = await fetch(`${API_BASE}/search?${params.toString()}`);
    const { data, pagination } = await response.json();

    if (!data || data.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;">No results found.</td></tr>';
      statsDiv.style.display = "none";
      paginationDiv.innerHTML = "";
      return;
    }

    // Stats Display
    statsDiv.style.display = "block";
    statsDiv.innerHTML = `
            <div style="font-weight: bold; color: #1a73e8;">${locationPath || "National Registry"}</div>
            <div style="font-size: 13px;">Found ${pagination.totalRecords.toLocaleString()} records | Page ${pagination.currentPage} of ${pagination.totalPages.toLocaleString()}</div>
        `;

    // Table Rows with Indexing
    tableBody.innerHTML = data
      .map((person, i) => {
        const indexNumber = (currentPage - 1) * 100 + (i + 1);
        const isAdmin = getRole() === "admin";
        return `
                <tr>
                    <td>${indexNumber}</td>
                    <td><strong>${person.surname} ${person.givenname}</strong></td>
                    <td>${person.gender}</td>
                    <td>${calculateAge(person.dob)}</td>
                    <td>${formatDobLabel(person.dob)}</td>
                    <td>
                      <button onclick="viewPersonDetail(${person.id})" type="button">View</button>
                      ${isAdmin ? `<button onclick="openPersonModal('edit', ${person.id})" type="button" style="background:#28a745; margin-left:6px;">Edit</button>` : ""}
                    </td>
                </tr>
            `;
      })
      .join("");

    // Pagination Buttons
    paginationDiv.innerHTML = `
            <button onclick="searchPeople(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
            <span style="font-weight:bold;">${currentPage} / ${pagination.totalPages.toLocaleString()}</span>
            <button onclick="searchPeople(${currentPage + 1})" ${currentPage >= pagination.totalPages ? "disabled" : ""}>Next</button>
        `;
  } catch (err) {
    tableBody.innerHTML =
      '<tr><td colspan="5" style="text-align:center; color:red;">Connection to server failed.</td></tr>';
  }
}

function resetFilters() {
  window.location.reload();
}

async function viewPersonDetail(id) {
  try {
    const res = await fetch(`${API_BASE}/people/${id}`);
    const person = await res.json();
    if (!res.ok) throw new Error(person.error || "Unable to fetch person details");
    const historyRes = await fetch(`${API_BASE}/people/${id}/history`);
    const history = await historyRes.json();
    openPersonModal("view", id, person, history);
  } catch (err) {
    alert(err.message);
  }
}

async function openPersonModal(mode, id = null, person = null, history = []) {
  currentMode = mode;
  currentPersonId = id;
  const modal = document.getElementById("personModal");
  const modalTitle = document.getElementById("modalTitle");
  const personForm = document.getElementById("personForm");
  const historyBox = document.getElementById("historyBox");
  const saveBtn = document.getElementById("savePersonBtn");

  if (mode === "create") {
    modalTitle.textContent = "Add Person";
    saveBtn.style.display = getRole() === "admin" ? "inline-block" : "none";
    personForm.innerHTML = `
      <label>Given Name<input id="form_givenname" /></label>
      <label>Surname<input id="form_surname" /></label>
      <label>Gender<select id="form_gender"><option value="">Select</option><option>Male</option><option>Female</option></select></label>
      <label>Date of Birth<input type="date" id="form_dob" /></label>
      <label>Province<select id="form_province"></select></label>
      <label>District<select id="form_district" disabled></select></label>
      <label>Commune<select id="form_commune" disabled></select></label>
      <label>Village<select id="form_village" disabled></select></label>
    `;
    await loadAddressSelects("form_");
    historyBox.innerHTML = "";
  } else {
    if (!person) {
      person = await fetch(`${API_BASE}/people/${id}`).then(r => r.json());
    }
    modalTitle.textContent = mode === "edit" ? "Edit Person" : "Person Details";
    saveBtn.style.display = mode === "edit" && getRole() === "admin" ? "inline-block" : "none";
    if (mode === "edit") {
      personForm.innerHTML = `
        <label>Given Name<input id="form_givenname" value="${person.givenname || ""}" ${mode === "view" ? "disabled" : ""}></label>
        <label>Surname<input id="form_surname" value="${person.surname || ""}" ${mode === "view" ? "disabled" : ""}></label>
        <label>Gender<select id="form_gender" ${mode === "view" ? "disabled" : ""}><option value="">Select</option><option ${person.gender === "Male" ? "selected" : ""}>Male</option><option ${person.gender === "Female" ? "selected" : ""}>Female</option></select></label>
        <label>Date of Birth<input type="date" id="form_dob" value="${toDateInputValue(person.dob)}" ${mode === "view" ? "disabled" : ""}></label>
        <label>Province<select id="form_province"></select></label>
        <label>District<select id="form_district" disabled></select></label>
        <label>Commune<select id="form_commune" disabled></select></label>
        <label>Village<select id="form_village" disabled></select></label>
      `;
      await loadAddressSelects("form_", {
        province_id: person.province_id,
        district_id: person.district_id,
        commune_id: person.commune_id,
        village_id: person.village_id,
      });
    } else {
      personForm.innerHTML = `
        <label>Given Name<input id="form_givenname" value="${person.givenname || ""}" disabled></label>
        <label>Surname<input id="form_surname" value="${person.surname || ""}" disabled></label>
        <label>Gender<select id="form_gender" disabled><option value="">Select</option><option ${person.gender === "Male" ? "selected" : ""}>Male</option><option ${person.gender === "Female" ? "selected" : ""}>Female</option></select></label>
        <label>Date of Birth<input type="date" id="form_dob" value="${toDateInputValue(person.dob)}" disabled></label>
        <label>Province<input id="form_province" value="${person.province_name || ""}" disabled></label>
        <label>District<input id="form_district" value="${person.district_name || ""}" disabled></label>
        <label>Commune<input id="form_commune" value="${person.commune_name || ""}" disabled></label>
        <label>Village<input id="form_village" value="${person.village_name || ""}" disabled></label>
      `;
    }

    const orderedHistory = [...history].sort((a, b) => {
      const timeA = new Date(a.changed_at).getTime();
      const timeB = new Date(b.changed_at).getTime();
      
      // Newest first (descending timestamp)
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      // Same timestamp → higher ID first (assuming IDs increase over time)
      return (b.id || 0) - (a.id || 0);
    });

    historyBox.innerHTML = orderedHistory.length
      ? orderedHistory.map((item, index) => renderHistoryEntry(item, index + 1)).join("")
      : "<em>No edit history yet.</em>";
  }
  modal.style.display = "flex";
}

function closePersonModal() {
  document.getElementById("personModal").style.display = "none";
}

async function savePerson() {
  const role = getRole();
  if (role !== "admin") {
    alert("Only admin can add or edit people.");
    return;
  }

  const payload = {
    role,
    username: localStorage.getItem("userName") || "admin",
    givenname: document.getElementById("form_givenname").value.trim(),
    surname: document.getElementById("form_surname").value.trim(),
    gender: document.getElementById("form_gender").value,
    dob: document.getElementById("form_dob").value,
    province_id: document.getElementById("form_province")?.value || null,
    district_id: document.getElementById("form_district")?.value || null,
    commune_id: document.getElementById("form_commune")?.value || null,
    village_id: document.getElementById("form_village")?.value || null,
  };

  try {
    const url = currentMode === "edit" ? `${API_BASE}/people/${currentPersonId}` : `${API_BASE}/people`;
    const res = await fetch(url, {
      method: currentMode === "edit" ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Save failed");
    alert(result.message || "Saved successfully.");
    closePersonModal();
    await searchPeople(1);
  } catch (err) {
    alert(err.message);
  }
}

async function generateReport() {
  clearResults();
  const tableHead = document.querySelector("#reportTable thead tr");
  const tableBody = document.querySelector("#reportTable tbody");
  const statsDiv = document.getElementById("stats-container");

  // 1. Get Params
  const params = new URLSearchParams({
    province_id: document.getElementById("province").value,
    district_id: document.getElementById("district").value,
    commune_id: document.getElementById("commune").value,
    age_from: document.getElementById("age_from").value,
    age_to: document.getElementById("age_to").value,
    gender: document.getElementById("gender").value,
  });

  tableBody.innerHTML =
    '<tr><td colspan="100" style="text-align:center;">Generating Report...</td></tr>';
  statsDiv.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE}/report?${params.toString()}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to generate report");
    }

    // result.headers = ["No", "District Name", "Age 15", "Age 16"...]
    // result.data = [{location_name: "Chamkar Mon", "Age 15": 10, "Age 16": 5...}]

    if (result.data.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="100" style="text-align:center;">No data found.</td></tr>';
      return;
    }

    // --- 2. Build Dynamic Header ---
    tableHead.innerHTML = "";
    result.headers.forEach((headerText) => {
      const th = document.createElement("th");
      th.textContent = headerText;
      tableHead.appendChild(th);
    });

    // --- 3. Build Dynamic Rows ---
    tableBody.innerHTML = "";
    result.data.forEach((row, index) => {
      const tr = document.createElement("tr");

      // First Column: No.
      let tdNo = document.createElement("td");
      tdNo.textContent = index + 1;
      tr.appendChild(tdNo);

      // Second Column: Location Name (District Name / Commune Name etc)
      let tdName = document.createElement("td");
      tdName.textContent = row.location_name;
      tr.appendChild(tdName);

      // Remaining Columns: The Pivot Data (Age 15, Age 16, or Total)
      // We loop through the headers (skipping 'No' and 'Name') to find matching keys
      const pivotKeys = result.headers.slice(2);

      pivotKeys.forEach((key) => {
        let td = document.createElement("td");
        td.textContent = row[key] || 0; // Access data using the header name key
        tr.appendChild(td);
      });

      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = `
      <tr>
        <td colspan="100" style="text-align:center; color:red;">${err.message || "Error generating report."}</td>
      </tr>`;
  }
}
