const defaultComponents = [
  {
    name: "3/8 Stainless Bolt",
    category: "Fasteners",
    type: "Bolts",
    use: "Mounting brackets and frame hardware",
    stock: 12,
    minimum: 25,
    location: "Aisle 2 / Bin B4"
  },
  {
    name: "Self-Tapping Screw Pack",
    category: "Fasteners",
    type: "Screws",
    use: "General mounting and small hardware fastening",
    stock: 44,
    minimum: 50,
    location: "Aisle 2 / Bin C1"
  },
  {
    name: "Concrete Anchor Kit",
    category: "Fasteners",
    type: "Anchors",
    use: "Securing mounts into concrete pads or walls",
    stock: 31,
    minimum: 20,
    location: "Aisle 2 / Bin D2"
  },
  {
    name: "AC Disconnect",
    category: "Power / AC",
    type: "Disconnects",
    use: "Safely disconnecting site AC power during service",
    stock: 6,
    minimum: 5,
    location: "Aisle 4 / Shelf A2"
  },
  {
    name: "Outdoor AC Unit",
    category: "Power / AC",
    type: "AC Units",
    use: "Cooling cabinets and equipment shelters",
    stock: 2,
    minimum: 4,
    location: "Bulk Storage / Row 1"
  },
  {
    name: "20A Breaker",
    category: "Power / AC",
    type: "Breakers",
    use: "Electrical panel protection for wireless site circuits",
    stock: 18,
    minimum: 12,
    location: "Aisle 4 / Bin C3"
  },
  {
    name: "Antenna Mount",
    category: "RF / Wireless",
    type: "Mounts",
    use: "Attaching antennas to tower or rooftop structures",
    stock: 30,
    minimum: 15,
    location: "Aisle 1 / Rack B"
  },
  {
    name: "Coax Jumper",
    category: "RF / Wireless",
    type: "Coax",
    use: "Connecting radios, antennas, and RF equipment",
    stock: 48,
    minimum: 50,
    location: "Aisle 3 / Bin A1"
  },
  {
    name: "Remote Radio Head",
    category: "RF / Wireless",
    type: "Radios",
    use: "Wireless signal transmission and receive equipment",
    stock: 7,
    minimum: 6,
    location: "Secure Cage / Shelf 2"
  },
  {
    name: "Fiber Jumper",
    category: "Fiber / Data",
    type: "Fiber",
    use: "Connecting data equipment inside cabinets",
    stock: 0,
    minimum: 20,
    location: "Aisle 5 / Bin F1"
  },
  {
    name: "SFP Module",
    category: "Fiber / Data",
    type: "Data Modules",
    use: "Network interface module for fiber connections",
    stock: 14,
    minimum: 10,
    location: "Secure Cage / Drawer 3"
  },
  {
    name: "Grounding Lug",
    category: "Grounding",
    type: "Grounding Hardware",
    use: "Bonding equipment to grounding systems",
    stock: 22,
    minimum: 30,
    location: "Aisle 6 / Bin G2"
  }
];

let components = JSON.parse(localStorage.getItem("adbInventory")) || defaultComponents;
let isLoggedIn = false;

const dashboardView = document.getElementById("dashboardView");
const categoryView = document.getElementById("categoryView");
const inventoryView = document.getElementById("inventoryView");
const adminView = document.getElementById("adminView");

const dashboardBtn = document.getElementById("dashboardBtn");
const inventoryBtn = document.getElementById("inventoryBtn");
const adminBtn = document.getElementById("adminBtn");
const logoHomeBtn = document.getElementById("logoHomeBtn");

const categoryGrid = document.getElementById("categoryGrid");
const componentGrid = document.getElementById("componentGrid");
const inventoryTable = document.getElementById("inventoryTable");

const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");

function saveData() {
  localStorage.setItem("adbInventory", JSON.stringify(components));
}

function refreshEverything() {
  document.getElementById("totalParts").innerText = components.length;
  renderCategories();
  loadTable();
  renderAdminList();
}

function getStatus(component) {
  if (component.stock === 0) return "out";
  if (component.stock < component.minimum) return "low";
  return "good";
}

function getStatusLabel(component) {
  const status = getStatus(component);
  if (status === "out") return "Out of Stock";
  if (status === "low") return "Low Stock";
  return "Healthy";
}

function showView(viewName) {
  dashboardView.classList.add("hidden");
  categoryView.classList.add("hidden");
  inventoryView.classList.add("hidden");
  adminView.classList.add("hidden");

  dashboardBtn.classList.remove("active");
  inventoryBtn.classList.remove("active");
  adminBtn.classList.remove("active");

  if (viewName === "dashboard") {
    dashboardView.classList.remove("hidden");
    dashboardBtn.classList.add("active");
  }

  if (viewName === "category") {
    categoryView.classList.remove("hidden");
  }

  if (viewName === "inventory") {
    inventoryView.classList.remove("hidden");
    inventoryBtn.classList.add("active");
    loadTable();
  }

  if (viewName === "admin") {
    adminView.classList.remove("hidden");
    adminBtn.classList.add("active");
    renderAdminState();
  }
}

function renderCategories() {
  const categories = [...new Set(components.map(component => component.category))];
  categoryGrid.innerHTML = "";

  categories.forEach(category => {
    const items = components.filter(component => component.category === category);
    const lowStockCount = items.filter(component => component.stock < component.minimum).length;
    const types = [...new Set(items.map(component => component.type))];

    categoryGrid.innerHTML += `
      <article class="category-card">
        <div class="category-top">
          <h3>${category}</h3>
          <span class="count-pill">${items.length} items</span>
        </div>

        <ul>
          ${types.slice(0, 5).map(type => `<li>${type}</li>`).join("")}
        </ul>

        <div class="category-meta">
          <span class="meta-chip">${items.reduce((sum, item) => sum + Number(item.stock), 0)} units in stock</span>
          <span class="meta-chip ${lowStockCount > 0 ? "low" : ""}">${lowStockCount} low-stock</span>
        </div>

        <button class="openCategory" data-category="${category}">
          View Components
        </button>
      </article>
    `;
  });

  document.querySelectorAll(".openCategory").forEach(button => {
    button.addEventListener("click", () => {
      showCategory(button.dataset.category);
    });
  });
}

function showCategory(category) {
  showView("category");

  document.getElementById("categoryTitle").innerText = category;
  componentGrid.innerHTML = "";

  components
    .filter(component => component.category === category)
    .forEach(component => {
      const status = getStatus(component);

      componentGrid.innerHTML += `
        <article class="component-card">
          <div class="placeholder-image">
            <div class="placeholder-box">
              <div class="placeholder-icon">${getIcon(component.category)}</div>
              <div class="placeholder-label">${component.type}</div>
            </div>
          </div>

          <div class="component-info">
            <h3>${component.name}</h3>
            <p>${component.use}</p>
            <p><strong>Location:</strong> ${component.location}</p>

            <div class="status-row">
              <p><strong>${component.stock}</strong> in stock</p>
              <span class="status-badge ${status}">
                ${getStatusLabel(component)}
              </span>
            </div>
          </div>
        </article>
      `;
    });
}

function getIcon(category) {
  if (category.includes("Fasteners")) return "🔩";
  if (category.includes("Power")) return "⚡";
  if (category.includes("RF")) return "📡";
  if (category.includes("Fiber")) return "🔌";
  if (category.includes("Grounding")) return "⏚";
  return "📦";
}

function loadTable() {
  const query = searchInput.value.toLowerCase().trim();
  const filter = stockFilter.value;

  const filteredComponents = components.filter(component => {
    const searchableText = `
      ${component.name}
      ${component.category}
      ${component.type}
      ${component.use}
      ${component.location}
    `.toLowerCase();

    const matchesSearch = searchableText.includes(query);
    const status = getStatus(component);

    const matchesFilter = filter === "all" || filter === status;

    return matchesSearch && matchesFilter;
  });

  inventoryTable.innerHTML = "";

  if (filteredComponents.length === 0) {
    inventoryTable.innerHTML = `
      <tr>
        <td colspan="7">No components match your search.</td>
      </tr>
    `;
    return;
  }

  filteredComponents.forEach(component => {
    const status = getStatus(component);

    inventoryTable.innerHTML += `
      <tr class="${status === "low" || status === "out" ? "low-stock" : ""}">
        <td>${component.name}</td>
        <td>${component.category}</td>
        <td>${component.type}</td>
        <td>${component.stock}</td>
        <td>${component.minimum}</td>
        <td>${component.location}</td>
        <td>
          <span class="status-badge ${status}">
            ${getStatusLabel(component)}
          </span>
        </td>
      </tr>
    `;
  });
}

function renderAdminState() {
  document.getElementById("loginPanel").classList.toggle("hidden", isLoggedIn);
  document.getElementById("adminPanel").classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    renderAdminList();
  }
}

function renderAdminList() {
  const adminList = document.getElementById("adminList");
  if (!adminList) return;

  adminList.innerHTML = "";

  components.forEach((component, index) => {
    adminList.innerHTML += `
      <div class="admin-item">
        <div class="admin-item-header">
          <strong>${component.name}</strong>
          <span class="status-badge ${getStatus(component)}">${getStatusLabel(component)}</span>
        </div>

        <div class="admin-edit-row">
          <input value="${component.name}" data-index="${index}" data-field="name">
          <input value="${component.category}" data-index="${index}" data-field="category">
          <input value="${component.type}" data-index="${index}" data-field="type">
          <input value="${component.use}" data-index="${index}" data-field="use">
          <input type="number" value="${component.stock}" data-index="${index}" data-field="stock">
          <input type="number" value="${component.minimum}" data-index="${index}" data-field="minimum">
          <input value="${component.location}" data-index="${index}" data-field="location">
          <button class="save-btn" data-index="${index}">Save</button>
          <button class="delete-btn" data-index="${index}">Delete</button>
        </div>
      </div>
    `;
  });

  document.querySelectorAll(".save-btn").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const inputs = document.querySelectorAll(`[data-index="${index}"][data-field]`);

      inputs.forEach(input => {
        const field = input.dataset.field;
        components[index][field] =
          field === "stock" || field === "minimum"
            ? Number(input.value)
            : input.value;
      });

      saveData();
      refreshEverything();
    });
  });

  document.querySelectorAll(".delete-btn").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const confirmed = confirm(`Delete ${components[index].name}?`);

      if (!confirmed) return;

      components.splice(index, 1);
      saveData();
      refreshEverything();
    });
  });
}

document.getElementById("loginBtn").addEventListener("click", () => {
  const password = document.getElementById("passwordInput").value;

  if (password === "ADB") {
    isLoggedIn = true;
    document.getElementById("loginError").classList.add("hidden");
    document.getElementById("passwordInput").value = "";
    renderAdminState();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  isLoggedIn = false;
  renderAdminState();
});

document.getElementById("addForm").addEventListener("submit", event => {
  event.preventDefault();

  const newComponent = {
    name: document.getElementById("newName").value,
    category: document.getElementById("newCategory").value,
    type: document.getElementById("newType").value,
    use: document.getElementById("newUse").value,
    stock: Number(document.getElementById("newStock").value),
    minimum: Number(document.getElementById("newMinimum").value),
    location: document.getElementById("newLocation").value
  };

  components.push(newComponent);
  saveData();
  event.target.reset();
  refreshEverything();
});

dashboardBtn.addEventListener("click", () => showView("dashboard"));
logoHomeBtn.addEventListener("click", () => showView("dashboard"));
inventoryBtn.addEventListener("click", () => showView("inventory"));
adminBtn.addEventListener("click", () => showView("admin"));

document.getElementById("backBtn").addEventListener("click", () => {
  showView("dashboard");
});

searchInput.addEventListener("input", loadTable);
stockFilter.addEventListener("change", loadTable);

refreshEverything();
showView("dashboard");
