const STORAGE_KEY = "daily-ledger-records-v1";
const BUDGET_KEY = "daily-ledger-budgets-v1";

const expenseCategories = ["餐饮", "交通", "购物", "住房", "水电", "娱乐", "医疗", "学习", "人情", "其他"];
const incomeCategories = ["工资", "生意", "奖金", "报销", "投资", "其他"];
const chartColors = ["#2563eb", "#16a34a", "#d84b38", "#d88918", "#7c3aed", "#0891b2", "#db2777", "#475569"];

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

const state = {
  type: "expense",
  month: monthKey(new Date()),
  records: loadJson(STORAGE_KEY, []),
  budgets: loadJson(BUDGET_KEY, {}),
  search: "",
  filterType: "all",
};

const el = {
  monthPicker: document.querySelector("#monthPicker"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  expenseType: document.querySelector("#expenseType"),
  incomeType: document.querySelector("#incomeType"),
  form: document.querySelector("#entryForm"),
  amount: document.querySelector("#amount"),
  category: document.querySelector("#category"),
  date: document.querySelector("#date"),
  account: document.querySelector("#account"),
  note: document.querySelector("#note"),
  budgetInput: document.querySelector("#budgetInput"),
  saveBudget: document.querySelector("#saveBudget"),
  totalExpense: document.querySelector("#totalExpense"),
  totalIncome: document.querySelector("#totalIncome"),
  balance: document.querySelector("#balance"),
  budgetLeft: document.querySelector("#budgetLeft"),
  searchInput: document.querySelector("#searchInput"),
  filterType: document.querySelector("#filterType"),
  exportCsv: document.querySelector("#exportCsv"),
  importCsv: document.querySelector("#importCsv"),
  clearData: document.querySelector("#clearData"),
  addSample: document.querySelector("#addSample"),
  records: document.querySelector("#records"),
  template: document.querySelector("#recordTemplate"),
  recordCount: document.querySelector("#recordCount"),
  categoryChart: document.querySelector("#categoryChart"),
  categoryList: document.querySelector("#categoryList"),
};

init();

function init() {
  el.monthPicker.value = state.month;
  el.date.value = toDateInput(new Date());
  renderCategoryOptions();
  render();

  el.expenseType.addEventListener("click", () => setType("expense"));
  el.incomeType.addEventListener("click", () => setType("income"));
  el.form.addEventListener("submit", addRecord);
  el.monthPicker.addEventListener("change", () => {
    state.month = el.monthPicker.value || monthKey(new Date());
    render();
  });
  el.prevMonth.addEventListener("click", () => shiftMonth(-1));
  el.nextMonth.addEventListener("click", () => shiftMonth(1));
  el.saveBudget.addEventListener("click", saveBudget);
  el.searchInput.addEventListener("input", () => {
    state.search = el.searchInput.value.trim().toLowerCase();
    renderRecords();
  });
  el.filterType.addEventListener("change", () => {
    state.filterType = el.filterType.value;
    renderRecords();
  });
  el.exportCsv.addEventListener("click", exportCsv);
  el.importCsv.addEventListener("change", importCsv);
  el.clearData.addEventListener("click", clearCurrentMonth);
  el.addSample.addEventListener("click", addSampleRecords);
}

function setType(type) {
  state.type = type;
  el.expenseType.classList.toggle("active", type === "expense");
  el.incomeType.classList.toggle("active", type === "income");
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const categories = state.type === "expense" ? expenseCategories : incomeCategories;
  el.category.innerHTML = categories.map((category) => `<option>${category}</option>`).join("");
}

function addRecord(event) {
  event.preventDefault();
  const amount = Number(el.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;

  state.records.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type: state.type,
    amount: Math.round(amount * 100) / 100,
    category: el.category.value,
    date: el.date.value,
    account: el.account.value,
    note: el.note.value.trim(),
    createdAt: new Date().toISOString(),
  });

  saveRecords();
  el.form.reset();
  el.date.value = toDateInput(new Date());
  renderCategoryOptions();
  render();
}

function render() {
  const monthRecords = getMonthRecords();
  const income = sum(monthRecords.filter((item) => item.type === "income"));
  const expense = sum(monthRecords.filter((item) => item.type === "expense"));
  const budget = Number(state.budgets[state.month] || 0);

  el.totalExpense.textContent = money(expense);
  el.totalIncome.textContent = money(income);
  el.balance.textContent = money(income - expense);
  el.budgetLeft.textContent = budget > 0 ? money(budget - expense) : "未设置";
  el.budgetLeft.style.color = budget > 0 && budget - expense < 0 ? "#d84b38" : "";
  el.budgetInput.value = budget > 0 ? budget : "";
  el.recordCount.textContent = `${monthRecords.length} 笔`;

  renderRecords();
  renderChart(monthRecords);
}

function renderRecords() {
  const records = getFilteredRecords();
  el.records.innerHTML = "";
  if (records.length === 0) {
    el.records.innerHTML = '<div class="empty">这个月份还没有记录</div>';
    return;
  }

  records.forEach((record) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    const icon = record.category.slice(0, 1);
    node.querySelector(".record-icon").textContent = icon;
    node.querySelector(".record-category").textContent = record.category;
    node.querySelector(".record-meta").textContent = [record.date, record.account, record.note].filter(Boolean).join(" · ");
    const moneyNode = node.querySelector(".record-money");
    moneyNode.textContent = `${record.type === "expense" ? "-" : "+"}${money(record.amount)}`;
    moneyNode.classList.add(record.type);
    node.querySelector(".delete-record").addEventListener("click", () => deleteRecord(record.id));
    el.records.appendChild(node);
  });
}

function renderChart(records) {
  const expenseRows = records.filter((record) => record.type === "expense");
  const grouped = groupByCategory(expenseRows);
  const total = grouped.reduce((acc, item) => acc + item.amount, 0);
  const ctx = el.categoryChart.getContext("2d");
  const width = el.categoryChart.width;
  const height = el.categoryChart.height;
  ctx.clearRect(0, 0, width, height);

  if (grouped.length === 0) {
    ctx.fillStyle = "#657084";
    ctx.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂无支出数据", width / 2, height / 2);
    el.categoryList.innerHTML = "";
    return;
  }

  let start = -Math.PI / 2;
  grouped.forEach((item, index) => {
    const angle = (item.amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2);
    ctx.arc(width / 2, height / 2, 92, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = chartColors[index % chartColors.length];
    ctx.fill();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 52, 0, Math.PI * 2);
  ctx.fillStyle = "#fbfcff";
  ctx.fill();
  ctx.fillStyle = "#172033";
  ctx.font = "700 18px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(money(total), width / 2, height / 2 + 6);

  el.categoryList.innerHTML = grouped.map((item, index) => {
    const percent = total ? Math.round((item.amount / total) * 100) : 0;
    return `
      <div class="category-item">
        <strong>${item.category}</strong>
        <span>${money(item.amount)} · ${percent}%</span>
        <div class="category-bar"><span style="width:${percent}%;background:${chartColors[index % chartColors.length]}"></span></div>
      </div>
    `;
  }).join("");
}

function getMonthRecords() {
  return state.records
    .filter((record) => record.date && record.date.startsWith(state.month))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function getFilteredRecords() {
  return getMonthRecords().filter((record) => {
    const matchesType = state.filterType === "all" || record.type === state.filterType;
    const haystack = `${record.category} ${record.account} ${record.note}`.toLowerCase();
    const matchesSearch = !state.search || haystack.includes(state.search);
    return matchesType && matchesSearch;
  });
}

function groupByCategory(records) {
  const map = new Map();
  records.forEach((record) => {
    map.set(record.category, (map.get(record.category) || 0) + record.amount);
  });
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function deleteRecord(id) {
  state.records = state.records.filter((record) => record.id !== id);
  saveRecords();
  render();
}

function saveBudget() {
  const value = Number(el.budgetInput.value);
  if (!Number.isFinite(value) || value <= 0) {
    delete state.budgets[state.month];
  } else {
    state.budgets[state.month] = Math.round(value * 100) / 100;
  }
  localStorage.setItem(BUDGET_KEY, JSON.stringify(state.budgets));
  render();
}

function shiftMonth(delta) {
  const [year, month] = state.month.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  state.month = monthKey(next);
  el.monthPicker.value = state.month;
  render();
}

function exportCsv() {
  const rows = getMonthRecords();
  const header = ["类型", "日期", "分类", "金额", "账户", "备注"];
  const body = rows.map((record) => [
    record.type === "expense" ? "支出" : "收入",
    record.date,
    record.category,
    record.amount,
    record.account,
    record.note,
  ]);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `记账明细-${state.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const imported = parseCsv(String(reader.result || ""));
    state.records = [...imported, ...state.records];
    saveRecords();
    render();
    el.importCsv.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function parseCsv(text) {
  const lines = text.replace(/^\ufeff/, "").split(/\r?\n/).filter(Boolean);
  const rows = lines.map(splitCsvLine);
  return rows.slice(1).map((row) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type: row[0] === "收入" || row[0] === "income" ? "income" : "expense",
    date: row[1] || toDateInput(new Date()),
    category: row[2] || "其他",
    amount: Number(row[3]) || 0,
    account: row[4] || "现金",
    note: row[5] || "",
    createdAt: new Date().toISOString(),
  })).filter((record) => record.amount > 0);
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function clearCurrentMonth() {
  const monthCount = getMonthRecords().length;
  if (monthCount === 0) return;
  const confirmed = window.confirm(`确认清空 ${state.month} 的 ${monthCount} 笔记录吗？`);
  if (!confirmed) return;
  state.records = state.records.filter((record) => !record.date.startsWith(state.month));
  saveRecords();
  render();
}

function addSampleRecords() {
  const today = toDateInput(new Date());
  const samples = [
    ["expense", 28, "餐饮", "微信", "午餐"],
    ["expense", 16, "交通", "支付宝", "地铁"],
    ["expense", 128, "购物", "银行卡", "日用品"],
    ["income", 5000, "工资", "银行卡", "本月工资"],
  ];
  const newRecords = samples.map(([type, amount, category, account, note], index) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
    type,
    amount,
    category,
    account,
    note,
    date: today,
    createdAt: new Date(Date.now() - index * 1000).toISOString(),
  }));
  state.records = [...newRecords, ...state.records];
  saveRecords();
  render();
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function sum(records) {
  return records.reduce((acc, item) => acc + Number(item.amount || 0), 0);
}

function money(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
