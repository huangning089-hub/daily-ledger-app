const STORAGE_KEY = "growth-tracker-records-v1";
const ACTIVE_KEY = "growth-tracker-active-area-v1";

const areas = [
  {
    id: "money",
    name: "赚钱",
    icon: "钱",
    color: "#236c50",
    prompt: "记录今天让收入、客户、现金流变好的动作。",
    templates: ["联系新客户", "跟进老客户", "复盘一笔生意"]
  },
  {
    id: "body",
    name: "身体",
    icon: "身",
    color: "#2f7da3",
    prompt: "记录运动、睡眠、饮食、体检和精力状态。",
    templates: ["运动30分钟", "早睡一次", "控制饮食"]
  },
  {
    id: "family",
    name: "家庭",
    icon: "家",
    color: "#a75f2b",
    prompt: "记录陪伴、沟通、照顾和让家更稳定的事。",
    templates: ["陪家人聊天", "处理家里一件事", "表达感谢"]
  },
  {
    id: "speech",
    name: "表达",
    icon: "说",
    color: "#8b5bb5",
    prompt: "记录说话、写作、谈判、汇报和情绪表达。",
    templates: ["练习表达", "写一段总结", "完成一次沟通"]
  },
  {
    id: "tech",
    name: "技术",
    icon: "技",
    color: "#2767b0",
    prompt: "记录学到的工具、系统、代码、流程和方法。",
    templates: ["学一个工具", "修一个问题", "做一个小功能"]
  },
  {
    id: "manage",
    name: "管理",
    icon: "管",
    color: "#b13f4f",
    prompt: "记录计划、分工、复盘、流程、团队和执行力。",
    templates: ["列明日计划", "复盘一个流程", "推进一个任务"]
  }
];

const state = {
  activeArea: localStorage.getItem(ACTIVE_KEY) || "money",
  records: loadRecords(),
  month: currentMonth(),
  areaFilter: "all",
  query: ""
};

const el = {
  todayCount: document.querySelector("#todayCount"),
  monthCount: document.querySelector("#monthCount"),
  avgScore: document.querySelector("#avgScore"),
  boardGrid: document.querySelector("#boardGrid"),
  activeTitle: document.querySelector("#activeTitle"),
  activePrompt: document.querySelector("#activePrompt"),
  activeBadge: document.querySelector("#activeBadge"),
  form: document.querySelector("#recordForm"),
  date: document.querySelector("#date"),
  kind: document.querySelector("#kind"),
  title: document.querySelector("#title"),
  metric: document.querySelector("#metric"),
  score: document.querySelector("#score"),
  note: document.querySelector("#note"),
  next: document.querySelector("#next"),
  templateRow: document.querySelector("#templateRow"),
  monthFilter: document.querySelector("#monthFilter"),
  areaFilter: document.querySelector("#areaFilter"),
  search: document.querySelector("#search"),
  exportJson: document.querySelector("#exportJson"),
  importJson: document.querySelector("#importJson"),
  exportCsv: document.querySelector("#exportCsv"),
  records: document.querySelector("#records"),
  recordCount: document.querySelector("#recordCount"),
  template: document.querySelector("#recordTemplate")
};

init();

function init() {
  el.date.value = todayInput();
  areas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area.id;
    option.textContent = area.name;
    el.areaFilter.appendChild(option);
  });
  renderBoards();
  renderMonthOptions();
  renderActiveArea();
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  el.form.addEventListener("submit", saveRecord);
  el.monthFilter.addEventListener("change", () => {
    state.month = el.monthFilter.value;
    render();
  });
  el.areaFilter.addEventListener("change", () => {
    state.areaFilter = el.areaFilter.value;
    renderRecords();
  });
  el.search.addEventListener("input", () => {
    state.query = el.search.value.trim().toLowerCase();
    renderRecords();
  });
  el.exportJson.addEventListener("click", exportBackup);
  el.importJson.addEventListener("change", importBackup);
  el.exportCsv.addEventListener("click", exportCsv);
}

function renderBoards() {
  el.boardGrid.innerHTML = "";
  areas.forEach((area) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "board-card";
    card.style.setProperty("--area", area.color);
    card.dataset.area = area.id;
    card.innerHTML = `
      <div class="board-head">
        <div class="board-icon">${area.icon}</div>
        <h3>${area.name}</h3>
      </div>
      <p>${area.prompt}</p>
      <div class="board-stats">
        <span>今日 ${countToday(area.id)}</span>
        <span>本月 ${countMonth(area.id)}</span>
      </div>
    `;
    card.addEventListener("click", () => setActiveArea(area.id));
    el.boardGrid.appendChild(card);
  });
}

function setActiveArea(areaId) {
  state.activeArea = areaId;
  localStorage.setItem(ACTIVE_KEY, areaId);
  renderBoards();
  renderActiveArea();
}

function renderActiveArea() {
  const area = getArea(state.activeArea);
  document.querySelectorAll(".board-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.area === state.activeArea);
  });
  el.activeTitle.textContent = area.name;
  el.activePrompt.textContent = area.prompt;
  el.activeBadge.textContent = `今日 ${countToday(area.id)} 条`;
  el.templateRow.innerHTML = "";
  area.templates.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = template;
    button.addEventListener("click", () => {
      el.title.value = template;
      el.title.focus();
    });
    el.templateRow.appendChild(button);
  });
}

function saveRecord(event) {
  event.preventDefault();
  state.records.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    area: state.activeArea,
    date: el.date.value,
    kind: el.kind.value,
    title: el.title.value.trim(),
    metric: el.metric.value.trim(),
    score: Number(el.score.value),
    note: el.note.value.trim(),
    next: el.next.value.trim(),
    createdAt: new Date().toISOString()
  });
  persist();
  el.form.reset();
  el.date.value = todayInput();
  el.score.value = "3";
  renderBoards();
  renderMonthOptions();
  renderActiveArea();
  render();
}

function render() {
  const todayAreas = new Set(state.records.filter((record) => record.date === todayInput()).map((record) => record.area));
  const monthRecords = state.records.filter((record) => record.date.startsWith(state.month));
  const avg = monthRecords.length ? monthRecords.reduce((sum, record) => sum + record.score, 0) / monthRecords.length : 0;
  el.todayCount.textContent = `${todayAreas.size}/6`;
  el.monthCount.textContent = `${monthRecords.length}`;
  el.avgScore.textContent = avg.toFixed(1);
  renderRecords();
}

function renderRecords() {
  const rows = state.records
    .filter((record) => record.date.startsWith(state.month))
    .filter((record) => state.areaFilter === "all" || record.area === state.areaFilter)
    .filter((record) => {
      const haystack = `${areaName(record.area)} ${record.kind} ${record.title} ${record.metric} ${record.note} ${record.next}`.toLowerCase();
      return !state.query || haystack.includes(state.query);
    });
  el.recordCount.textContent = `${rows.length} 条`;
  el.records.innerHTML = "";
  if (rows.length === 0) {
    el.records.innerHTML = '<div class="empty">还没有记录。先点一个板块，保存今天的一件事。</div>';
    return;
  }
  rows.forEach((record) => {
    const area = getArea(record.area);
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.style.setProperty("--record-color", area.color);
    node.querySelector(".record-icon").textContent = area.icon;
    node.querySelector(".record-title").textContent = record.title;
    node.querySelector(".record-meta").textContent = [record.date, area.name, record.kind, record.metric].filter(Boolean).join(" · ");
    node.querySelector(".record-note").textContent = record.note ? `复盘：${record.note}` : "";
    node.querySelector(".record-next").textContent = record.next ? `下一步：${record.next}` : "";
    node.querySelector(".record-score").textContent = `${record.score}分`;
    node.querySelector(".delete").addEventListener("click", () => deleteRecord(record.id));
    el.records.appendChild(node);
  });
}

function renderMonthOptions() {
  const months = Array.from(new Set([currentMonth(), ...state.records.map((record) => record.date.slice(0, 7))])).sort().reverse();
  el.monthFilter.innerHTML = months.map((month) => `<option value="${month}">${month}</option>`).join("");
  if (!months.includes(state.month)) state.month = months[0] || currentMonth();
  el.monthFilter.value = state.month;
}

function deleteRecord(id) {
  state.records = state.records.filter((record) => record.id !== id);
  persist();
  renderBoards();
  renderMonthOptions();
  renderActiveArea();
  render();
}

function exportBackup() {
  const backup = {
    app: "growth-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: state.records
  };
  downloadFile(`成长记录备份-${todayInput()}.json`, JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
}

function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      if (!Array.isArray(data.records)) throw new Error("invalid");
      const existingIds = new Set(state.records.map((record) => record.id));
      const imported = data.records.filter((record) => record.id && !existingIds.has(record.id));
      state.records = [...imported, ...state.records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
      persist();
      renderBoards();
      renderMonthOptions();
      renderActiveArea();
      render();
      alert(`已恢复 ${imported.length} 条记录。`);
    } catch {
      alert("备份文件无法识别，请选择从本小程序导出的 JSON 文件。");
    } finally {
      el.importJson.value = "";
    }
  };
  reader.readAsText(file, "utf-8");
}

function exportCsv() {
  const rows = state.records.filter((record) => record.date.startsWith(state.month));
  const header = ["日期", "板块", "类型", "行动", "结果数据", "评分", "复盘", "下一步"];
  const body = rows.map((record) => [
    record.date,
    areaName(record.area),
    record.kind,
    record.title,
    record.metric,
    record.score,
    record.note,
    record.next
  ]);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadFile(`成长记录-${state.month}.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function countToday(areaId) {
  return state.records.filter((record) => record.area === areaId && record.date === todayInput()).length;
}

function countMonth(areaId) {
  return state.records.filter((record) => record.area === areaId && record.date.startsWith(state.month)).length;
}

function getArea(areaId) {
  return areas.find((area) => area.id === areaId) || areas[0];
}

function areaName(areaId) {
  return getArea(areaId).name;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function todayInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMonth() {
  return todayInput().slice(0, 7);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
