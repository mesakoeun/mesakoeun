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
    fillSelect("form_province", await fetch(`${API_BASE}/provinces`).then(r => r.json()), "Select Province");
    document.getElementById("form_province").onchange = async (e) => {
      const district = document.getElementById("form_district");
      district.innerHTML = '<option value="">Select District</option>';
      district.disabled = true;
      if (!e.target.value) return;
      const res = await fetch(`${API_BASE}/districts/${e.target.value}`);
      fillSelect("form_district", await res.json(), "Select District");
    };
    document.getElementById("form_district").onchange = async (e) => {
      const commune = document.getElementById("form_commune");
      commune.innerHTML = '<option value="">Select Commune</option>';
      commune.disabled = true;
      if (!e.target.value) return;
      const res = await fetch(`${API_BASE}/communes/${e.target.value}`);
      fillSelect("form_commune", await res.json(), "Select Commune");
    };
    document.getElementById("form_commune").onchange = async (e) => {
      const village = document.getElementById("form_village");
      village.innerHTML = '<option value="">Select Village</option>';
      village.disabled = true;
      if (!e.target.value) return;
      const res = await fetch(`${API_BASE}/villages/${e.target.value}`);
      fillSelect("form_village", await res.json(), "Select Village");
    };
    historyBox.innerHTML = "";
  } else {
    if (!person) {
      person = await fetch(`${API_BASE}/people/${id}`).then(r => r.json());
    }
    modalTitle.textContent = mode === "edit" ? "Edit Person" : "Person Details";
    saveBtn.style.display = mode === "edit" && getRole() === "admin" ? "inline-block" : "none";
    personForm.innerHTML = `
      <label>Given Name<input id="form_givenname" value="${person.givenname || ""}" ${mode === "view" ? "disabled" : ""}></label>
      <label>Surname<input id="form_surname" value="${person.surname || ""}" ${mode === "view" ? "disabled" : ""}></label>
      <label>Gender<select id="form_gender" ${mode === "view" ? "disabled" : ""}><option value="">Select</option><option ${person.gender === "Male" ? "selected" : ""}>Male</option><option ${person.gender === "Female" ? "selected" : ""}>Female</option></select></label>
      <label>Date of Birth<input type="date" id="form_dob" value="${toDateInputValue(person.dob)}" ${mode === "view" ? "disabled" : ""}></label>
      <label>Province<input id="form_province" value="${person.province_name || ""}" disabled></label>
      <input type="hidden" id="form_province_id" value="${person.province_id || ""}">
      <label>District<input id="form_district" value="${person.district_name || ""}" disabled></label>
      <input type="hidden" id="form_district_id" value="${person.district_id || ""}">
      <label>Commune<input id="form_commune" value="${person.commune_name || ""}" disabled></label>
      <input type="hidden" id="form_commune_id" value="${person.commune_id || ""}">
      <label>Village<input id="form_village" value="${person.village_name || ""}" disabled></label>
      <input type="hidden" id="form_village_id" value="${person.village_id || ""}">
    `;
    historyBox.innerHTML = history.length
      ? history.map((item) => `<div style="border-top:1px solid #eee; padding-top:8px;"><strong>${item.action}</strong> by ${item.changed_by} at ${new Date(item.changed_at).toLocaleString()}<br/><small>Before: ${item.old_values ? JSON.stringify(item.old_values) : '—'}</small><br/><small>After: ${item.new_values ? JSON.stringify(item.new_values) : '—'}</small></div>`).join("")
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
    province_id: document.getElementById("form_province_id")?.value || document.getElementById("form_province")?.value || null,
    district_id: document.getElementById("form_district_id")?.value || document.getElementById("form_district")?.value || null,
    commune_id: document.getElementById("form_commune_id")?.value || document.getElementById("form_commune")?.value || null,
    village_id: document.getElementById("form_village_id")?.value || document.getElementById("form_village")?.value || null,
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
