/**
 * Tomasulo Algorithm Simulator — Web Application Controller & Renderer
 * Author: Mennatallah Essam (@mennatallahessam)
 */

import { TomasuloEngine, DEFAULT_LATENCIES } from "./engine.js";
import { SAMPLE_PROGRAMS, DEFAULT_MEMORY_TEXT } from "./presets.js";

class TomasuloWebApp {
  constructor() {
    this.engine = new TomasuloEngine({ registerCount: 9 });
    this.autoTimer = null;
    this.initialized = false;

    this._cacheElements();
    this._bindEvents();
    this._loadPreset("program1.txt");
    this.initializeSimulation();
  }

  _cacheElements() {
    this.elPresetSelect = document.getElementById("preset-select");
    this.elFetchModeSelect = document.getElementById("fetch-mode-select");
    this.elProgramUpload = document.getElementById("program-upload");
    this.elMemoryUpload = document.getElementById("memory-upload");
    this.elProgramEditor = document.getElementById("program-editor");
    this.elMemoryEditor = document.getElementById("memory-editor");

    this.btnInit = document.getElementById("btn-init");
    this.btnStep = document.getElementById("btn-step");
    this.btnPlay = document.getElementById("btn-play");
    this.btnRunAll = document.getElementById("btn-run-all");
    this.btnReset = document.getElementById("btn-reset");
    this.elSpeedRange = document.getElementById("speed-range");

    this.kpiStatus = document.getElementById("kpi-status");
    this.kpiCycle = document.getElementById("kpi-cycle");
    this.kpiCompleted = document.getElementById("kpi-completed");
    this.kpiIpc = document.getElementById("kpi-ipc");
    this.kpiBranchAcc = document.getElementById("kpi-branch-acc");
    this.kpiQueue = document.getElementById("kpi-queue");
    this.kpiPc = document.getElementById("kpi-pc");
    this.elCdbBanner = document.getElementById("cdb-banner");
    this.elLatencyHint = document.getElementById("latency-summary-hint");

    this.elRsBody = document.getElementById("rs-tbody");
    this.elRegGrid = document.getElementById("register-grid");
    this.elUtilBars = document.getElementById("utilization-bars");
    this.elTimingBody = document.getElementById("timing-tbody");
    this.elTimingCanvas = document.getElementById("timing-canvas");
    this.elLogContainer = document.getElementById("event-log");

    this.elMemStart = document.getElementById("mem-start");
    this.elMemEnd = document.getElementById("mem-end");
    this.elMemNonzero = document.getElementById("mem-nonzero");
    this.btnMemInspect = document.getElementById("btn-mem-inspect");
    this.elMemBody = document.getElementById("memory-tbody");

    this.elLatLoad = document.getElementById("lat-load");
    this.elLatStore = document.getElementById("lat-store");
    this.elLatBeq = document.getElementById("lat-beq");
    this.elLatCall = document.getElementById("lat-call");
    this.elLatAdd = document.getElementById("lat-add");
    this.elLatNor = document.getElementById("lat-nor");
    this.elLatMul = document.getElementById("lat-mul");
    this.btnApplyLatencies = document.getElementById("btn-apply-latencies");
    this.btnDefaultLatencies = document.getElementById("btn-default-latencies");
  }

  _bindEvents() {
    this.elPresetSelect.addEventListener("change", (e) => {
      this._loadPreset(e.target.value);
      this.initializeSimulation();
    });

    this.elFetchModeSelect.addEventListener("change", (e) => {
      this.engine.setFetchMode(e.target.value);
      this.initializeSimulation();
    });

    this.elProgramUpload.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.elProgramEditor.value = String(reader.result || "");
        this.initializeSimulation();
      };
      reader.readAsText(file);
    });

    this.elMemoryUpload.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this.elMemoryEditor.value = String(reader.result || "");
        this.initializeSimulation();
      };
      reader.readAsText(file);
    });

    this.btnInit.addEventListener("click", () => this.initializeSimulation());
    this.btnStep.addEventListener("click", () => this.stepOnce());
    this.btnPlay.addEventListener("click", () => this.toggleAutoPlay());
    this.btnRunAll.addEventListener("click", () => this.runAll());
    this.btnReset.addEventListener("click", () => this.resetSimulation());

    this.btnMemInspect.addEventListener("click", () => this.renderMemoryTable());
    this.elMemNonzero.addEventListener("change", () => this.renderMemoryTable());

    this.btnApplyLatencies.addEventListener("click", () => {
      this.engine.setLatencies({
        LOAD: Math.max(1, parseInt(this.elLatLoad.value, 10) || 6),
        STORE: Math.max(1, parseInt(this.elLatStore.value, 10) || 6),
        BEQ: Math.max(1, parseInt(this.elLatBeq.value, 10) || 1),
        CALL_RET: Math.max(1, parseInt(this.elLatCall.value, 10) || 1),
        ADD_SUB: Math.max(1, parseInt(this.elLatAdd.value, 10) || 2),
        NOR: Math.max(1, parseInt(this.elLatNor.value, 10) || 1),
        MUL: Math.max(1, parseInt(this.elLatMul.value, 10) || 10),
      });
      this._updateLatencyHint();
      this.initializeSimulation();
    });

    this.btnDefaultLatencies.addEventListener("click", () => {
      this.elLatLoad.value = String(DEFAULT_LATENCIES.LOAD);
      this.elLatStore.value = String(DEFAULT_LATENCIES.STORE);
      this.elLatBeq.value = String(DEFAULT_LATENCIES.BEQ);
      this.elLatCall.value = String(DEFAULT_LATENCIES.CALL_RET);
      this.elLatAdd.value = String(DEFAULT_LATENCIES.ADD_SUB);
      this.elLatNor.value = String(DEFAULT_LATENCIES.NOR);
      this.elLatMul.value = String(DEFAULT_LATENCIES.MUL);
      this.engine.setLatencies({ ...DEFAULT_LATENCIES });
      this._updateLatencyHint();
      this.initializeSimulation();
    });

    document.querySelectorAll("[data-mem-range]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [start, end] = btn.dataset.memRange.split("-").map(Number);
        this.elMemStart.value = String(start);
        this.elMemEnd.value = String(end);
        this.renderMemoryTable();
      });
    });

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const target = document.getElementById(btn.dataset.tabTarget);
        if (target) target.classList.add("active");
        if (btn.dataset.tabTarget === "panel-timing") {
          this.renderTimingChart();
        }
      });
    });

    window.addEventListener("resize", () => this.renderTimingChart());
  }

  _updateLatencyHint() {
    const L = this.engine.latencies;
    if (this.elLatencyHint) {
      this.elLatencyHint.textContent = `Load: ${L.LOAD}c | Store: ${L.STORE}c | Branch: ${L.BEQ}c | Call/Ret: ${L.CALL_RET}c | Add/Sub: ${L.ADD_SUB}c | NOR: ${L.NOR}c | Multiply: ${L.MUL}c`;
    }
  }

  _loadPreset(presetName) {
    if (SAMPLE_PROGRAMS[presetName]) {
      this.elProgramEditor.value = SAMPLE_PROGRAMS[presetName];
    }
    if (!this.elMemoryEditor.value.trim()) {
      this.elMemoryEditor.value = DEFAULT_MEMORY_TEXT;
    }
  }

  stopAutoPlay() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
      this.btnPlay.textContent = "Auto-step";
      this.btnPlay.classList.remove("playing");
    }
  }

  toggleAutoPlay() {
    if (this.autoTimer) {
      this.stopAutoPlay();
      return;
    }
    if (!this.initialized) {
      this.initializeSimulation();
    }
    if (this.engine.isComplete()) {
      return;
    }

    const intervalMs = Math.max(80, 900 - Number(this.elSpeedRange.value) * 80);
    this.btnPlay.textContent = "Pause";
    this.btnPlay.classList.add("playing");

    this.autoTimer = setInterval(() => {
      if (this.engine.isComplete()) {
        this.stopAutoPlay();
        this.renderAll();
        return;
      }
      this.engine.stepCycle();
      this.renderAll();
      if (this.engine.isComplete()) {
        this.stopAutoPlay();
      }
    }, intervalMs);
  }

  initializeSimulation() {
    this.stopAutoPlay();
    this.engine.setFetchMode(this.elFetchModeSelect.value);
    this.engine.reset();
    this.engine.loadMemoryFromText(this.elMemoryEditor.value);
    this.engine.loadProgramFromText(this.elProgramEditor.value);
    this.initialized = true;
    this._updateLatencyHint();
    this.renderAll();
  }

  stepOnce() {
    if (!this.initialized) {
      this.initializeSimulation();
    }
    this.engine.stepCycle();
    this.renderAll();
  }

  runAll() {
    this.stopAutoPlay();
    if (!this.initialized) {
      this.initializeSimulation();
    }
    this.engine.runToCompletion(1000);
    this.renderAll();
  }

  resetSimulation() {
    this.stopAutoPlay();
    this.engine.reset();
    this.initialized = false;
    this.renderAll();
  }

  renderAll() {
    this.renderKpis();
    this.renderReservationStations();
    this.renderRegisters();
    this.renderUtilization();
    this.renderTimingTable();
    this.renderTimingChart();
    this.renderMemoryTable();
    this.renderEventLog();
  }

  renderKpis() {
    let statusText = "Idle";
    let statusClass = "badge-idle";
    if (this.initialized) {
      if (this.engine.isComplete() && this.engine.totalCycles > 0) {
        statusText = "Completed";
        statusClass = "badge-done";
      } else if (this.engine.totalCycles > 0) {
        statusText = "Running";
        statusClass = "badge-running";
      } else {
        statusText = "Ready";
        statusClass = "badge-ready";
      }
    }

    this.kpiStatus.textContent = statusText;
    this.kpiStatus.className = `status-pill ${statusClass}`;
    this.kpiCycle.textContent = String(this.engine.totalCycles);
    this.kpiCompleted.textContent = String(this.engine.instructionsCompleted);
    this.kpiIpc.textContent = this.engine.calculateIpc().toFixed(2);
    this.kpiBranchAcc.textContent = `${this.engine.branchPredictionAccuracy().toFixed(1)}%`;
    this.kpiQueue.textContent = String(this.engine.remainingQueueCount());
    this.kpiPc.textContent = String(this.engine.pc);

    const cdb = this.engine.cdb.peek();
    if (cdb.occupied) {
      this.elCdbBanner.innerHTML = `<span class="cdb-lamp active"></span><span><strong>Common Data Bus active:</strong> Station <code>${cdb.sourceTag}</code> broadcasting value <code>${cdb.value}</code> to <code>${cdb.destination ?? "waiting stations"}</code></span>`;
      this.elCdbBanner.classList.add("cdb-live");
    } else {
      this.elCdbBanner.innerHTML = `<span class="cdb-lamp"></span><span><strong>Common Data Bus:</strong> Idle — bus free for next completing functional unit</span>`;
      this.elCdbBanner.classList.remove("cdb-live");
    }
  }

  renderReservationStations() {
    const stations = this.engine.allStations();
    this.elRsBody.innerHTML = stations
      .map((s) => {
        let stateLabel = "Free";
        let rowClass = "rs-row-idle";
        if (s.readyToCommit) {
          stateLabel = "Commit ready";
          rowClass = "rs-row-commit";
        } else if (s.pendingBroadcast) {
          stateLabel = "Waiting for CDB";
          rowClass = "rs-row-cdb";
        } else if (s.executing) {
          stateLabel = "Executing";
          rowClass = "rs-row-exec";
        } else if (s.busy) {
          stateLabel = "Waiting on tag";
          rowClass = "rs-row-wait";
        }

        const progressPct = s.busy
          ? Math.round(((s.latency - s.remainingCycles) / s.latency) * 100)
          : 0;

        return `<tr class="${rowClass}">
          <td class="mono fw-bold">${s.name}</td>
          <td><span class="unit-chip">${s.category}</span></td>
          <td><span class="state-chip">${stateLabel}</span></td>
          <td class="mono">${s.busy && s.opcode ? s.opcode : "—"}</td>
          <td class="mono">${s.vj !== null && s.vj !== undefined ? s.vj : ""}</td>
          <td class="mono">${s.vk !== null && s.vk !== undefined ? s.vk : ""}</td>
          <td class="mono tag-cell">${s.qj ?? ""}</td>
          <td class="mono tag-cell">${s.qk ?? ""}</td>
          <td class="mono">
            ${
              s.busy
                ? `<div class="cycle-cell"><span>${s.remainingCycles}/${s.latency}</span><div class="mini-bar"><div class="mini-fill" style="width:${progressPct}%"></div></div></div>`
                : "—"
            }
          </td>
        </tr>`;
      })
      .join("");
  }

  renderRegisters() {
    const regs = this.engine.registers.snapshot();
    this.elRegGrid.innerHTML = regs
      .map((r) => {
        const hex = `0x${(r.value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
        const cls = r.busy ? "reg-card reg-busy" : "reg-card";
        return `<div class="${cls}">
          <div class="reg-header">
            <span class="reg-name">${r.name}</span>
            <span class="reg-state">${r.busy ? `Qi: ${r.tag}` : "Ready"}</span>
          </div>
          <div class="reg-val">${r.value}</div>
          <div class="reg-hex">${hex}</div>
        </div>`;
      })
      .join("");
  }

  renderUtilization() {
    const groups = this.engine.groupUtilization();
    this.elUtilBars.innerHTML = groups
      .map(
        (g) => `<div class="util-row">
          <div class="util-meta">
            <span>${g.label}</span>
            <span class="mono">${g.busy}/${g.total} (${g.percentage.toFixed(0)}%)</span>
          </div>
          <div class="util-track">
            <div class="util-fill" style="width: ${g.percentage}%"></div>
          </div>
        </div>`
      )
      .join("");
  }

  renderTimingTable() {
    const records = this.engine.timingRecords;
    if (records.length === 0) {
      this.elTimingBody.innerHTML = `<tr><td colspan="6" class="empty-cell">No instructions have been issued yet. Use <strong>Step one cycle</strong> or <strong>Run to completion</strong> to begin.</td></tr>`;
      return;
    }

    this.elTimingBody.innerHTML = records
      .map(
        (r, i) => `<tr>
          <td class="mono">${i + 1}</td>
          <td class="mono fw-bold">${r.instruction}</td>
          <td class="mono">${r.station}</td>
          <td class="mono badge-issue">${r.issue ?? "—"}</td>
          <td class="mono badge-exec">${
            r.executeStart !== null
              ? `${r.executeStart} to ${r.executeComplete ?? "..."}`
              : "—"
          }</td>
          <td class="mono badge-wb">${r.writeback ?? "—"}</td>
        </tr>`
      )
      .join("");
  }

  renderTimingChart() {
    const canvas = this.elTimingCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const records = this.engine.timingRecords;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement.clientWidth || 720;
    const rowHeight = 30;
    const headerHeight = 38;
    const footerHeight = 26;
    const height = Math.max(250, headerHeight + records.length * rowHeight + footerHeight);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#fcfaf5";
    ctx.fillRect(0, 0, width, height);

    if (records.length === 0) {
      ctx.fillStyle = "#525866";
      ctx.font = "13px 'IBM Plex Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "Step or run the simulation to plot the cycle-by-cycle instruction timing diagram.",
        width / 2,
        height / 2
      );
      return;
    }

    const leftPad = 210;
    const rightPad = 24;
    const maxCycle = Math.max(this.engine.totalCycles + 1, 10);
    const plotWidth = Math.max(100, width - leftPad - rightPad);
    const xForCycle = (c) => leftPad + (c / maxCycle) * plotWidth;

    ctx.strokeStyle = "#ded9ce";
    ctx.lineWidth = 1;
    ctx.font = "11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#525866";
    ctx.textAlign = "center";

    const step = maxCycle > 30 ? Math.ceil(maxCycle / 15) : 1;
    for (let c = 1; c <= maxCycle; c += step) {
      const x = xForCycle(c);
      ctx.beginPath();
      ctx.moveTo(x, headerHeight - 8);
      ctx.lineTo(x, height - footerHeight);
      ctx.stroke();
      ctx.fillText(String(c), x, headerHeight - 12);
    }

    records.forEach((rec, idx) => {
      const yCenter = headerHeight + idx * rowHeight + rowHeight / 2;

      if (idx % 2 === 1) {
        ctx.fillStyle = "#f2eee6";
        ctx.fillRect(0, headerHeight + idx * rowHeight, width, rowHeight);
      }

      ctx.fillStyle = "#16181d";
      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${idx + 1}. ${rec.instruction}`, 10, yCenter + 4);

      if (rec.executeStart !== null) {
        const endC = rec.executeComplete ?? this.engine.totalCycles;
        const x1 = xForCycle(rec.executeStart);
        const x2 = Math.max(x1 + 6, xForCycle(endC));
        ctx.fillStyle = "#b84a0e";
        ctx.fillRect(x1 - 3, yCenter - 4, x2 - x1 + 6, 8);
      }

      if (rec.issue !== null) {
        const xi = xForCycle(rec.issue);
        ctx.fillStyle = "#0f4c81";
        ctx.beginPath();
        ctx.arc(xi, yCenter, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (rec.writeback !== null) {
        const xw = xForCycle(rec.writeback);
        ctx.fillStyle = "#17643e";
        ctx.beginPath();
        ctx.moveTo(xw, yCenter - 6);
        ctx.lineTo(xw + 6, yCenter);
        ctx.lineTo(xw, yCenter + 6);
        ctx.lineTo(xw - 6, yCenter);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  renderMemoryTable() {
    let start = parseInt(this.elMemStart.value, 10);
    let end = parseInt(this.elMemEnd.value, 10);
    if (Number.isNaN(start) || start < 0) start = 0;
    if (Number.isNaN(end) || end < start) end = start + 32;
    end = Math.min(end, this.engine.memory.capacity - 1);

    const nonzeroOnly = this.elMemNonzero.checked;
    const rows = [];

    for (let addr = start; addr <= end; addr++) {
      const val = this.engine.memory.read(addr);
      if (nonzeroOnly && val === 0) continue;
      const masked = val & 0xffff;
      const hex = `0x${masked.toString(16).toUpperCase().padStart(4, "0")}`;
      const bin = masked.toString(2).padStart(16, "0");
      const ascii = val >= 32 && val <= 126 ? String.fromCharCode(val) : "·";
      rows.push(`<tr class="${val !== 0 ? "mem-nonzero" : ""}">
        <td class="mono">${addr}</td>
        <td class="mono fw-bold">${val}</td>
        <td class="mono">${hex}</td>
        <td class="mono">${bin}</td>
        <td class="mono">${ascii}</td>
      </tr>`);
    }

    this.elMemBody.innerHTML =
      rows.length > 0
        ? rows.join("")
        : `<tr><td colspan="5" class="empty-cell">No matching words in range ${start} to ${end}.</td></tr>`;
  }

  renderEventLog() {
    const events = this.engine.eventLog.slice(-120);
    this.elLogContainer.innerHTML = events
      .map(
        (ev) => `<div class="log-entry log-${ev.stage.toLowerCase()}">
          <span class="log-cycle">C${String(ev.cycle).padStart(2, "0")}</span>
          <span class="log-stage">${ev.stage}</span>
          <span class="log-msg">${ev.message}</span>
        </div>`
      )
      .join("");
    this.elLogContainer.scrollTop = this.elLogContainer.scrollHeight;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  window.tomasuloApp = new TomasuloWebApp();
});
