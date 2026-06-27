const STORAGE_KEY = "smart-ledger-records-v1";
const SETTINGS_KEY = "smart-ledger-settings-v1";

const expenseCategories = ["餐饮", "交通", "购物", "住房", "水电", "娱乐", "医疗", "学习", "人情", "育儿", "其他"];
const incomeCategories = ["工资", "生意", "回款", "奖金", "报销", "投资", "其他"];

const categoryRules = [
  ["餐饮", ["饭", "餐", "奶茶", "咖啡", "外卖", "美团", "饿了么", "早餐", "午餐", "晚餐", "水果", "超市"]],
  ["交通", ["打车", "滴滴", "地铁", "公交", "加油", "停车", "高速", "火车", "机票"]],
  ["购物", ["淘宝", "京东", "拼多多", "购物", "衣服", "鞋", "日用品", "便利店"]],
  ["住房", ["房租", "租金", "物业", "房贷"]],
  ["水电", ["水费", "电费", "燃气", "话费", "宽带"]],
  ["娱乐", ["电影", "游戏", "会员", "旅游", "酒店"]],
  ["医疗", ["医院", "药", "产检", "挂号", "检查"]],
  ["学习", ["书", "课程", "培训", "学费"]],
  ["人情", ["红包", "礼金", "请客"]],
  ["育儿", ["孕", "宝宝", "奶粉", "尿不湿", "母婴"]]
];

const incomeWords = ["收入", "到账", "收款", "回款", "工资", "奖金", "报销", "退款", "转入", "进账"];
const accountWords = ["微信", "支付宝", "银行卡", "信用卡", "现金", "花呗"];

const state = {
  records: loadJson(STORAGE_KEY, []),
  month: currentMonth(),
  query: "",
  draftSource: "等待识别"
};

const el = {
  monthExpense: document.querySelector("#monthExpense"),
  monthIncome: document.querySelector("#monthIncome"),
  monthBalance: document.querySelector("#monthBalance"),
  modeButtons: document.querySelectorAll(".mode-tabs button"),
  panes: document.querySelectorAll(".mode-pane"),
  voiceButton: document.querySelector("#voiceButton"),
  voiceIcon: document.querySelector("#voiceIcon"),
  voiceText: document.querySelector("#voiceText"),
  parseVoice: document.querySelector("#parseVoice"),
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  runOcr: document.querySelector("#runOcr"),
  clearImage: document.querySelector("#clearImage"),
  ocrStatus: document.querySelector("#ocrStatus"),
  ocrText: document.querySelector("#ocrText"),
  parseOcr: document.querySelector("#parseOcr"),
  freeText: document.querySelector("#freeText"),
  parseText: document.querySelector("#parseText"),
  newManual: document.querySelector("#newManual"),
  draftSource: document.querySelector("#draftSource"),
  form: document.querySelector("#draftForm"),
  type: document.querySelector("#type"),
  amount: document.querySelector("#amount"),
  category: document.querySelector("#category"),
  account: document.querySelector("#account"),
  date: document.querySelector("#date"),
  merchant: document.querySelector("#merchant"),
  note: document.querySelector("#note"),
  search: document.querySelector("#search"),
  monthFilter: document.querySelector("#monthFilter"),
  exportCsv: document.querySelector("#exportCsv"),
  clearAll: document.querySelector("#clearAll"),
  records: document.querySelector("#records"),
  recordCount: document.querySelector("#recordCount"),
  template: document.querySelector("#recordTemplate")
};

let recognition = null;
let selectedImage = null;

init();

function init() {
  el.date.value = todayInput();
  renderCategoryOptions("expense");
  renderMonthOptions();
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  el.modeButtons.forEach((button) => button.addEventListener("click", () => switchMode(button.dataset.mode)));
  el.voiceButton.addEventListener("click", toggleVoice);
  el.parseVoice.addEventListener("click", () => applyDraft(parseLedgerText(el.voiceText.value), "语音"));
  el.imageInput.addEventListener("change", onImageSelected);
  el.runOcr.addEventListener("click", runOcr);
  el.clearImage.addEventListener("click", clearImage);
  el.parseOcr.addEventListener("click", () => applyDraft(parseLedgerText(el.ocrText.value), "截图"));
  el.parseText.addEventListener("click", () => applyDraft(parseLedgerText(el.freeText.value), "文字"));
  el.newManual.addEventListener("click", () => applyDraft(blankDraft(), "手动"));
  el.type.addEventListener("change", () => renderCategoryOptions(el.type.value, el.category.value));
  el.form.addEventListener("submit", saveDraft);
  el.search.addEventListener("input", () => {
    state.query = el.search.value.trim().toLowerCase();
    renderRecords();
  });
  el.monthFilter.addEventListener("change", () => {
    state.month = el.monthFilter.value;
    render();
  });
  el.exportCsv.addEventListener("click", exportCsv);
  el.clearAll.addEventListener("click", clearAll);
}

function switchMode(mode) {
  el.modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  el.panes.forEach((pane) => pane.classList.toggle("active", pane.id === `${mode}Pane`));
}

function toggleVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("这个浏览器不支持语音识别。可以用手机输入法自带的语音输入，或者用“文字”方式粘贴。");
    return;
  }
  if (recognition) {
    recognition.stop();
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.interimResults = true;
  recognition.continuous = false;
  el.voiceButton.classList.add("listening");
  el.voiceIcon.textContent = "正在听...";
  recognition.onresult = (event) => {
    const text = Array.from(event.results).map((result) => result[0].transcript).join("");
    el.voiceText.value = text;
  };
  recognition.onerror = () => {
    el.voiceIcon.textContent = "语音失败，试试文字输入";
  };
  recognition.onend = () => {
    el.voiceButton.classList.remove("listening");
    el.voiceIcon.textContent = "按一下开始，说一笔";
    const text = el.voiceText.value.trim();
    recognition = null;
    if (text) applyDraft(parseLedgerText(text), "语音");
  };
  recognition.start();
}

function onImageSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  selectedImage = file;
  const url = URL.createObjectURL(file);
  el.imagePreview.src = url;
  el.imagePreview.hidden = false;
  el.ocrStatus.textContent = "图片已选择，点“识别截图文字”。";
}

async function runOcr() {
  if (!selectedImage) {
    alert("先上传一张截图或照片。");
    return;
  }
  if (!window.Tesseract) {
    alert("截图识别库还没加载成功。请换网络或稍后再试，也可以用文字/手动记账。");
    return;
  }
  el.ocrStatus.textContent = "正在识别，第一次会比较慢...";
  el.runOcr.disabled = true;
  try {
    const result = await Tesseract.recognize(selectedImage, "chi_sim+eng", {
      logger: (progress) => {
        if (progress.status === "recognizing text") {
          el.ocrStatus.textContent = `正在识别 ${Math.round(progress.progress * 100)}%`;
        }
      }
    });
    el.ocrText.value = result.data.text.trim();
    el.ocrStatus.textContent = "识别完成，请检查文字后解析。";
    if (el.ocrText.value) applyDraft(parseLedgerText(el.ocrText.value), "截图");
  } catch (error) {
    el.ocrStatus.textContent = "识别失败。可以裁剪截图后重试，或改用文字/手动记账。";
  } finally {
    el.runOcr.disabled = false;
  }
}

function clearImage() {
  selectedImage = null;
  el.imageInput.value = "";
  el.imagePreview.src = "";
  el.imagePreview.hidden = true;
  el.ocrText.value = "";
  el.ocrStatus.textContent = "截图只用于识别文字；识别库需要网络加载，慢一点是正常的。";
}

function parseLedgerText(input) {
  const raw = (input || "").replace(/\s+/g, " ").trim();
  const normalized = normalizeChineseNumbers(raw);
  const amount = extractAmount(normalized);
  const type = incomeWords.some((word) => normalized.includes(word)) ? "income" : "expense";
  const category = inferCategory(normalized, type);
  const account = accountWords.find((word) => normalized.includes(word)) || "微信";
  const date = inferDate(normalized);
  const merchant = inferMerchant(raw);

  return {
    type,
    amount,
    category,
    account: account === "花呗" ? "支付宝" : account,
    date,
    merchant,
    note: raw.slice(0, 120)
  };
}

function extractAmount(text) {
  const candidates = [];
  const patterns = [
    /(?:¥|￥|金额|付款|支付|消费|支出|花了|花|收款|收入|到账|回款|工资|实付|合计|总计)\s*([0-9]+(?:\.[0-9]{1,2})?)/gi,
    /([0-9]+(?:\.[0-9]{1,2})?)\s*(?:元|块|rmb|cny)/gi,
    /(?:¥|￥)\s*([0-9]+(?:\.[0-9]{1,2})?)/gi
  ];
  patterns.forEach((pattern) => {
    let match = pattern.exec(text);
    while (match) {
      candidates.push(Number(match[1]));
      match = pattern.exec(text);
    }
  });
  if (candidates.length === 0) {
    const loose = text.match(/[0-9]+(?:\.[0-9]{1,2})?/g) || [];
    loose.map(Number).filter((value) => value > 0 && value < 1000000).forEach((value) => candidates.push(value));
  }
  return candidates.find((value) => value > 0) || "";
}

function inferCategory(text, type) {
  if (type === "income") {
    if (text.includes("工资")) return "工资";
    if (text.includes("回款") || text.includes("收款")) return "回款";
    if (text.includes("报销")) return "报销";
    if (text.includes("奖金")) return "奖金";
    return "其他";
  }
  for (const [category, words] of categoryRules) {
    if (words.some((word) => text.includes(word))) return category;
  }
  return "其他";
}

function inferDate(text) {
  const now = new Date();
  if (text.includes("前天")) return dateInput(addDays(now, -2));
  if (text.includes("昨天")) return dateInput(addDays(now, -1));
  const match = text.match(/(\d{1,2})[月/-](\d{1,2})[日号]?/);
  if (match) {
    const date = new Date(now.getFullYear(), Number(match[1]) - 1, Number(match[2]));
    return dateInput(date);
  }
  return todayInput();
}

function inferMerchant(text) {
  const cleaned = text.replace(/[¥￥]?\d+(?:\.\d{1,2})?\s*(元|块)?/g, " ").replace(/\s+/g, " ").trim();
  const known = ["美团", "饿了么", "滴滴", "淘宝", "京东", "拼多多", "支付宝", "微信", "医院", "药房", "便利店", "超市"];
  const found = known.find((word) => cleaned.includes(word));
  if (found) return found;
  return cleaned.slice(0, 16);
}

function normalizeChineseNumbers(text) {
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  return text.replace(/[一二两三四五六七八九十百千]+(?=元|块|块钱)/g, (part) => {
    let total = 0;
    let current = 0;
    for (const char of part) {
      if (char === "十") {
        current = current || 1;
        total += current * 10;
        current = 0;
      } else if (char === "百") {
        current = current || 1;
        total += current * 100;
        current = 0;
      } else if (char === "千") {
        current = current || 1;
        total += current * 1000;
        current = 0;
      } else {
        current = map[char] ?? current;
      }
    }
    return String(total + current);
  });
}

function applyDraft(draft, source) {
  const data = { ...blankDraft(), ...draft };
  state.draftSource = source;
  el.draftSource.textContent = source;
  el.type.value = data.type;
  renderCategoryOptions(data.type, data.category);
  el.amount.value = data.amount;
  el.category.value = data.category;
  el.account.value = data.account;
  el.date.value = data.date;
  el.merchant.value = data.merchant;
  el.note.value = data.note;
  el.amount.focus();
}

function blankDraft() {
  return {
    type: "expense",
    amount: "",
    category: "餐饮",
    account: "微信",
    date: todayInput(),
    merchant: "",
    note: ""
  };
}

function saveDraft(event) {
  event.preventDefault();
  const amount = Number(el.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) return;
  state.records.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type: el.type.value,
    amount: Math.round(amount * 100) / 100,
    category: el.category.value,
    account: el.account.value,
    date: el.date.value,
    merchant: el.merchant.value.trim(),
    note: el.note.value.trim(),
    source: state.draftSource,
    createdAt: new Date().toISOString()
  });
  saveRecords();
  renderMonthOptions();
  render();
  el.form.reset();
  applyDraft(blankDraft(), "等待识别");
}

function renderCategoryOptions(type, selected) {
  const categories = type === "income" ? incomeCategories : expenseCategories;
  const value = selected && categories.includes(selected) ? selected : categories[0];
  el.category.innerHTML = categories.map((category) => `<option>${category}</option>`).join("");
  el.category.value = value;
}

function renderMonthOptions() {
  const months = Array.from(new Set([currentMonth(), ...state.records.map((record) => record.date.slice(0, 7))])).sort().reverse();
  el.monthFilter.innerHTML = months.map((month) => `<option value="${month}">${month}</option>`).join("");
  if (!months.includes(state.month)) state.month = months[0] || currentMonth();
  el.monthFilter.value = state.month;
}

function render() {
  const monthRecords = state.records.filter((record) => record.date.startsWith(state.month));
  const expense = sum(monthRecords.filter((record) => record.type === "expense"));
  const income = sum(monthRecords.filter((record) => record.type === "income"));
  el.monthExpense.textContent = money(expense);
  el.monthIncome.textContent = money(income);
  el.monthBalance.textContent = money(income - expense);
  renderRecords();
}

function renderRecords() {
  const query = state.query;
  const rows = state.records
    .filter((record) => record.date.startsWith(state.month))
    .filter((record) => {
      const haystack = `${record.category} ${record.account} ${record.merchant} ${record.note}`.toLowerCase();
      return !query || haystack.includes(query);
    });
  el.recordCount.textContent = `${rows.length} 笔`;
  el.records.innerHTML = "";
  if (rows.length === 0) {
    el.records.innerHTML = '<div class="empty">这个月份还没有记录。</div>';
    return;
  }
  rows.forEach((record) => {
    const node = el.template.content.firstElementChild.cloneNode(true);
    node.querySelector(".record-icon").textContent = record.category.slice(0, 1);
    node.querySelector(".record-title").textContent = record.merchant || record.category;
    node.querySelector(".record-meta").textContent = [record.date, record.category, record.account, record.source, record.note].filter(Boolean).join(" · ");
    const moneyNode = node.querySelector(".record-money");
    moneyNode.textContent = `${record.type === "expense" ? "-" : "+"}${money(record.amount)}`;
    moneyNode.classList.add(record.type);
    node.querySelector(".delete").addEventListener("click", () => deleteRecord(record.id));
    el.records.appendChild(node);
  });
}

function deleteRecord(id) {
  state.records = state.records.filter((record) => record.id !== id);
  saveRecords();
  renderMonthOptions();
  render();
}

function exportCsv() {
  const rows = state.records.filter((record) => record.date.startsWith(state.month));
  const header = ["类型", "日期", "分类", "金额", "账户", "商家对象", "备注", "来源"];
  const body = rows.map((record) => [
    record.type === "expense" ? "支出" : "收入",
    record.date,
    record.category,
    record.amount,
    record.account,
    record.merchant,
    record.note,
    record.source
  ]);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `智能记账-${state.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearAll() {
  if (state.records.length === 0) return;
  if (!window.confirm("确认清空所有账单记录吗？这只会清空当前手机浏览器里的数据。")) return;
  state.records = [];
  saveRecords();
  renderMonthOptions();
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
  return records.reduce((total, record) => total + Number(record.amount || 0), 0);
}

function money(value) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayInput() {
  return dateInput(new Date());
}

function currentMonth() {
  return todayInput().slice(0, 7);
}

function dateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
