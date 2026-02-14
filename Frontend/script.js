const API_BASE = "http://localhost:3000/api";
let currentPage = 1;

// --- Utility: Calculate Age ---
function calculateAge(dobString) {
  const birthday = new Date(dobString);
  const ageDifMs = Date.now() - birthday.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// --- Dropdown Management ---
function fillSelect(elementId, data, placeholder) {
  const select = document.getElementById(elementId);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  data.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
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

// --- Search Logic ---
async function searchPeople(page = 1) {
  currentPage = page;
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
        return `
                <tr>
                    <td>${indexNumber}</td>
                    <td><strong>${person.surname} ${person.givenname}</strong></td>
                    <td>${person.gender}</td>
                    <td>${calculateAge(person.dob)}</td>
                    <td>${new Date(person.dob).toLocaleDateString()}</td>
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
