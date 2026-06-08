const ADB_EMAIL_DOMAIN = "@adb-us.com";
const ADMIN_PASSWORD = "ADB";
const DEFAULT_LOAN_DAYS = 7;

let checkouts = loadCheckouts();
let isLoggedIn = false;

const dashboardView = document.getElementById("dashboardView");
const recordsView = document.getElementById("recordsView");
const adminView = document.getElementById("adminView");

const dashboardBtn = document.getElementById("dashboardBtn");
const recordsBtn = document.getElementById("recordsBtn");
const adminBtn = document.getElementById("adminBtn");
const logoHomeBtn = document.getElementById("logoHomeBtn");

const checkoutForm = document.getElementById("checkoutForm");
const activeGrid = document.getElementById("activeGrid");
const recordsTable = document.getElementById("recordsTable");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

function loadCheckouts() {
  const saved = localStorage.getItem("adbToolCheckouts");

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveCheckouts() {
  localStorage.setItem("adbToolCheckouts", JSON.stringify(checkouts));
}

function showView(viewName) {
  dashboardView.classList.add("hidden");
  recordsView.classList.add("hidden");
  adminView.classList.add("hidden");

  dashboardBtn.classList.remove("active");
  recordsBtn.classList.remove("active");
  adminBtn.classList.remove("active");

  if (viewName === "dashboard") {
    dashboardView.classList.remove("hidden");
    dashboardBtn.classList.add("active");
  }

  if (viewName === "records") {
    recordsView.classList.remove("hidden");
    recordsBtn.classList.add("active");
    renderRecordsTable();
  }

  if (viewName === "admin") {
    adminView.classList.remove("hidden");
    adminBtn.classList.add("active");
    renderAdminState();
  }
}

function getTodayAtSixAM() {
  const date = new Date();
  date.setHours(6, 0, 0, 0);
  return date;
}

function getDefaultReturnDate() {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_LOAN_DAYS);
  date.setHours(17, 0, 0, 0);
  return date;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function cleanEmailPrefix(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(ADB_EMAIL_DOMAIN, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function getFullEmail(prefix) {
  return `${cleanEmailPrefix(prefix)}${ADB_EMAIL_DOMAIN}`;
}

function getActiveCheckouts() {
  return checkouts.filter(checkout => checkout.status === "out");
}

function refreshEverything() {
  document.getElementById("checkedOutCount").innerText = getActiveCheckouts().length;
  renderActiveCards();
  renderRecordsTable();
  renderEmailQueue();
}

function renderActiveCards() {
  const active = getActiveCheckouts();

  activeGrid.innerHTML = "";

  if (active.length === 0) {
    activeGrid.innerHTML = `
      <article class="component-card">
        <div class="placeholder-image">
          <div class="placeholder-box">
            <div class="placeholder-icon">✅</div>
            <div class="placeholder-label">No Active Checkouts</div>
          </div>
        </div>

        <div class="component-info">
          <h3>All tools are currently returned</h3>
          <p>When someone checks out a tool, it will appear here.</p>
        </div>
      </article>
    `;
    return;
  }

  active.forEach(checkout => {
    activeGrid.innerHTML += `
      <article class="component-card">
        <div class="placeholder-image">
          <div class="placeholder-box">
            <div class="placeholder-icon">🧰</div>
            <div class="placeholder-label">${escapeHTML(checkout.tool)}</div>
          </div>
        </div>

        <div class="component-info">
          <h3>${escapeHTML(checkout.tool)}</h3>
          <p><strong>Checked out by:</strong> ${escapeHTML(checkout.name)}</p>
          <p><strong>Email:</strong> ${escapeHTML(checkout.email)}</p>
          <p><strong>Job site:</strong> ${escapeHTML(checkout.jobSite)}</p>
          <p><strong>Expected return:</strong> ${formatDate(checkout.expectedReturnAt)}</p>

          <div class="status-row">
            <span class="status-badge out">Checked Out</span>
          </div>

          <button class="return-btn" data-id="${checkout.id}">
            Mark Returned
          </button>
        </div>
      </article>
    `;
  });

  document.querySelectorAll(".return-btn").forEach(button => {
    button.addEventListener("click", () => {
      markReturned(button.dataset.id);
    });
  });
}

function renderRecordsTable() {
  if (!recordsTable) {
    return;
  }

  const query = searchInput.value.toLowerCase().trim();
  const filter = statusFilter.value;

  const filtered = checkouts.filter(checkout => {
    const searchableText = `
      ${checkout.name}
      ${checkout.email}
      ${checkout.tool}
      ${checkout.jobSite}
      ${checkout.status}
    `.toLowerCase();

    const matchesSearch = searchableText.includes(query);
    const matchesStatus = filter === "all" || checkout.status === filter;

    return matchesSearch && matchesStatus;
  });

  recordsTable.innerHTML = "";

  if (filtered.length === 0) {
    recordsTable.innerHTML = `
      <tr>
        <td colspan="7">No checkout records found.</td>
      </tr>
    `;
    return;
  }

  filtered
    .sort((a, b) => new Date(b.checkedOutAt) - new Date(a.checkedOutAt))
    .forEach(checkout => {
      recordsTable.innerHTML += `
        <tr>
          <td>${escapeHTML(checkout.tool)}</td>
          <td>${escapeHTML(checkout.name)}</td>
          <td>${escapeHTML(checkout.email)}</td>
          <td>${escapeHTML(checkout.jobSite)}</td>
          <td>${formatDateTime(checkout.checkedOutAt)}</td>
          <td>${formatDateTime(checkout.expectedReturnAt)}</td>
          <td>
            <span class="status-badge ${checkout.status === "out" ? "out" : "good"}">
              ${checkout.status === "out" ? "Checked Out" : "Returned"}
            </span>
          </td>
        </tr>
      `;
    });
}

function markReturned(id) {
  const checkout = checkouts.find(item => item.id === id);

  if (!checkout) {
    return;
  }

  checkout.status = "returned";
  checkout.returnedAt = new Date().toISOString();

  saveCheckouts();
  refreshEverything();
}

function createReminderQueue(checkout) {
  const expectedReturn = new Date(checkout.expectedReturnAt);

  const twentyFourHourReminder = new Date(expectedReturn);
  twentyFourHourReminder.setDate(twentyFourHourReminder.getDate() - 1);
  twentyFourHourReminder.setHours(17, 0, 0, 0);

  const finalReminder = new Date(expectedReturn);
  finalReminder.setHours(6, 0, 0, 0);

  const escalation = new Date(expectedReturn);
  escalation.setDate(escalation.getDate() + 1);
  escalation.setHours(6, 0, 0, 0);

  return [
    {
      type: "24 Hour Reminder",
      sendAt: twentyFourHourReminder.toISOString(),
      to: checkout.email,
      cc: "",
      subject: `REMINDER: 24 hours to return ${checkout.tool}`,
      body: `REMINDER: 24 hours to return "${checkout.tool}" or check out for longer.`
    },
    {
      type: "Final Reminder",
      sendAt: finalReminder.toISOString(),
      to: checkout.email,
      cc: "",
      subject: `FINAL REMINDER: ${checkout.tool} is due today`,
      body: `FINAL REMINDER: "${checkout.tool}" is due back today by 5:00 PM.`
    },
    {
      type: "Escalation",
      sendAt: escalation.toISOString(),
      to: checkout.email,
      cc: `ajkwasek${ADB_EMAIL_DOMAIN}, nharbacek${ADB_EMAIL_DOMAIN}`,
      subject: `OVERDUE TOOL: ${checkout.tool}`,
      body: `"${checkout.tool}" was not returned by the expected deadline. Please return it immediately or update the checkout.`
    }
  ];
}

function getQueuedEmails() {
  return getActiveCheckouts().flatMap(checkout => {
    return createReminderQueue(checkout).map(email => ({
      ...email,
      checkoutId: checkout.id,
      tool: checkout.tool,
      worker: checkout.name
    }));
  });
}

function renderEmailQueue() {
  const emailQueue = document.getElementById("emailQueue");

  if (!emailQueue || !isLoggedIn) {
    return;
  }

  const queuedEmails = getQueuedEmails();

  emailQueue.innerHTML = "";

  if (queuedEmails.length === 0) {
    emailQueue.innerHTML = `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>No reminder emails queued</strong>
        </div>
        <p class="muted">Emails will queue here after tools are checked out.</p>
      </div>
    `;
    return;
  }

  queuedEmails.forEach(email => {
    emailQueue.innerHTML += `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>${escapeHTML(email.type)}</strong>
          <span class="status-badge out">${formatDateTime(email.sendAt)}</span>
        </div>
        <p class="muted"><strong>Tool:</strong> ${escapeHTML(email.tool)}</p>
        <p class="muted"><strong>Worker:</strong> ${escapeHTML(email.worker)}</p>
        <p class="muted"><strong>To:</strong> ${escapeHTML(email.to)}</p>
        ${email.cc ? `<p class="muted"><strong>CC:</strong> ${escapeHTML(email.cc)}</p>` : ""}
        <p class="muted"><strong>Subject:</strong> ${escapeHTML(email.subject)}</p>
      </div>
    `;
  });
}

function renderAdminState() {
  document.getElementById("loginPanel").classList.toggle("hidden", isLoggedIn);
  document.getElementById("adminPanel").classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    renderEmailQueue();
  }
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

checkoutForm.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("workerName").value.trim();
  const emailPrefix = document.getElementById("emailPrefix").value.trim();
  const tool = document.getElementById("toolName").value.trim();
  const jobSite = document.getElementById("jobSite").value.trim();

  if (!name || !emailPrefix || !tool || !jobSite) {
    return;
  }

  const checkout = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    name,
    email: getFullEmail(emailPrefix),
    tool,
    jobSite,
    checkedOutAt: getTodayAtSixAM().toISOString(),
    expectedReturnAt: getDefaultReturnDate().toISOString(),
    status: "out",
    returnedAt: null
  };

  checkouts.push(checkout);
  saveCheckouts();

  checkoutForm.reset();
  refreshEverything();
});

dashboardBtn.addEventListener("click", () => showView("dashboard"));
logoHomeBtn.addEventListener("click", () => showView("dashboard"));
recordsBtn.addEventListener("click", () => showView("records"));
adminBtn.addEventListener("click", () => showView("admin"));

searchInput.addEventListener("input", renderRecordsTable);
statusFilter.addEventListener("change", renderRecordsTable);

document.getElementById("loginBtn").addEventListener("click", () => {
  const password = document.getElementById("passwordInput").value;

  if (password === ADMIN_PASSWORD) {
    isLoggedIn = true;
    document.getElementById("passwordInput").value = "";
    document.getElementById("loginError").classList.add("hidden");
    renderAdminState();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
});

document.getElementById("passwordInput").addEventListener("keydown", event => {
  if (event.key === "Enter") {
    document.getElementById("loginBtn").click();
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  isLoggedIn = false;
  renderAdminState();
});

document.getElementById("clearReturnedBtn").addEventListener("click", () => {
  const confirmed = confirm("Clear all returned checkout records?");

  if (!confirmed) {
    return;
  }

  checkouts = checkouts.filter(checkout => checkout.status !== "returned");
  saveCheckouts();
  refreshEverything();
});

refreshEverything();
showView("dashboard");
