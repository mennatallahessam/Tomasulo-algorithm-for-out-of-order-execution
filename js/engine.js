/**
 * Tomasulo Algorithm Simulator — Core Simulation Engine
 * Author: Mennatallah Essam (@mennatallahessam)
 */

import { OPCODES, parseProgramText, parseMemoryText } from "./isa.js";
import {
  WordMemory,
  RegisterRenameFile,
  CommonDataBus,
  ReservationStation,
} from "./hardware.js";

export class TomasuloEngine {
  /**
   * @param {object} [options]
   * @param {number} [options.registerCount=9] Number of registers (r0..r8)
   * @param {number} [options.memorySize=65536] Number of memory words
   */
  constructor({ registerCount = 9, memorySize = 65536 } = {}) {
    this.registerCount = registerCount;
    this.memorySize = memorySize;

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
    this.instructionsCompleted = 0;
    this.branchesEncountered = 0;
    this.branchMispredictions = 0;

    this._initReservationStations();
  }

  _initReservationStations() {
    this.groups = {
      LRS: [
        new ReservationStation("LRS1", "Load", 6),
        new ReservationStation("LRS2", "Load", 6),
      ],
      SRS: [
        new ReservationStation("SRS1", "Store", 6),
        new ReservationStation("SRS2", "Store", 6),
      ],
      BEQ: [
        new ReservationStation("BEQ1", "Branch", 1),
        new ReservationStation("BEQ2", "Branch", 1),
      ],
      CALL_RET: [new ReservationStation("CALL_RET1", "Call/Return", 1)],
      ADD_SUB: [
        new ReservationStation("ADD_SUB1", "ALU", 2),
        new ReservationStation("ADD_SUB2", "ALU", 2),
      ],
      NOR: [new ReservationStation("NOR1", "ALU", 1)],
      MUL: [new ReservationStation("MUL1", "ALU", 10)],
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
    this.instructionsCompleted = 0;
    this.branchesEncountered = 0;
    this.branchMispredictions = 0;
    for (const station of this.allStations()) {
      station.clear();
    }
  }

  loadProgramFromText(sourceText) {
    const parsed = parseProgramText(sourceText);
    this.programSource = parsed;
    this.instructionQueue = [...parsed];
    this.logEvent(0, "SYSTEM", `Loaded ${parsed.length} instruction(s) into queue.`);
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

  executeStage() {
    for (const station of this.allStations()) {
      const prevPc = this.pc;
      const inst = station.instruction;
      const { newPc, event } = station.tickExecute(
        this.registers,
        this.memory,
        this.pc,
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

      if (newPc !== null && newPc !== undefined && newPc !== this.pc) {
        if (station.opcode === OPCODES.BEQ) {
          this.branchesEncountered += 1;
          if (newPc !== prevPc + 1) {
            this.branchMispredictions += 1;
          }
        }
        this.pc = newPc;
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

  isComplete() {
    const queueEmpty = this.instructionQueue.length === 0;
    const allIdle = this.allStations().every((s) => !s.busy);
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
