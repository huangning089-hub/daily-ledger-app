const STORAGE_KEY = "pregnancy-water-reminder-v1";
const todayKey = () => new Date().toISOString().slice(0, 10);

const state = {
  targetMl: 2400,
  cupSize: 250,
  startTime: "08:00",
  endTime: "21:30",
  intervalMinutes: 90,
  logs: {},
  notifyEnabled: false,
  ...loadState()
};

const el = {
  ring: document.querySelector("#progressRing"),
  percent: document.querySelector("#progressPercent"),
  text: document.querySelector("#progressText"),
  drinkDefault: document.querySelector("#drinkDefault"),
  minusWater: document.querySelector("#minusWater"),
  plusWater: document.querySelector("#plusWater"),
  undoDrink: document.querySelector("#undoDrink"),
  cupSize: document.querySelector("#cupSize"),
  targetMl: document.querySelector("#targetMl"),
  targetHint: document.querySelector("#targetHint"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  intervalMinutes: document.querySelector("#intervalMinutes"),
  nextReminder: document.querySelector("#nextReminder"),
  enableNotify: document.querySelector("#enableNotify"),
  downloadCalendar: document.querySelector("#downloadCalendar"),
  resetToday: document.querySelector("#resetToday"),
  history: document.querySelector("#history")
};

let reminderTimer = null;

init();

function init() {
  el.targetMl.value = state.targetMl;
  el.cupSize.value = state.cupSize;
  el.startTime.value = state.startTime;
  el.endTime.value = state.endTime;
  el.intervalMinutes.value = state.intervalMinutes;

  el.drinkDefault.addEventListener("click", () => addWater(state.cupSize));
  el.minusWater.addEventListener("click", () => addWater(-state.cupSize));
  el.plusWater.addEventListener("click", () => addWater(state.cupSize));
  el.undoDrink.addEventListener("click", undoWater);
  el.cupSize.addEventListener("change", updateSettings);
  el.targetMl.addEventListener("change", updateSettings);
  el.startTime.addEventListener("change", updateSettings);
  el.endTime.addEventListener("change", updateSettings);
  el.intervalMinutes.addEventListener("change", updateSettings);
  el.enableNotify.addEventListener("click", enableNotifications);
  el.downloadCalendar.addEventListener("click", downloadCalendar);
  el.resetToday.addEventListener("click", resetToday);
  document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", () => {
      state.targetMl = Number(button.dataset.target);
      el.targetMl.value = state.targetMl;
      persist();
      render();
    });
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }

  scheduleReminder();
  render();
}

function updateSettings() {
  state.targetMl = clamp(Number(el.targetMl.value) || 2400, 1000, 4000);
  state.cupSize = clamp(Number(el.cupSize.value) || 250, 50, 1000);
  state.startTime = el.startTime.value || "08:00";
  state.endTime = el.endTime.value || "21:30";
  state.intervalMinutes = clamp(Number(el.intervalMinutes.value) || 90, 30, 240);
  el.targetMl.value = state.targetMl;
  el.cupSize.value = state.cupSize;
  el.intervalMinutes.value = state.intervalMinutes;
  persist();
  scheduleReminder();
  render();
}

function addWater(amount) {
  const today = todayKey();
  if (!state.logs[today]) state.logs[today] = [];
  state.logs[today].push({
    id: String(Date.now()),
    amount,
    time: new Date().toTimeString().slice(0, 5)
  });
  persist();
  render();
}

function undoWater() {
  const today = todayKey();
  if (!state.logs[today] || state.logs[today].length === 0) return;
  state.logs[today].pop();
  persist();
  render();
}

function resetToday() {
  const today = todayKey();
  if (!state.logs[today] || state.logs[today].length === 0) return;
  if (!window.confirm("确认清空今天的喝水记录吗？")) return;
  state.logs[today] = [];
  persist();
  render();
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    alert("这个浏览器不支持页面提醒，可以使用“下载日历提醒”。");
    return;
  }
  const permission = await Notification.requestPermission();
  state.notifyEnabled = permission === "granted";
  persist();
  scheduleReminder();
  render();
  if (state.notifyEnabled) {
    showReminder("页面提醒已开启", "保持小程序在后台，或下载日历提醒获得更稳定提醒。");
  }
}

function scheduleReminder() {
  if (reminderTimer) clearTimeout(reminderTimer);
  const next = nextReminderDate();
  el.nextReminder.textContent = next ? `下次 ${timeLabel(next)}` : "今日已结束";
  if (!state.notifyEnabled || !next) return;
  const delay = Math.max(1000, next.getTime() - Date.now());
  reminderTimer = setTimeout(() => {
    const current = currentMl();
    if (current < state.targetMl) {
      showReminder("喝水时间到了", `今天已喝 ${current} ml，目标 ${state.targetMl} ml。`);
    }
    scheduleReminder();
  }, delay);
}

function showReminder(title, body) {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ title, body });
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "./icons/icon-192.png" });
  }
  if ("vibrate" in navigator) navigator.vibrate([120, 80, 120]);
}

function downloadCalendar() {
  const times = reminderTimes();
  const startDate = todayKey().replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const events = times.map((time, index) => {
    const compact = time.replace(":", "");
    return [
      "BEGIN:VEVENT",
      `UID:pregnancy-water-${compact}-${index}@codex-local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${startDate}T${compact}00`,
      "DURATION:PT5M",
      "RRULE:FREQ=DAILY;COUNT=180",
      "SUMMARY:喝水提醒",
      `DESCRIPTION:孕期少量多次喝水。建议这次喝 ${state.cupSize} ml，全天目标 ${state.targetMl} ml。`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "DESCRIPTION:喝水提醒",
      "TRIGGER:PT0M",
      "END:VALARM",
      "END:VEVENT"
    ].join("\r\n");
  }).join("\r\n");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//Codex//Pregnancy Water Reminder//CN",
    events,
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "孕期喝水提醒.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function render() {
  const target = state.targetMl;
  const current = currentMl();
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  el.percent.textContent = `${percent}%`;
  el.text.textContent = `${current} / ${target} ml`;
  el.targetHint.textContent = `约 ${Math.ceil(target / state.cupSize)} 杯`;
  drawRing(percent);
  renderHistory();
  scheduleReminderLabelOnly();
}

function scheduleReminderLabelOnly() {
  const next = nextReminderDate();
  el.nextReminder.textContent = next ? `下次 ${timeLabel(next)}` : "今日已结束";
}

function renderHistory() {
  const rows = (state.logs[todayKey()] || []).slice().reverse();
  if (rows.length === 0) {
    el.history.innerHTML = '<div class="empty">今天还没有记录，喝完一杯就点“喝一杯”。</div>';
    return;
  }
  el.history.innerHTML = rows.map((row) => `
    <div class="history-row">
      <div class="history-icon">水</div>
      <div>
        <strong>${row.amount > 0 ? "喝水" : "撤回"} ${Math.abs(row.amount)} ml</strong>
        <span>${row.time}</span>
      </div>
      <em>${currentMlUntil(row.id)} ml</em>
    </div>
  `).join("");
}

function drawRing(percent) {
  const canvas = el.ring;
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const center = size / 2;
  const radius = 102;
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#dff4ee";
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.stroke();
  const gradient = ctx.createLinearGradient(40, 40, 220, 220);
  gradient.addColorStop(0, "#2f8f83");
  gradient.addColorStop(1, "#2f6fcb");
  ctx.strokeStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (percent / 100));
  ctx.stroke();
}

function reminderTimes() {
  const start = minutesOfDay(state.startTime);
  const end = minutesOfDay(state.endTime);
  if (end <= start) return [];
  const times = [];
  for (let minute = start; minute <= end; minute += state.intervalMinutes) {
    times.push(toClock(minute));
  }
  return times;
}

function nextReminderDate() {
  const now = new Date();
  for (const time of reminderTimes()) {
    const [hour, minute] = time.split(":").map(Number);
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next > now) return next;
  }
  return null;
}

function currentMl() {
  return (state.logs[todayKey()] || []).reduce((sum, row) => Math.max(0, sum + row.amount), 0);
}

function currentMlUntil(id) {
  let total = 0;
  const rows = state.logs[todayKey()] || [];
  for (const row of rows) {
    total = Math.max(0, total + row.amount);
    if (row.id === id) return total;
  }
  return total;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function minutesOfDay(clock) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour * 60 + minute;
}

function toClock(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function timeLabel(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
