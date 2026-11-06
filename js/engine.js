/**
 * Tomasulo Algorithm Simulator — Core Simulation Engine
 * Supports both Sequential Queue Issue Mode and Dynamic PC Control-Flow Mode,
 * plus configurable functional-unit latencies.
 *
 * Author: Mennatallah Essam (@mennatallahessam)
 */

import { OPCODES, InstructionNode, parseProgramText, parseMemoryText } from "./isa.js";
import {
  WordMemory,
  RegisterRenameFile,
  CommonDataBus,
  ReservationStation,
} from "./hardware.js";

export const DEFAULT_LATENCIES = Object.freeze({
  LOAD: 6,
  STORE: 6,
  BEQ: 1,
  CALL_RET: 1,
  ADD_SUB: 2,
  NOR: 1,
  MUL: 10,
});

export class TomasuloEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.registerCount=9] Number of registers (r0..r8)
   * @param {number} [options.memorySize=65536] Number of memory words
   * @param {"queue"|"control_flow"} [options.fetchMode="queue"] Instruction fetch/issue mode
   * @param {object} [options.latencies] Custom latencies per functional group
   */
  constructor({
    registerCount = 9,
    memorySize = 65536,
    fetchMode = "queue",
    latencies = {},
  } = {}) {
    this.registerCount = registerCount;
    this.memorySize = memorySize;
    this.fetchMode = fetchMode;
    this.latencies = { ...DEFAULT_LATENCIES, ...latencies };

    this.memory = new WordMemory(memorySize);
    this.registers = new RegisterRenameFile(registerCount);
    this.cdb = new CommonDataBus();

    this.instructionQueue = [];
    this.programSource = [];
    this.timingRecords = [];
    this.timingByInstId = new Map();
    this.eventLog = [];

    this.totalCycles = 0;
    this.pc = 0;
    this.dynamicInstCounter = 0;
    this.controlHazardStall = false;
    this.halted = false;
    this.instructionsCompleted = 0;
    this.branchesEncountered = 0;
    this.branchMispredictions = 0;

    this._initReservationStations();
  }

  setLatencies(newLatencies = {}) {
    this.latencies = { ...this.latencies, ...newLatencies };
    this._initReservationStations();
  }

  setFetchMode(mode) {
    this.fetchMode = mode === "control_flow" ? "control_flow" : "queue";
  }

  _initReservationStations() {
    const L = this.latencies;
    this.groups = {
      LRS: [
        new ReservationStation("LRS1", "Load", L.LOAD),
        new ReservationStation("LRS2", "Load", L.LOAD),
      ],
      SRS: [
        new ReservationStation("SRS1", "Store", L.STORE),
        new ReservationStation("SRS2", "Store", L.STORE),
      ],
      BEQ: [
        new ReservationStation("BEQ1", "Branch", L.BEQ),
        new ReservationStation("BEQ2", "Branch", L.BEQ),
      ],
      CALL_RET: [new ReservationStation("CALL_RET1", "Call/Return", L.CALL_RET)],
      ADD_SUB: [
        new ReservationStation("ADD_SUB1", "ALU", L.ADD_SUB),
        new ReservationStation("ADD_SUB2", "ALU", L.ADD_SUB),
      ],
      NOR: [new ReservationStation("NOR1", "ALU", L.NOR)],
      MUL: [new ReservationStation("MUL1", "ALU", L.MUL)],
    };
  }

  allStations() {
    return [
      ...this.groups.LRS,
      ...this.groups.SRS,
      ...this.groups.BEQ,
      ...this.groups.CALL_RET,
      ...this.groups.ADD_SUB,
      ...this.groups.NOR,
      ...this.groups.MUL,
    ];
  }

  _stationPoolFor(instruction) {
    switch (instruction.opcode) {
      case OPCODES.LOAD:
        return this.groups.LRS;
      case OPCODES.STORE:
        return this.groups.SRS;
      case OPCODES.BEQ:
        return this.groups.BEQ;
      case OPCODES.CALL:
      case OPCODES.RET:
        return this.groups.CALL_RET;
      case OPCODES.ADD:
      case OPCODES.SUB:
        return this.groups.ADD_SUB;
      case OPCODES.NOR:
        return this.groups.NOR;
      case OPCODES.MUL:
        return this.groups.MUL;
      default:
        return [];
    }
  }

  reset() {
    this.memory.reset();
    this.registers.reset();
    this.cdb.reset();
    this.instructionQueue = [];
    this.programSource = [];
    this.timingRecords = [];
    this.timingByInstId.clear();
    this.eventLog = [];
    this.totalCycles = 0;
    this.pc = 0;
    this.dynamicInstCounter = 0;
    this.controlHazardStall = false;
    this.halted = false;
    this.instructionsCompleted = 0;
    this.branchesEncountered = 0;
    this.branchMispredictions = 0;
    this._initReservationStations();
  }

  loadProgramFromText(sourceText) {
    const parsed = parseProgramText(sourceText);
    this.programSource = parsed;
    this.instructionQueue = [...parsed];
    this.pc = 0;
    this.dynamicInstCounter = 0;
    this.controlHazardStall = false;
    this.halted = parsed.length === 0;
    this.logEvent(
      0,
      "SYSTEM",
      `Loaded ${parsed.length} instruction(s) [${
        this.fetchMode === "control_flow" ? "PC Control-Flow Mode" : "Queue Mode"
      }].`
    );
    return parsed.length;
  }

  loadMemoryFromText(memoryText) {
    const entries = parseMemoryText(memoryText);
    for (const { address, value } of entries) {
      if (address >= 0 && address < this.memory.capacity) {
        this.memory.write(address, value);
      }
    }
    this.logEvent(0, "MEMORY", `Initialized ${entries.length} memory word(s).`);
    return entries.length;
  }

  logEvent(cycle, stage, message) {
    this.eventLog.push({ cycle, stage, message });
  }

  issueStage() {
    if (this.fetchMode === "control_flow") {
      return this._issueControlFlow();
    }
    return this._issueQueue();
  }

  _issueQueue() {
    if (this.instructionQueue.length === 0) {
      return false;
    }

    const nextInst = this.instructionQueue[0];
    const pool = this._stationPoolFor(nextInst);
    if (!pool || pool.length === 0) {
      return false;
    }

    for (const station of pool) {
      if (station.isFree()) {
        this.instructionQueue.shift();
        station.issue(nextInst, this.registers);

        const record = {
          id: nextInst.id,
          pcIndex: nextInst.id,
          instruction: nextInst.format(),
          opcode: nextInst.opcode,
          station: station.name,
          issue: this.totalCycles,
          executeStart: null,
          executeComplete: null,
          writeback: null,
        };
        this.timingRecords.push(record);
        this.timingByInstId.set(nextInst.id, record);

        this.logEvent(
          this.totalCycles,
          "ISSUE",
          `Issued [${nextInst.format()}] → ${station.name}`
        );
        return true;
      }
    }

    return false;
  }

  _issueControlFlow() {
    if (this.halted || this.controlHazardStall) {
      return false;
    }
    if (this.pc < 0 || this.pc >= this.programSource.length) {
      this.halted = true;
      return false;
    }

    const template = this.programSource[this.pc];
    const dynId = ++this.dynamicInstCounter;
    const dynInst = new InstructionNode({
      id: dynId,
      opcode: template.opcode,
      dest: template.dest,
      src1: template.src1,
      src2: template.src2,
      offset: template.offset,
      label: template.label,
      immediate: template.immediate,
      rawText: template.rawText,
      lineNumber: template.lineNumber,
    });
    dynInst.issuedPc = this.pc;

    const pool = this._stationPoolFor(dynInst);
    if (!pool || pool.length === 0) {
      return false;
    }

    for (const station of pool) {
      if (station.isFree()) {
        station.issue(dynInst, this.registers);

        const record = {
          id: dynInst.id,
          pcIndex: this.pc,
          instruction: dynInst.format(),
          opcode: dynInst.opcode,
          station: station.name,
          issue: this.totalCycles,
          executeStart: null,
          executeComplete: null,
          writeback: null,
        };
        this.timingRecords.push(record);
        this.timingByInstId.set(dynInst.id, record);

        this.logEvent(
          this.totalCycles,
          "ISSUE",
          `PC=${this.pc}: Issued [${dynInst.format()}] → ${station.name}`
        );

        if (
          [OPCODES.BEQ, OPCODES.CALL, OPCODES.RET].includes(dynInst.opcode)
        ) {
          this.controlHazardStall = true;
        } else {
          this.pc += 1;
        }
        return true;
      }
    }

    return false;
  }

  executeStage() {
    for (const station of this.allStations()) {
      const inst = station.instruction;
      const basePc =
        this.fetchMode === "control_flow" && inst && inst.issuedPc !== undefined
          ? inst.issuedPc
          : this.pc;

      const { newPc, event } = station.tickExecute(
        this.registers,
        this.memory,
        basePc,
        this.cdb
      );

      if (inst && this.timingByInstId.has(inst.id)) {
        const rec = this.timingByInstId.get(inst.id);
        if (event === "started" || event === "started_and_completed") {
          if (rec.executeStart === null) {
            rec.executeStart = this.totalCycles;
          }
          this.logEvent(
            this.totalCycles,
            "EXEC",
            `${station.name} started executing [${inst.format()}]`
          );
        }
        if (event === "completed" || event === "started_and_completed") {
          rec.executeComplete = this.totalCycles;
          this.logEvent(
            this.totalCycles,
            "EXEC",
            `${station.name} completed [${inst.format()}]${
              station.result !== null ? ` (result = ${station.result})` : ""
            }`
          );
        }
        if (event === "broadcast") {
          this.logEvent(
            this.totalCycles,
            "CDB",
            `${station.name} broadcast deferred result ${station.result} on CDB`
          );
        }
      }

      if (event === "completed" || event === "started_and_completed") {
        if (station.opcode === OPCODES.BEQ) {
          this.branchesEncountered += 1;
          if (newPc !== basePc + 1) {
            this.branchMispredictions += 1;
          }
        }

        if (this.fetchMode === "control_flow") {
          if (
            [OPCODES.BEQ, OPCODES.CALL, OPCODES.RET].includes(station.opcode)
          ) {
            if (
              station.opcode === OPCODES.RET &&
              (newPc === 0 || newPc < 0 || newPc >= this.programSource.length)
            ) {
              this.halted = true;
              this.controlHazardStall = false;
              this.pc = newPc;
            } else {
              this.pc = newPc;
              this.controlHazardStall = false;
            }
          }
        } else if (newPc !== null && newPc !== undefined && newPc !== this.pc) {
          this.pc = newPc;
        }
      }
    }
  }

  writebackStage() {
    // 1. Waiting reservation stations snoop the active CDB broadcast
    if (this.cdb.occupied) {
      for (const station of this.allStations()) {
        if (station.snoop(this.cdb)) {
          this.logEvent(
            this.totalCycles,
            "CDB",
            `${station.name} captured operand ${this.cdb.value} from ${this.cdb.sourceTag}`
          );
        }
      }
    }

    // 2. Clear the CDB for the upcoming execution phase
    this.cdb.reset();

    // 3. Commit at most one ready station per cycle
    for (const station of this.allStations()) {
      if (station.canCommit()) {
        const inst = station.instruction;
        if (inst && this.timingByInstId.has(inst.id)) {
          this.timingByInstId.get(inst.id).writeback = this.totalCycles;
        }
        this.logEvent(
          this.totalCycles,
          "WRITEBACK",
          `${station.name} committed [${inst ? inst.format() : station.opcode}]${
            station.dest ? ` → ${station.dest} = ${station.result}` : ""
          }`
        );
        station.commit(this.registers);
        this.instructionsCompleted += 1;
        break;
      }
    }
  }

  stepCycle() {
    if (this.isComplete()) {
      return false;
    }
    this.totalCycles += 1;
    this.writebackStage();
    this.executeStage();
    this.issueStage();
    return true;
  }

  runToCompletion(maxCycles = 1000) {
    while (!this.isComplete() && this.totalCycles < maxCycles) {
      this.stepCycle();
    }
    return this.totalCycles;
  }

  remainingQueueCount() {
    if (this.fetchMode === "control_flow") {
      if (this.halted) return 0;
      return Math.max(0, this.programSource.length - this.pc);
    }
    return this.instructionQueue.length;
  }

  isComplete() {
    const allIdle = this.allStations().every((s) => !s.busy);
    if (this.fetchMode === "control_flow") {
      const fetchDone =
        this.halted ||
        (!this.controlHazardStall &&
          (this.pc < 0 || this.pc >= this.programSource.length));
      return fetchDone && allIdle;
    }
    const queueEmpty = this.instructionQueue.length === 0;
    return queueEmpty && allIdle;
  }

  calculateIpc() {
    if (this.totalCycles === 0) return 0.0;
    return this.instructionsCompleted / this.totalCycles;
  }

  branchPredictionAccuracy() {
    if (this.branchesEncountered === 0) return 100.0;
    return (
      ((this.branchesEncountered - this.branchMispredictions) /
        this.branchesEncountered) *
      100.0
    );
  }

  groupUtilization() {
    const mapping = [
      { label: "Load", list: this.groups.LRS },
      { label: "Store", list: this.groups.SRS },
      { label: "Branch", list: this.groups.BEQ },
      { label: "Call/Ret", list: this.groups.CALL_RET },
      { label: "ADD/SUB", list: this.groups.ADD_SUB },
      { label: "MUL", list: this.groups.MUL },
      { label: "NOR", list: this.groups.NOR },
    ];
    return mapping.map(({ label, list }) => {
      const busyCount = list.filter((s) => s.busy).length;
      const pct = list.length > 0 ? (busyCount / list.length) * 100 : 0;
      return { label, busy: busyCount, total: list.length, percentage: pct };
    });
  }
}
