import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  setDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADB_EMAIL_DOMAIN = "@adb-us.com";
const ADMIN_PASSWORD = "ADB";

const DEFAULT_TOOLS = {
  spareTools: ["Hammer Drill", "Angle Grinder", "Circular Saw", "SDS Drill", "Finish Nailer"],
  safetyEquipment: ["Harness", "Hard Hat", "Safety Glasses", "Gloves", "Traffic Cones"],
  testingEquipment: ["Cable Tester", "Multimeter", "Tone Generator", "Fiber Tester", "Signal Meter"]
};

const CATEGORY_LABELS = {
  spareTools: "Spare Tools",
  safetyEquipment: "Safety Equipment",
  testingEquipment: "Testing Equipment"
};

let checkouts = [];
let tools = [];
let isLoggedIn = false;
let pendingAction = null;
let activeToolCategory = "all";
let toolSearchQuery = "";

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

const phoneNumber = document.getElementById("phoneNumber");
const expectedReturnDate = document.getElementById("expectedReturnDate");

const selectedTool = document.getElementById("selectedTool");
const selectedToolLabel = document.getElementById("selectedToolLabel");
const selectedToolCategoryLabel = document.getElementById("selectedToolCategoryLabel");
const toolList = document.getElementById("toolList");
const toolSearchInput = document.getElementById("toolSearchInput");

const verifyModal = document.getElementById("verifyModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const confirmVerifyBtn = document.getElementById("confirmVerifyBtn");
const verifyEmailPrefix = document.getElementById("verifyEmailPrefix");
const verifyPhoneNumber = document.getElementById("verifyPhoneNumber");
const verifyError = document.getElementById("verifyError");
const extendDateWrap = document.getElementById("extendDateWrap");
const newReturnDate = document.getElementById("newReturnDate");

const addToolForm = document.getElementById("addToolForm");
const newToolName = document.getElementById("newToolName");
const newToolCategory = document.getElementById("newToolCategory");
const adminToolsList = document.getElementById("adminToolsList");

function setDefaultReturnDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  expectedReturnDate.value = tomorrow.toISOString().split("T")[0];
}

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function phoneDigits(value) {
  return value.replace(/\D/g, "").slice(0, 10);
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

function makeCheckoutDate() {
  const date = new Date();
  date.setHours(6, 0, 0, 0);
  return date.toISOString();
}

function makeReturnDate(dateValue) {
  const date = new Date(`${dateValue}T17:00:00`);
  return date.toISOString();
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

async function seedDefaultToolsIfNeeded() {
  const snapshot = await getDocs(collection(db, "tools"));
  if (!snapshot.empty) return;

  const writes = [];

  Object.entries(DEFAULT_TOOLS).forEach(([category, names]) => {
    names.forEach(name => {
      const toolId = `${category}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      writes.push(
        setDoc(doc(db, "tools", toolId), {
          name,
          category,
          createdAt: serverTimestamp()
        })
      );
    });
  });

  await Promise.all(writes);
}

function getVisibleTools() {
  return tools
    .filter(tool => {
      const matchesCategory = activeToolCategory === "all" || tool.category === activeToolCategory;
      const matchesSearch = tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (a.category !== b.category) {
        return CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]);
      }

      return a.name.localeCompare(b.name);
    });
}

function renderToolPicker() {
  document.querySelectorAll(".tool-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.category === activeToolCategory);
  });

  const visibleTools = getVisibleTools();

  toolList.innerHTML = "";

  if (visibleTools.length === 0) {
    toolList.innerHTML = `
      <div class="empty-tool-message">
        <strong>No tools found</strong>
        <span>Try another category or search term.</span>
      </div>
    `;
    return;
  }

  visibleTools.forEach(tool => {
    const isSelected = selectedTool.value === tool.name;

    toolList.innerHTML += `
      <button type="button" class="tool-option ${isSelected ? "selected" : ""}" data-tool="${escapeHTML(tool.name)}" data-category="${escapeHTML(tool.category)}">
        <span class="tool-option-copy">
          <strong>${escapeHTML(tool.name)}</strong>
          <small>${CATEGORY_LABELS[tool.category]}</small>
        </span>
        <span class="tool-option-check">${isSelected ? "✓" : ""}</span>
      </button>
    `;
  });

  document.querySelectorAll(".tool-option").forEach(button => {
    button.addEventListener("click", () => {
      selectedTool.value = button.dataset.tool;
      selectedToolLabel.innerText = button.dataset.tool;
      selectedToolCategoryLabel.innerText = CATEGORY_LABELS[button.dataset.category] || "Selected tool";
      document.getElementById("toolPicker").classList.remove("open");
      renderToolPicker();
    });
  });
}

function renderAdminToolsList() {
  if (!adminToolsList || !isLoggedIn) return;

  adminToolsList.innerHTML = "";

  if (tools.length === 0) {
    adminToolsList.innerHTML = `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>No tools added yet</strong>
        </div>
        <p class="muted">Add tools above to populate the checkout dropdown.</p>
      </div>
    `;
    return;
  }

  Object.keys(CATEGORY_LABELS).forEach(category => {
    const categoryTools = tools
      .filter(tool => tool.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));

    adminToolsList.innerHTML += `
      <div class="admin-tool-category">
        <h4>${CATEGORY_LABELS[category]}</h4>
        <div class="admin-tool-list">
          ${
            categoryTools.length === 0
              ? `<p class="muted">No tools in this section.</p>`
              : categoryTools.map(tool => `
                  <div class="admin-tool-item">
                    <span>${escapeHTML(tool.name)}</span>
                    <button class="mini-delete-btn" data-tool-id="${tool.id}">Delete</button>
                  </div>
                `).join("")
          }
        </div>
      </div>
    `;
  });

  document.querySelectorAll(".mini-delete-btn").forEach(button => {
    button.addEventListener("click", async () => {
      const confirmed = confirm("Delete this tool from the dropdown?");
      if (!confirmed) return;

      await deleteDoc(doc(db, "tools", button.dataset.toolId));
    });
  });
}

function getActiveCheckouts() {
  return checkouts.filter(checkout => checkout.status === "out");
}

function refreshEverything() {
  document.getElementById("checkedOutCount").innerText = getActiveCheckouts().length;
  renderActiveCards();
  renderRecordsTable();
  renderEmailQueue();
  renderAdminToolsList();
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
          <p><strong>Phone:</strong> ${escapeHTML(checkout.phoneFormatted)}</p>
          <p><strong>Expected return:</strong> ${formatDate(checkout.expectedReturnAt)}</p>

          <div class="tool-actions">
            <button class="return-btn" data-action="return" data-id="${checkout.id}">
              Mark Returned
            </button>

            <button class="extend-btn" data-action="extend" data-id="${checkout.id}">
              Extend Rental
            </button>
          </div>
        </div>
      </article>
    `;
  });

  document.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", () => {
      openVerifyModal(button.dataset.id, button.dataset.action);
    });
  });
}

function renderRecordsTable() {
  if (!recordsTable) return;

  const queryText = searchInput.value.toLowerCase().trim();
  const filter = statusFilter.value;

  const filtered = checkouts.filter(checkout => {
    const searchable = `
      ${checkout.name}
      ${checkout.email}
      ${checkout.phoneFormatted}
      ${checkout.tool}
      ${checkout.status}
    `.toLowerCase();

    return searchable.includes(queryText) && (filter === "all" || checkout.status === filter);
  });

  recordsTable.innerHTML = "";

  if (filtered.length === 0) {
    recordsTable.innerHTML = `<tr><td colspan="7">No checkout records found.</td></tr>`;
    return;
  }

  filtered.forEach(checkout => {
    recordsTable.innerHTML += `
      <tr>
        <td>${escapeHTML(checkout.tool)}</td>
        <td>${escapeHTML(checkout.name)}</td>
        <td>${escapeHTML(checkout.email)}</td>
        <td>${escapeHTML(checkout.phoneFormatted)}</td>
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

function openVerifyModal(id, action) {
  const checkout = checkouts.find(item => item.id === id);
  if (!checkout) return;

  pendingAction = { id, action };

  document.getElementById("modalEyebrow").innerText = action === "extend" ? "Extend Rental" : "Return Tool";
  document.getElementById("modalTitle").innerText = action === "extend" ? "Extend Tool Rental" : "Return Tool";

  verifyEmailPrefix.value = "";
  verifyPhoneNumber.value = "";
  verifyError.classList.add("hidden");

  extendDateWrap.classList.toggle("hidden", action !== "extend");

  if (action === "extend") {
    const currentReturn = new Date(checkout.expectedReturnAt);
    currentReturn.setDate(currentReturn.getDate() + 1);
    newReturnDate.value = currentReturn.toISOString().split("T")[0];
  }

  verifyModal.classList.remove("hidden");
}

function closeVerifyModal() {
  verifyModal.classList.add("hidden");
  pendingAction = null;
}

async function confirmVerifiedAction() {
  if (!pendingAction) return;

  const checkout = checkouts.find(item => item.id === pendingAction.id);
  if (!checkout) return;

  const typedEmail = getFullEmail(verifyEmailPrefix.value);
  const typedPhone = phoneDigits(verifyPhoneNumber.value);

  if (typedEmail !== checkout.email || typedPhone !== checkout.phoneDigits) {
    verifyError.classList.remove("hidden");
    return;
  }

  if (pendingAction.action === "return") {
    await updateDoc(doc(db, "checkouts", checkout.id), {
      status: "returned",
      returnedAt: new Date().toISOString()
    });
  }

  if (pendingAction.action === "extend") {
    if (!newReturnDate.value) return;

    await updateDoc(doc(db, "checkouts", checkout.id), {
      expectedReturnAt: makeReturnDate(newReturnDate.value),
      reminder24Sent: false,
      reminderReturnDaySent: false,
      lateNoticeSent: false,
      extendedAt: new Date().toISOString()
    });
  }

  closeVerifyModal();
}

function renderAdminState() {
  document.getElementById("loginPanel").classList.toggle("hidden", isLoggedIn);
  document.getElementById("adminPanel").classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    renderEmailQueue();
    renderAdminToolsList();
  }
}

function renderEmailQueue() {
  const emailQueue = document.getElementById("emailQueue");
  if (!emailQueue || !isLoggedIn) return;

  const active = getActiveCheckouts();
  emailQueue.innerHTML = "";

  if (active.length === 0) {
    emailQueue.innerHTML = `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>No active email reminders</strong>
        </div>
        <p class="muted">Reminder emails will appear once tools are checked out.</p>
      </div>
    `;
    return;
  }

  active.forEach(checkout => {
    emailQueue.innerHTML += `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>${escapeHTML(checkout.tool)}</strong>
          <span class="status-badge out">Active</span>
        </div>
        <p class="muted"><strong>To:</strong> ${escapeHTML(checkout.email)}</p>
        <p class="muted"><strong>24h reminder:</strong> ${checkout.reminder24Sent ? "Sent" : "Pending"}</p>
        <p class="muted"><strong>Return-day reminder:</strong> ${checkout.reminderReturnDaySent ? "Sent" : "Pending"}</p>
        <p class="muted"><strong>Late notice:</strong> ${checkout.lateNoticeSent ? "Sent" : "Pending"}</p>
      </div>
    `;
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

phoneNumber.addEventListener("input", () => {
  phoneNumber.value = formatPhone(phoneNumber.value);
});

verifyPhoneNumber.addEventListener("input", () => {
  verifyPhoneNumber.value = formatPhone(verifyPhoneNumber.value);
});

checkoutForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("workerName").value.trim();
  const emailPrefix = document.getElementById("emailPrefix").value.trim();
  const phoneFormatted = formatPhone(phoneNumber.value);
  const digits = phoneDigits(phoneNumber.value);
  const tool = selectedTool.value.trim();

  if (!name || !emailPrefix || digits.length !== 10 || !tool || !expectedReturnDate.value) {
    alert("Please complete every field. Phone number must be 10 digits and a tool must be selected.");
    return;
  }

  await addDoc(collection(db, "checkouts"), {
    name,
    email: getFullEmail(emailPrefix),
    phoneFormatted,
    phoneDigits: digits,
    tool,
    checkedOutAt: makeCheckoutDate(),
    expectedReturnAt: makeReturnDate(expectedReturnDate.value),
    status: "out",
    returnedAt: null,
    reminder24Sent: false,
    reminderReturnDaySent: false,
    lateNoticeSent: false,
    createdAt: serverTimestamp()
  });

  checkoutForm.reset();
  selectedTool.value = "";
  selectedToolLabel.innerText = "Select a tool";
  selectedToolCategoryLabel.innerText = "Search or choose from a category";
  toolSearchInput.value = "";
  toolSearchQuery = "";
  activeToolCategory = "all";
  renderToolPicker();
  setDefaultReturnDate();
});

addToolForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = newToolName.value.trim();
  const category = newToolCategory.value;

  if (!name || !category) return;

  await addDoc(collection(db, "tools"), {
    name,
    category,
    createdAt: serverTimestamp()
  });

  addToolForm.reset();
});

document.querySelectorAll(".tool-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activeToolCategory = tab.dataset.category;
    renderToolPicker();
  });
});

toolSearchInput.addEventListener("input", () => {
  toolSearchQuery = toolSearchInput.value.trim();
  renderToolPicker();
});

dashboardBtn.addEventListener("click", () => showView("dashboard"));
logoHomeBtn.addEventListener("click", () => showView("dashboard"));
recordsBtn.addEventListener("click", () => showView("records"));
adminBtn.addEventListener("click", () => showView("admin"));

searchInput.addEventListener("input", renderRecordsTable);
statusFilter.addEventListener("change", renderRecordsTable);

closeModalBtn.addEventListener("click", closeVerifyModal);
confirmVerifyBtn.addEventListener("click", confirmVerifiedAction);

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

document.getElementById("clearReturnedBtn").addEventListener("click", async () => {
  const confirmed = confirm("Clear all returned checkout records?");
  if (!confirmed) return;

  const returned = checkouts.filter(checkout => checkout.status === "returned");

  for (const checkout of returned) {
    await deleteDoc(doc(db, "checkouts", checkout.id));
  }
});

document.addEventListener("click", event => {
  const picker = document.getElementById("toolPicker");
  if (!picker) return;

  if (!picker.contains(event.target)) {
    picker.classList.remove("open");
  }
});

document.getElementById("toolPickerMain").addEventListener("click", () => {
  document.getElementById("toolPicker").classList.toggle("open");

  if (document.getElementById("toolPicker").classList.contains("open")) {
    setTimeout(() => toolSearchInput.focus(), 80);
  }
});

onSnapshot(query(collection(db, "checkouts"), orderBy("createdAt", "desc")), snapshot => {
  checkouts = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  refreshEverything();
});

onSnapshot(query(collection(db, "tools"), orderBy("createdAt", "asc")), snapshot => {
  tools = snapshot.docs.map(item => ({
    id: item.id,
    ...item.data()
  }));

  renderToolPicker();
  renderAdminToolsList();
});

seedDefaultToolsIfNeeded();
setDefaultReturnDate();
showView("dashboard");