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
let checkoutMode = "now";

const dashboardView = document.getElementById("dashboardView");
const recordsView = document.getElementById("recordsView");
const requestView = document.getElementById("requestView");
const adminView = document.getElementById("adminView");

const dashboardBtn = document.getElementById("dashboardBtn");
const recordsBtn = document.getElementById("recordsBtn");
const requestBtn = document.getElementById("requestBtn");
const adminBtn = document.getElementById("adminBtn");
const logoHomeBtn = document.getElementById("logoHomeBtn");

const checkoutForm = document.getElementById("checkoutForm");
const activeGrid = document.getElementById("activeGrid");
const scheduledGrid = document.getElementById("scheduledGrid");
const recordsTable = document.getElementById("recordsTable");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const recordStartDate = document.getElementById("recordStartDate");
const recordEndDate = document.getElementById("recordEndDate");

const phoneNumber = document.getElementById("phoneNumber");
const expectedReturnDate = document.getElementById("expectedReturnDate");
const scheduledStartDate = document.getElementById("scheduledStartDate");
const scheduledStartWrap = document.getElementById("scheduledStartWrap");

const checkoutNowTab = document.getElementById("checkoutNowTab");
const checkoutLaterTab = document.getElementById("checkoutLaterTab");
const checkoutSubmitBtn = document.getElementById("checkoutSubmitBtn");

const damageAtCheckout = document.getElementById("damageAtCheckout");
const checkoutDamageWrap = document.getElementById("checkoutDamageWrap");
const checkoutDamageComment = document.getElementById("checkoutDamageComment");

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

const returnDamageRow = document.getElementById("returnDamageRow");
const damageAtReturn = document.getElementById("damageAtReturn");
const returnDamageWrap = document.getElementById("returnDamageWrap");
const returnDamageComment = document.getElementById("returnDamageComment");

const requestForm = document.getElementById("requestForm");
const requestName = document.getElementById("requestName");
const requestEmailPrefix = document.getElementById("requestEmailPrefix");
const requestPhoneNumber = document.getElementById("requestPhoneNumber");
const requestType = document.getElementById("requestType");
const requestComment = document.getElementById("requestComment");

const addToolForm = document.getElementById("addToolForm");
const newToolName = document.getElementById("newToolName");
const newToolCategory = document.getElementById("newToolCategory");
const adminToolsList = document.getElementById("adminToolsList");

function setDefaultReturnDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  expectedReturnDate.value = tomorrow.toISOString().split("T")[0];

  if (scheduledStartDate) {
    const later = new Date();
    later.setDate(later.getDate() + 1);
    scheduledStartDate.value = later.toISOString().split("T")[0];
  }
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

function makeScheduledStartDate(dateValue) {
  const date = new Date(`${dateValue}T06:00:00`);
  return date.toISOString();
}

function makeReturnDate(dateValue) {
  const date = new Date(`${dateValue}T17:00:00`);
  return date.toISOString();
}

function dateInputFromISO(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toISOString().split("T")[0];
}

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function getCheckoutStartForDisplay(checkout) {
  return checkout.checkoutStartAt || checkout.checkedOutAt;
}

function getToolCategory(toolName) {
  const found = tools.find(tool => tool.name === toolName);
  return found?.category || "";
}

function getToolIcon(toolName) {
  const category = getToolCategory(toolName);

  if (category === "safetyEquipment") return "🦺";
  if (category === "testingEquipment") return "🔌";
  return "🧰";
}

function showView(viewName) {
  dashboardView.classList.add("hidden");
  recordsView.classList.add("hidden");
  requestView.classList.add("hidden");
  adminView.classList.add("hidden");

  dashboardBtn.classList.remove("active");
  recordsBtn.classList.remove("active");
  requestBtn.classList.remove("active");
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

  if (viewName === "request") {
    requestView.classList.remove("hidden");
    requestBtn.classList.add("active");
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

function getActiveCheckouts() {
  return checkouts.filter(checkout => checkout.status === "out");
}

function getScheduledCheckouts() {
  return checkouts.filter(checkout => checkout.status === "scheduled");
}

function isToolCurrentlyOut(toolName) {
  return getActiveCheckouts().some(checkout => checkout.tool === toolName);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function getConflictingScheduledCheckout(toolName, startISO, endISO, ignoredCheckoutId = null) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  return getScheduledCheckouts()
    .filter(checkout => checkout.tool === toolName && checkout.id !== ignoredCheckoutId)
    .map(checkout => ({
      checkout,
      start: new Date(checkout.checkoutStartAt || checkout.checkedOutAt),
      end: new Date(checkout.expectedReturnAt)
    }))
    .filter(item => rangesOverlap(start, end, item.start, item.end))
    .sort((a, b) => a.start - b.start)[0]?.checkout || null;
}

function getLatestReturnBeforeConflict(toolName, startISO, requestedEndISO, ignoredCheckoutId = null) {
  const conflict = getConflictingScheduledCheckout(toolName, startISO, requestedEndISO, ignoredCheckoutId);

  if (!conflict) {
    return {
      hasConflict: false,
      adjustedReturnAt: requestedEndISO,
      conflict: null
    };
  }

  const conflictStart = new Date(conflict.checkoutStartAt || conflict.checkedOutAt);
  const adjusted = new Date(conflictStart);
  adjusted.setDate(adjusted.getDate() - 1);
  adjusted.setHours(17, 0, 0, 0);

  const checkoutStart = new Date(startISO);

  if (adjusted < checkoutStart) {
    const sameDay = new Date(checkoutStart);
    sameDay.setHours(17, 0, 0, 0);

    return {
      hasConflict: true,
      adjustedReturnAt: sameDay.toISOString(),
      conflict
    };
  }

  return {
    hasConflict: true,
    adjustedReturnAt: adjusted.toISOString(),
    conflict
  };
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
    const isOut = isToolCurrentlyOut(tool.name);

    toolList.innerHTML += `
      <button type="button" class="tool-option ${isSelected ? "selected" : ""} ${isOut ? "unavailable" : ""}" data-tool="${escapeHTML(tool.name)}" data-category="${escapeHTML(tool.category)}" data-out="${isOut}">
        <span class="tool-option-copy">
          <strong>${escapeHTML(tool.name)}</strong>
          <small>${CATEGORY_LABELS[tool.category]}${isOut ? " • Currently checked out" : ""}</small>
        </span>
        <span class="tool-option-check">${isSelected ? "✓" : ""}</span>
      </button>
    `;
  });

  document.querySelectorAll(".tool-option").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.out === "true") {
        alert("This tool is currently checked out. You can still see it here, but it is not available until it is returned.");
        return;
      }

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

function refreshEverything() {
  document.getElementById("checkedOutCount").innerText = getActiveCheckouts().length;
  renderActiveCards();
  renderScheduledCards();
  renderRecordsTable();
  renderEmailQueue();
  renderAdminToolsList();
  renderToolPicker();
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
            <div class="placeholder-icon">${getToolIcon(checkout.tool)}</div>
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

function renderScheduledCards() {
  if (!scheduledGrid) return;

  const scheduled = getScheduledCheckouts();
  scheduledGrid.innerHTML = "";

  if (scheduled.length === 0) {
    scheduledGrid.innerHTML = `
      <article class="component-card">
        <div class="placeholder-image">
          <div class="placeholder-box">
            <div class="placeholder-icon">📅</div>
            <div class="placeholder-label">No Scheduled Checkouts</div>
          </div>
        </div>

        <div class="component-info">
          <h3>No dibs yet</h3>
          <p>Future reservations will appear here without marking the tool unavailable until the start date.</p>
        </div>
      </article>
    `;
    return;
  }

  scheduled.forEach(checkout => {
    scheduledGrid.innerHTML += `
      <article class="component-card scheduled-card">
        <div class="placeholder-image">
          <div class="placeholder-box">
            <div class="placeholder-icon">📅</div>
            <div class="placeholder-label">${escapeHTML(checkout.tool)}</div>
          </div>
        </div>

        <div class="component-info">
          <h3>${escapeHTML(checkout.tool)}</h3>
          <p><strong>Reserved by:</strong> ${escapeHTML(checkout.name)}</p>
          <p><strong>Email:</strong> ${escapeHTML(checkout.email)}</p>
          <p><strong>Phone:</strong> ${escapeHTML(checkout.phoneFormatted)}</p>
          <p><strong>Start:</strong> ${formatDate(getCheckoutStartForDisplay(checkout))}</p>
          <p><strong>Expected return:</strong> ${formatDate(checkout.expectedReturnAt)}</p>

          <div class="tool-actions single-action">
            <button class="return-btn" data-action="cancel" data-id="${checkout.id}">
              Cancel Scheduled Checkout
            </button>
          </div>
        </div>
      </article>
    `;
  });

  document.querySelectorAll('[data-action="cancel"]').forEach(button => {
    button.addEventListener("click", () => {
      openVerifyModal(button.dataset.id, "cancel");
    });
  });
}

function getFilteredRecords() {
  const queryText = searchInput.value.toLowerCase().trim();
  const filter = statusFilter.value;
  const startValue = recordStartDate?.value;
  const endValue = recordEndDate?.value;

  const startDate = startValue ? new Date(`${startValue}T00:00:00`) : null;
  const endDate = endValue ? new Date(`${endValue}T23:59:59`) : null;

  return checkouts.filter(checkout => {
    const searchable = `
      ${checkout.name}
      ${checkout.email}
      ${checkout.phoneFormatted}
      ${checkout.tool}
      ${checkout.status}
    `.toLowerCase();

    const recordDate = new Date(getCheckoutStartForDisplay(checkout) || checkout.createdAt?.toDate?.() || checkout.returnedAt || Date.now());

    const matchesText = searchable.includes(queryText);
    const matchesStatus = filter === "all" || checkout.status === filter;
    const matchesStart = !startDate || recordDate >= startDate;
    const matchesEnd = !endDate || recordDate <= endDate;

    return matchesText && matchesStatus && matchesStart && matchesEnd;
  });
}

function statusLabel(status) {
  if (status === "out") return "Checked Out";
  if (status === "scheduled") return "Scheduled";
  if (status === "cancelled") return "Cancelled";
  return "Returned";
}

function statusClass(status) {
  if (status === "out") return "out";
  if (status === "scheduled") return "scheduled";
  if (status === "cancelled") return "cancelled";
  return "good";
}

function renderRecordsTable() {
  if (!recordsTable) return;

  const filtered = getFilteredRecords();

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
        <td>${formatDateTime(getCheckoutStartForDisplay(checkout))}</td>
        <td>${formatDateTime(checkout.expectedReturnAt)}</td>
        <td>
          <span class="status-badge ${statusClass(checkout.status)}">
            ${statusLabel(checkout.status)}
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

  const isExtend = action === "extend";
  const isReturn = action === "return";
  const isCancel = action === "cancel";

  document.getElementById("modalEyebrow").innerText = isExtend ? "Extend Rental" : isCancel ? "Cancel Reservation" : "Return Tool";
  document.getElementById("modalTitle").innerText = isExtend ? "Extend Tool Rental" : isCancel ? "Cancel Scheduled Checkout" : "Return Tool";

  verifyEmailPrefix.value = "";
  verifyPhoneNumber.value = "";
  verifyError.classList.add("hidden");

  extendDateWrap.classList.toggle("hidden", !isExtend);
  returnDamageRow.classList.toggle("hidden", !isReturn);
  returnDamageWrap.classList.add("hidden");
  damageAtReturn.checked = false;
  returnDamageComment.value = "";

  if (isExtend) {
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
    if (damageAtReturn.checked && !returnDamageComment.value.trim()) {
      alert("Please describe the damage or missing items before submitting.");
      return;
    }

    await updateDoc(doc(db, "checkouts", checkout.id), {
      status: "returned",
      returnedAt: new Date().toISOString(),
      damageAtReturn: damageAtReturn.checked,
      returnDamageComment: returnDamageComment.value.trim()
    });

    if (damageAtReturn.checked) {
      await addDoc(collection(db, "damageReports"), {
        checkoutId: checkout.id,
        tool: checkout.tool,
        reportType: "Return",
        name: checkout.name,
        email: checkout.email,
        phoneFormatted: checkout.phoneFormatted,
        phoneDigits: checkout.phoneDigits,
        comment: returnDamageComment.value.trim(),
        createdAt: serverTimestamp()
      });
    }
  }

  if (pendingAction.action === "extend") {
    if (!newReturnDate.value) return;

    const startISO = checkout.checkoutStartAt || checkout.checkedOutAt;
    const requestedReturnAt = makeReturnDate(newReturnDate.value);
    const conflictResult = getLatestReturnBeforeConflict(checkout.tool, startISO, requestedReturnAt, checkout.id);

    if (conflictResult.hasConflict) {
      newReturnDate.value = dateInputFromISO(conflictResult.adjustedReturnAt);

      alert(
        `This rental cannot be extended that long because ${checkout.tool} already has dibs starting ${formatDate(conflictResult.conflict.checkoutStartAt || conflictResult.conflict.checkedOutAt)}. The return date has been adjusted to the latest available date: ${formatDate(conflictResult.adjustedReturnAt)}.`
      );
    }

    await updateDoc(doc(db, "checkouts", checkout.id), {
      expectedReturnAt: conflictResult.adjustedReturnAt,
      reminder24Sent: false,
      reminderReturnDaySent: false,
      lateNoticeSent: false,
      extendedAt: new Date().toISOString()
    });
  }

  if (pendingAction.action === "cancel") {
    await updateDoc(doc(db, "checkouts", checkout.id), {
      status: "cancelled",
      cancelledAt: new Date().toISOString()
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
  const scheduled = getScheduledCheckouts();
  const queueItems = [...active, ...scheduled];

  emailQueue.innerHTML = "";

  if (queueItems.length === 0) {
    emailQueue.innerHTML = `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>No active email reminders</strong>
        </div>
        <p class="muted">Reminder emails will appear once tools are checked out or scheduled.</p>
      </div>
    `;
    return;
  }

  queueItems.forEach(checkout => {
    emailQueue.innerHTML += `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>${escapeHTML(checkout.tool)}</strong>
          <span class="status-badge ${statusClass(checkout.status)}">${statusLabel(checkout.status)}</span>
        </div>
        <p class="muted"><strong>To:</strong> ${escapeHTML(checkout.email)}</p>
        ${
          checkout.status === "scheduled"
            ? `
              <p class="muted"><strong>Reservation reminder:</strong> ${checkout.scheduledReminderSent ? "Sent" : "Pending"}</p>
              <p class="muted"><strong>Start-day email:</strong> ${checkout.startDayEmailSent ? "Sent" : "Pending"}</p>
            `
            : `
              <p class="muted"><strong>Day-before reminder:</strong> ${checkout.reminder24Sent ? "Sent" : "Pending"}</p>
              <p class="muted"><strong>Due-day reminder:</strong> ${checkout.reminderReturnDaySent ? "Sent" : "Pending"}</p>
              <p class="muted"><strong>Overdue notice:</strong> ${checkout.lateNoticeSent ? "Sent" : "Pending"}</p>
            `
        }
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

function setCheckoutMode(mode) {
  checkoutMode = mode;

  checkoutNowTab.classList.toggle("active", mode === "now");
  checkoutLaterTab.classList.toggle("active", mode === "later");
  scheduledStartWrap.classList.toggle("hidden", mode !== "later");

  checkoutSubmitBtn.innerText = mode === "later" ? "Call Dibs / Schedule Checkout" : "Check Out Tool";

  if (mode === "later") {
    scheduledStartDate.required = true;
  } else {
    scheduledStartDate.required = false;
  }
}

function resetCheckoutForm() {
  checkoutForm.reset();
  selectedTool.value = "";
  selectedToolLabel.innerText = "Select a tool";
  selectedToolCategoryLabel.innerText = "Search or choose from a category";
  toolSearchInput.value = "";
  toolSearchQuery = "";
  activeToolCategory = "all";
  checkoutDamageWrap.classList.add("hidden");
  setDefaultReturnDate();
  renderToolPicker();
}

function buildExportHtml(records) {
  const rows = records.map(checkout => `
    <tr>
      <td>${escapeHTML(checkout.tool)}</td>
      <td>${escapeHTML(checkout.name)}</td>
      <td>${escapeHTML(checkout.email)}</td>
      <td>${escapeHTML(checkout.phoneFormatted)}</td>
      <td>${formatDateTime(getCheckoutStartForDisplay(checkout))}</td>
      <td>${formatDateTime(checkout.expectedReturnAt)}</td>
      <td>${statusLabel(checkout.status)}</td>
    </tr>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>ADB Tool Checkout Records</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
    h1 { margin-bottom: 4px; }
    p { color: #4b5563; }
    table { width: 100%; border-collapse: collapse; margin-top: 22px; }
    th { background: #111827; color: white; text-align: left; }
    th, td { border: 1px solid #e5e7eb; padding: 10px; font-size: 13px; }
    tr:nth-child(even) { background: #f9fafb; }
  </style>
</head>
<body>
  <h1>ADB Tool Checkout Records</h1>
  <p>Exported ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr>
        <th>Tool</th>
        <th>Name</th>
        <th>Email</th>
        <th>Phone</th>
        <th>Checked Out / Start</th>
        <th>Expected Return</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="7">No records found.</td></tr>`}
    </tbody>
  </table>
</body>
</html>
  `;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function exportHtmlRecords() {
  const records = getFilteredRecords();
  downloadTextFile("adb-tool-checkout-records.html", buildExportHtml(records), "text/html");
}

function exportPdfRecords() {
  const records = getFilteredRecords();
  const exportWindow = window.open("", "_blank");

  if (!exportWindow) {
    alert("Popup blocked. Please allow popups to export PDF.");
    return;
  }

  exportWindow.document.open();
  exportWindow.document.write(buildExportHtml(records));
  exportWindow.document.close();

  exportWindow.onload = () => {
    exportWindow.focus();
    exportWindow.print();
  };
}

phoneNumber.addEventListener("input", () => {
  phoneNumber.value = formatPhone(phoneNumber.value);
});

verifyPhoneNumber.addEventListener("input", () => {
  verifyPhoneNumber.value = formatPhone(verifyPhoneNumber.value);
});

if (requestPhoneNumber) {
  requestPhoneNumber.addEventListener("input", () => {
    requestPhoneNumber.value = formatPhone(requestPhoneNumber.value);
  });
}

checkoutNowTab.addEventListener("click", () => setCheckoutMode("now"));
checkoutLaterTab.addEventListener("click", () => setCheckoutMode("later"));

damageAtCheckout.addEventListener("change", () => {
  checkoutDamageWrap.classList.toggle("hidden", !damageAtCheckout.checked);
});

damageAtReturn.addEventListener("change", () => {
  returnDamageWrap.classList.toggle("hidden", !damageAtReturn.checked);
});

checkoutForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("workerName").value.trim();
  const emailPrefix = document.getElementById("emailPrefix").value.trim();
  const phoneFormatted = formatPhone(phoneNumber.value);
  const digits = phoneDigits(phoneNumber.value);
  const tool = selectedTool.value.trim();
  const hasCheckoutDamage = damageAtCheckout.checked;
  const checkoutDamageText = checkoutDamageComment.value.trim();

  if (!name || !emailPrefix || digits.length !== 10 || !tool || !expectedReturnDate.value) {
    alert("Please complete every field. Phone number must be 10 digits and a tool must be selected.");
    return;
  }

  if (checkoutMode === "later" && !scheduledStartDate.value) {
    alert("Please select the scheduled checkout start date.");
    return;
  }

  if (hasCheckoutDamage && !checkoutDamageText) {
    alert("Please describe the damage or missing items before submitting.");
    return;
  }

  if (isToolCurrentlyOut(tool)) {
    alert("This tool is currently checked out and unavailable.");
    return;
  }

  const checkoutStartAt = checkoutMode === "later"
    ? makeScheduledStartDate(scheduledStartDate.value)
    : makeCheckoutDate();

  let expectedReturnAt = makeReturnDate(expectedReturnDate.value);

  if (new Date(expectedReturnAt) <= new Date(checkoutStartAt)) {
    alert("Expected return date must be after the checkout start date.");
    return;
  }

  if (checkoutMode === "now") {
    const conflictResult = getLatestReturnBeforeConflict(tool, checkoutStartAt, expectedReturnAt);

    if (conflictResult.hasConflict) {
      expectedReturnAt = conflictResult.adjustedReturnAt;
      expectedReturnDate.value = dateInputFromISO(expectedReturnAt);

      alert(
        `${tool} has dibs starting ${formatDate(conflictResult.conflict.checkoutStartAt || conflictResult.conflict.checkedOutAt)}. This checkout is allowed, but it cannot be checked out that long. The return date has been adjusted to the latest available date: ${formatDate(expectedReturnAt)}.`
      );
    }
  }

  if (checkoutMode === "later") {
    const scheduledConflict = getConflictingScheduledCheckout(tool, checkoutStartAt, expectedReturnAt);

    if (scheduledConflict) {
      alert(`${tool} already has dibs during that date range. Please choose a different date range.`);
      return;
    }
  }

  await addDoc(collection(db, "checkouts"), {
    name,
    email: getFullEmail(emailPrefix),
    phoneFormatted,
    phoneDigits: digits,
    tool,
    checkedOutAt: checkoutMode === "later" ? null : checkoutStartAt,
    checkoutStartAt,
    expectedReturnAt,
    status: checkoutMode === "later" ? "scheduled" : "out",
    returnedAt: null,
    cancelledAt: null,
    damageAtCheckout: hasCheckoutDamage,
    damageComment: checkoutDamageText,
    reminder24Sent: false,
    reminderReturnDaySent: false,
    lateNoticeSent: false,
    scheduledReminderSent: false,
    startDayEmailSent: false,
    createdAt: serverTimestamp()
  });

  if (hasCheckoutDamage) {
    await addDoc(collection(db, "damageReports"), {
      tool,
      reportType: checkoutMode === "later" ? "Scheduled Checkout" : "Checkout",
      name,
      email: getFullEmail(emailPrefix),
      phoneFormatted,
      phoneDigits: digits,
      comment: checkoutDamageText,
      createdAt: serverTimestamp()
    });
  }

  resetCheckoutForm();
});

if (requestForm) {
  requestForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = requestName.value.trim();
    const emailPrefix = requestEmailPrefix.value.trim();
    const phoneFormatted = formatPhone(requestPhoneNumber.value);
    const digits = phoneDigits(requestPhoneNumber.value);
    const type = requestType.value;
    const comment = requestComment.value.trim();

    if (!name || !emailPrefix || digits.length !== 10 || !type || !comment) {
      alert("Please complete every field. Phone number must be 10 digits.");
      return;
    }

    await addDoc(collection(db, "requests"), {
      name,
      email: getFullEmail(emailPrefix),
      phoneFormatted,
      phoneDigits: digits,
      type,
      comment,
      createdAt: serverTimestamp()
    });

    requestForm.reset();
    alert("Request submitted.");
  });
}

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
requestBtn.addEventListener("click", () => showView("request"));
adminBtn.addEventListener("click", () => showView("admin"));

searchInput.addEventListener("input", renderRecordsTable);
statusFilter.addEventListener("change", renderRecordsTable);

if (recordStartDate) recordStartDate.addEventListener("change", renderRecordsTable);
if (recordEndDate) recordEndDate.addEventListener("change", renderRecordsTable);

document.getElementById("clearDateFiltersBtn").addEventListener("click", () => {
  recordStartDate.value = "";
  recordEndDate.value = "";
  renderRecordsTable();
});

document.getElementById("exportHtmlBtn").addEventListener("click", exportHtmlRecords);
document.getElementById("exportPdfBtn").addEventListener("click", exportPdfRecords);

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
  const confirmed = confirm("Clear all returned and cancelled checkout records?");
  if (!confirmed) return;

  const oldRecords = checkouts.filter(checkout => checkout.status === "returned" || checkout.status === "cancelled");

  for (const checkout of oldRecords) {
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
setCheckoutMode("now");
showView("dashboard");