// Set this to the IP address or domain of your Backend VM
const API_BASE_URL = "http://192.168.2.133"; 

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

/**
 * Centralized API call helper to handle cross-VM requests
 */
const apiCall = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    return fetch(url, options);
};

async function loginAsFixed(role) {
  const username = role === "admin" ? "admin" : "user";
  const password = role === "admin" ? "admin123" : "user123";

  try {
    const res = await apiCall('/api/login', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Login failed");
    localStorage.setItem("userRole", result.role);
    localStorage.setItem("userName", result.username);
    localStorage.setItem("token", result.token);
    updateAuthUI();
    alert(`Logged in as ${result.role}`);
  } catch (err) {
    alert(err.message);
  }
}

function logout() {
  localStorage.removeItem("userRole");
  localStorage.removeItem("userName");
  localStorage.removeItem("token");
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

  try {
    const res = await apiCall('/api/provinces');
    fillSelect(provinceSelect, await res.json(), "Select Province"); // This is wrong, fillSelect takes elementId
  } catch (e) { console.error(e); }
}

// Correcting the loadAddressSelects and other calls to use apiCall and correct parameters
async function initAddressSelects(prefix, selectedIds = {}) {
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

    try {
        const res = await apiCall('/api/provinces');
        const provinces = await res.json();
        populateSelectFromData(provinceSelect, provinces, "Select Province", selectedIds.province_id || "");

        provinceSelect.onchange = async (event) => {
            resetDependentSelects("province");
            if (!event.target.value) return;
            const resDist = await apiCall(`/api/districts?province_id=${event.target.value}`);
            populateSelectFromData(districtSelect, await resDist.json(), "Select District");
        };

        districtSelect.onchange = async (event) => {
            resetDependentSelects("district");
            if (!event.target.value) return;
            const resComm = await apiCall(`/api/communes?district_id=${event.target.value}`);
            populateSelectFromData(communeSelect, await resComm.json(), "Select Commune");
        };

        communeSelect.onchange = async (event) => {
            resetDependentSelects("commune");
            if (!event.target.value) return;
            const resVill = await apiCall(`/api/villages?commune_id=${event.target.value}`);
            populateSelectFromData(villageSelect, await resVill.json(), "Select Village");
        };

        if (selectedIds.province_id) {
            const resDist = await apiCall(`/api/districts?province_id=${selectedIds.province_id}`);
            populateSelectFromData(districtSelect, await resDist.json(), "Select District", selectedIds.district_id || "");
            if (selectedIds.district_id) {
                const resComm = await apiCall(`/api/communes?district_id=${selectedIds.district_id}`);
                populateSelectFromData(communeSelect, await resComm.json(), "Select Commune", selectedIds.commune_id || "");
                if (selectedIds.commune_id) {
                    const resVill = await apiCall(`/api/villages?commune_id=${selectedIds.commune_id}`);
                    populateSelectFromData(villageSelect, await resVill.json(), "Select Village", selectedIds.village_id || "");
                }
            }
        }
    } catch (e) { console.error("Error loading address selects:", e); }
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
    givenname: "Given Name", surname: "Surname", gender: "Gender", dob: "Date of Birth",
    province_id: "Province", district_id: "District", commune_id: "Commune", village_id: "Village",
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
        ${fields.map((field) => {
            const isChanged = changedFields.includes(field);
            return `<div style="${isChanged ? "color:#9a6700;font-weight:600;" : "color:#444;"}"><span style="min-width:110px;display:inline-block;">${fieldLabels[field]}:</span><span>${formatValue(field, newValues?.[field])}</span>${isChanged ? ' <span style="color:#d97706;font-size:12px;">(updated)</span>' : ""}</div>`;
          }).join("")}
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

window.addEventListener("DOMContentLoaded", async () => {
  updateAuthUI();
  document.getElementById("loginAdminBtn").onclick = () => loginAsFixed("admin");
  document.getElementById("loginUserBtn").onclick = () => loginAsFixed("user");
  document.getElementById("logoutBtn").onclick = logout;
  document.getElementById("addPersonBtn").onclick = () => openPersonModal("create");
  document.getElementById("closeModalBtn").onclick = closePersonModal;
  document.getElementById("savePersonBtn").onclick = savePerson;

  try {
    const res = await apiCall('/api/provinces');
    const provinces = await res.json();
    populateSelectFromData(document.getElementById("province"), provinces, "Select Province");
  } catch (e) { console.error(e); }
});

document.getElementById("province").onchange = async (e) => {
  resetSelects(["district", "commune", "village"]);
  if (e.target.value) {
    const res = await apiCall(`/api/districts?province_id=${e.target.value}`);
    populateSelectFromData(document.getElementById("district"), await res.json(), "Select District");
  }
};

document.getElementById("district").onchange = async (e) => {
  resetSelects(["commune", "village"]);
  if (e.target.value) {
    const res = await apiCall(`/api/communes?district_id=${e.target.value}`);
    populateSelectFromData(document.getElementById("commune"), await res.json(), "Select Commune");
  }
};

document.getElementById("commune").onchange = async (e) => {
  resetSelects(["village"]);
  if (e.target.value) {
    const res = await apiCall(`/api/villages?commune_id=${e.target.value}`);
    populateSelectFromData(document.getElementById("village"), await res.json(), "Select Village");
  }
};

function clearResults() {
  const tableBody = document.getElementById("tableBody");
  const reportTableBody = document.querySelector("#reportTable tbody");
  const paginationDiv = document.getElementById("pagination-controls");
  const statsDiv = document.getElementById("stats-container");
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Use filters to begin searching.</td></tr>';
  reportTableBody.innerHTML = '<tr><td style="text-align: center">Select filters and click Generate Report</td></tr>';
  paginationDiv.innerHTML = "";
  statsDiv.style.display = "none";
}

async function searchPeople(page = 1) {
  currentPage = page;
  clearResults();
  const statsDiv = document.getElementById("stats-container");
  const tableBody = document.getElementById("tableBody");
  const paginationDiv = document.getElementById("pagination-controls");

  const getVal = (id) => document.getElementById(id).value;
  const getText = (id) => {
    const el = document.getElementById(id);
    return el.options[el.selectedIndex]?.text;
  };

  const locationPath = [getText("province"), getText("district"), getText("commune"), getText("village")]
    .filter((t) => t && !t.startsWith("Select")).join(" > ");

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

  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Searching 2 million records...</td></tr>';

  try {
    const response = await apiCall(`/api/search?${params.toString()}`);
    const { data, pagination } = await response.json();

    if (!data || data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No results found.</td></tr>';
      statsDiv.style.display = "none";
      paginationDiv.innerHTML = "";
      return;
    }

    statsDiv.style.display = "block";
    statsDiv.innerHTML = `
            <div style="font-weight: bold; color: #1a73e8;">${locationPath || "National Registry"}</div>
            <div style="font-size: 13px;">Found ${pagination.totalRecords.toLocaleString()} records | Page ${pagination.currentPage} of ${pagination.totalPages.toLocaleString()}</div>
        `;

    tableBody.innerHTML = data.map((person, i) => {
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
      }).join("");

    paginationDiv.innerHTML = `
            <button onclick="searchPeople(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>Prev</button>
            <span style="font-weight:bold;">${currentPage} / ${pagination.totalPages.toLocaleString()}</span>
            <button onclick="searchPeople(${currentPage + 1})" ${currentPage >= pagination.totalPages ? "disabled" : ""}>Next</button>
        `;
  } catch (err) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Connection to server failed.</td></tr>';
  }
}

function resetFilters() { window.location.reload(); }

async function viewPersonDetail(id) {
  try {
    const res = await apiCall(`/api/people/${id}`);
    const person = await res.json();
    if (!res.ok) throw new Error(person.error || "Unable to fetch person details");
    const historyRes = await apiCall(`/api/people/${id}/history`);
    const history = await historyRes.json();
    openPersonModal("view", id, person, history);
  } catch (err) { alert(err.message); }
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
    await initAddressSelects("form_");
    historyBox.innerHTML = "";
  } else {
    if (!person) {
      const res = await apiCall(`/api/people/${id}`);
      person = await res.json();
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
      await initAddressSelects("form_", {
        province_id: person.province_id, district_id: person.district_id, commune_id: person.commune_id, village_id: person.village_id,
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
      return timeB - timeA || (b.id || 0) - (a.id || 0);
    });

    historyBox.innerHTML = orderedHistory.length
      ? orderedHistory.map((item, index) => renderHistoryEntry(item, index + 1)).join("")
      : "<em>No edit history yet.</em>";
  }
  modal.style.display = "flex";
}

function closePersonModal() { document.getElementById("personModal").style.display = "none"; }

async function savePerson() {
  const role = getRole();
  if (role !== "admin") { alert("Only admins can save changes"); return; }

  const token = localStorage.getItem("token");
  const payload = {
    givenname: document.getElementById("form_givenname").value,
    surname: document.getElementById("form_surname").value,
    gender: document.getElementById("form_gender").value,
    dob: document.getElementById("form_dob").value,
    province_id: document.getElementById("form_province").value,
    district_id: document.getElementById("form_district").value,
    commune_id: document.getElementById("form_commune").value,
    village_id: document.getElementById("form_village").value,
  };

  try {
    const method = currentMode === "create" ? "POST" : "PUT";
    const url = currentMode === "create" ? "/api/people" : `/api/people/${currentPersonId}`;
    
    const res = await apiCall(url, {
      method: method,
      headers: { 
        "Content-Type": "application/json",
        "Authorization": token 
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error((await res.json()).error || "Save failed");
    alert("Person saved successfully!");
    closePersonModal();
    searchPeople(currentPage);
  } catch (err) { alert(err.message); }
}

async function generateReport() {
  const params = new URLSearchParams({
    province_id: document.getElementById("province").value,
    district_id: document.getElementById("district").value,
    commune_id: document.getElementById("commune").value,
    age_from: document.getElementById("age_from").value,
    age_to: document.getElementById("age_to").value,
    gender: document.getElementById("gender").value,
  });

  try {
    const res = await apiCall(`/api/report?${params.toString()}`);
    const { headers, data } = await res.json();
    
    const reportTable = document.getElementById("reportTable");
    const thead = reportTable.querySelector("thead tr");
    const tbody = reportTable.querySelector("tbody");

    thead.innerHTML = headers.map(h => `<th>${h}</th>`).join("");
    tbody.innerHTML = data.map((row, i) => {
        return `<tr>${headers.map((h, idx) => {
            const key = h === "No" ? null : (h === "Province Name" ? "location_name" : 
                        (h === "District Name" ? "location_name" : 
                        (h === "Commune Name" ? "location_name" : 
                        (h === "Village Name" ? "location_name" : h))));
            const val = key ? row[key] : (i + 1);
            return `<td>${val}</td>`;
        }).join("")}</tr>`;
    }).join("");

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="'+headers.length+'" style="text-align:center;">No data found for this report.</td></tr>';
    }
  } catch (err) { alert("Report generation failed: " + err.message); }
}
