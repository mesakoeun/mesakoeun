const API_BASE = window.API_BASE || 'http://localhost:3001/api';
let currentPage = 1;

function calculateAge(dobString) {
  const birthday = new Date(dobString);
  if (isNaN(birthday)) return '';
  const ageDifMs = Date.now() - birthday.getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

function fillSelect(elementId, data, placeholder) {
  const select = document.getElementById(elementId);
  select.innerHTML = `<option value="">${placeholder}</option>`;
  (data || []).forEach((item) => {
    const opt = document.createElement('option');
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

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch(`${API_BASE}/provinces`);
    if (res.ok) fillSelect('province', await res.json(), 'Select Province');
  } catch (err) {
    console.error('Failed to load provinces', err);
  }
});

document.getElementById('province').onchange = async (e) => {
  resetSelects(['district', 'commune', 'village']);
  if (e.target.value) {
    try {
      const res = await fetch(`${API_BASE}/districts/${e.target.value}`);
      if (res.ok) fillSelect('district', await res.json(), 'Select District');
    } catch (err) { console.error(err); }
  }
};

document.getElementById('district').onchange = async (e) => {
  resetSelects(['commune','village']);
  if (e.target.value) {
    try {
      const res = await fetch(`${API_BASE}/communes/${e.target.value}`);
      if (res.ok) fillSelect('commune', await res.json(), 'Select Commune');
    } catch (err) { console.error(err); }
  }
};

document.getElementById('commune').onchange = async (e) => {
  resetSelects(['village']);
  if (e.target.value) {
    try {
      const res = await fetch(`${API_BASE}/villages/${e.target.value}`);
      if (res.ok) fillSelect('village', await res.json(), 'Select Village');
    } catch (err) { console.error(err); }
  }
};

function clearResults() {
  document.getElementById('tableBody').innerHTML = '<tr><td colspan="5" style="text-align:center;">Use filters to begin searching.</td></tr>';
  document.querySelector('#reportTable tbody').innerHTML = '<tr><td style="text-align:center">Select filters and click Generate Report</td></tr>';
  document.getElementById('pagination-controls').innerHTML = '';
  document.getElementById('stats-container').style.display = 'none';
}

async function searchPeople(page = 1) {
  currentPage = page;
  clearResults();
  const statsDiv = document.getElementById('stats-container');
  const tableBody = document.getElementById('tableBody');
  const paginationDiv = document.getElementById('pagination-controls');

  const getVal = id => document.getElementById(id).value;
  const getText = id => {
    const el = document.getElementById(id);
    return el.options[el.selectedIndex]?.text;
  };

  const params = new URLSearchParams({
    page: currentPage,
    givenname: getVal('givenname'),
    surname: getVal('surname'),
    gender: getVal('gender'),
    age_from: getVal('age_from'),
    age_to: getVal('age_to'),
    province_id: getVal('province'),
    district_id: getVal('district'),
    commune_id: getVal('commune'),
    village_id: getVal('village')
  });

  tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Searching...</td></tr>';
  try {
    const response = await fetch(`${API_BASE}/search?${params.toString()}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const { data, pagination } = await response.json();
    if (!data || data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No results found.</td></tr>';
      statsDiv.style.display = 'none';
      paginationDiv.innerHTML = '';
      return;
    }

    statsDiv.style.display = 'block';
    statsDiv.innerHTML = `<div style="font-weight:bold;color:#1a73e8;">${[getText('province'), getText('district'), getText('commune'), getText('village')].filter(Boolean).join(' > ') || 'National Registry'}</div><div style="font-size:13px;">Found ${pagination.totalRecords.toLocaleString()} records | Page ${pagination.currentPage} of ${pagination.totalPages.toLocaleString()}</div>`;

    tableBody.innerHTML = data.map((person, i) => {
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
    }).join('');

    paginationDiv.innerHTML = `
      <button onclick="searchPeople(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>
      <span style="font-weight:bold;">${currentPage} / ${pagination.totalPages.toLocaleString()}</span>
      <button onclick="searchPeople(${currentPage + 1})" ${currentPage >= pagination.totalPages ? 'disabled' : ''}>Next</button>
    `;
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Connection to server failed.</td></tr>';
  }
}

function resetFilters() { window.location.reload(); }

async function generateReport() {
  clearResults();
  const tableHead = document.querySelector('#reportTable thead tr');
  const tableBody = document.querySelector('#reportTable tbody');
  const statsDiv = document.getElementById('stats-container');

  const params = new URLSearchParams({
    province_id: document.getElementById('province').value,
    district_id: document.getElementById('district').value,
    commune_id: document.getElementById('commune').value,
    age_from: document.getElementById('age_from').value,
    age_to: document.getElementById('age_to').value,
    gender: document.getElementById('gender').value
  });

  tableBody.innerHTML = '<tr><td colspan="100" style="text-align:center">Generating Report...</td></tr>';
  try {
    const response = await fetch(`${API_BASE}/report?${params.toString()}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const result = await response.json();
    if (!result.data || result.data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="100" style="text-align:center">No data found.</td></tr>';
      return;
    }

    tableHead.innerHTML = '';
    result.headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; tableHead.appendChild(th); });

    tableBody.innerHTML = '';
    result.data.forEach((row, idx) => {
      const tr = document.createElement('tr');
      const tdNo = document.createElement('td'); tdNo.textContent = idx + 1; tr.appendChild(tdNo);
      const tdName = document.createElement('td'); tdName.textContent = row.location_name; tr.appendChild(tdName);
      const pivotKeys = result.headers.slice(2);
      pivotKeys.forEach(key => { const td = document.createElement('td'); td.textContent = row[key] ?? 0; tr.appendChild(td); });
      tableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tableBody.innerHTML = '<tr><td colspan="100" style="text-align:center;color:red;">Error generating report.</td></tr>';
  }
}
