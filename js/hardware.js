/**
 * Tomasulo Algorithm Simulator — Hardware Components
 * Word Memory, Register File with Rename Table, Common Data Bus, and Reservation Stations
 * Author: Mennatallah Essam (@mennatallahessam)
 */

import { OPCODES } from "./isa.js";

export class WordMemory {
  constructor(capacity = 65536) {
    this.capacity = capacity;
    this.words = new Int32Array(capacity);
  }

  read(address) {
    const idx = Math.trunc(address);
    if (idx < 0 || idx >= this.capacity) {
      throw new RangeError(`Memory read out of range: ${idx}`);
    }
    return this.words[idx];
  }

  write(address, value) {
    const idx = Math.trunc(address);
    if (idx < 0 || idx >= this.capacity) {
      throw new RangeError(`Memory write out of range: ${idx}`);
    }
    this.words[idx] = Math.trunc(value);
  }

  reset() {
    this.words.fill(0);
  }
}

export class RegisterRenameFile {
  /**
   * @param {number} count Number of architectural registers (default 9: r0..r8 so all sample programs work)
   */
  constructor(count = 9) {
    this.count = count;
    this.entries = new Map();
    this.reset();
  }

  reset() {
    this.entries.clear();
    for (let i = 0; i < this.count; i++) {
      this.entries.set(`r${i}`, {
        name: `r${i}`,
        value: 0,
        busy: false,
        tag: null,
      });
    }
  }

  _ensureRegister(regName) {
    const key = regName.toLowerCase();
    if (!this.entries.has(key)) {
      this.entries.set(key, {
        name: key,
        value: 0,
        busy: false,
        tag: null,
      });
    }
    return this.entries.get(key);
  }

  read(regName) {
    const key = regName.toLowerCase();
    if (key === "r0") return 0;
    return this._ensureRegister(key).value;
  }

  write(regName, value, sourceTag = null) {
    const key = regName.toLowerCase();
    if (key === "r0") return;
    const entry = this._ensureRegister(key);
    if (sourceTag !== null) {
      // Only update architectural register if it is still awaiting this producer tag (WAW protection)
      if (entry.busy && entry.tag === sourceTag) {
        entry.value = Math.trunc(value);
        entry.busy = false;
        entry.tag = null;
      }
      return;
    }
    entry.value = Math.trunc(value);
    entry.busy = false;
    entry.tag = null;
  }

  claim(regName, stationTag) {
    const key = regName.toLowerCase();
    if (key === "r0") return;
    const entry = this._ensureRegister(key);
    entry.busy = true;
    entry.tag = stationTag;
  }

  release(regName) {
    const key = regName.toLowerCase();
    if (key === "r0") return;
    const entry = this._ensureRegister(key);
    entry.busy = false;
    entry.tag = null;
  }

  isReserved(regName) {
    const key = regName.toLowerCase();
    if (key === "r0") return false;
    return this._ensureRegister(key).busy;
  }

  getTag(regName) {
    const key = regName.toLowerCase();
    if (key === "r0") return null;
    return this._ensureRegister(key).tag;
  }

  snapshot() {
    return Array.from(this.entries.values()).map((r) => ({ ...r }));
  }
}

export class CommonDataBus {
  constructor() {
    this.reset();
  }

  reset() {
    this.occupied = false;
    this.value = null;
    this.sourceTag = null;
    this.destination = null;
  }

  broadcast(value, sourceTag, destination) {
    if (this.occupied) {
      return false;
    }
    this.occupied = true;
    this.value = value;
    this.sourceTag = sourceTag;
    this.destination = destination;
    return true;
  }

  peek() {
    return {
      occupied: this.occupied,
      value: this.value,
      sourceTag: this.sourceTag,
      destination: this.destination,
    };
  }
}

export class ReservationStation {
  /**
   * @param {string} name Station identifier (e.g. "LRS1", "ADD_SUB1")
   * @param {string} category Functional unit group ("Load", "Store", "Branch", "Call/Return", "ALU")
   * @param {number} latency Execution latency in clock cycles
   */
  constructor(name, category, latency) {
    this.name = name;
    this.category = category;
    this.latency = latency;
    this.clear();
  }

  clear() {
    this.busy = false;
    this.opcode = null;
    this.dest = null;
    this.vj = null;
    this.vk = null;
    this.qj = null;
    this.qk = null;
    this.offset = null;
    this.label = null;
    this.remainingCycles = 0;
    this.result = null;
    this.instruction = null;
    this.executing = false;
    this.pendingBroadcast = false;
    this.readyToCommit = false;
  }

  isFree() {
    return !this.busy;
  }

  _resolveOperand(regName, regFile) {
    if (!regName || regName.toLowerCase() === "r0") {
      return { value: 0, tag: null };
    }
    if (regFile.isReserved(regName)) {
      return { value: null, tag: regFile.getTag(regName) };
    }
    return { value: regFile.read(regName), tag: null };
  }

  issue(instruction, regFile) {
    this.busy = true;
    this.opcode = instruction.opcode;
    this.instruction = instruction;
    this.remainingCycles = this.latency;
    this.executing = false;
    this.pendingBroadcast = false;
    this.readyToCommit = false;
    this.result = null;
    this.label = null;
    this.offset = null;
    this.dest = null;
    this.vj = null;
    this.vk = null;
    this.qj = null;
    this.qk = null;

    switch (this.opcode) {
      case OPCODES.LOAD: {
        this.dest = instruction.dest;
        const op1 = this._resolveOperand(instruction.src1, regFile);
        this.vj = op1.value;
        this.qj = op1.tag;
        this.offset = Number(instruction.offset ?? 0);
        regFile.claim(instruction.dest, this.name);
        break;
      }

      case OPCODES.STORE: {
        this.dest = instruction.dest;
        const valOp = this._resolveOperand(instruction.dest, regFile);
        const baseOp = this._resolveOperand(instruction.src1, regFile);
        this.vj = valOp.value;
        this.qj = valOp.tag;
        this.vk = baseOp.value;
        this.qk = baseOp.tag;
        this.offset = Number(instruction.offset ?? 0);
        break;
      }

      case OPCODES.ADD:
      case OPCODES.SUB:
      case OPCODES.MUL:
      case OPCODES.NOR: {
        this.dest = instruction.dest;
        const op1 = this._resolveOperand(instruction.src1, regFile);
        this.vj = op1.value;
        this.qj = op1.tag;

        if (instruction.immediate !== null && instruction.immediate !== undefined) {
          this.vk = Number(instruction.immediate);
          this.qk = null;
        } else {
          const op2 = this._resolveOperand(instruction.src2, regFile);
          this.vk = op2.value;
          this.qk = op2.tag;
        }
        regFile.claim(instruction.dest, this.name);
        break;
      }

      case OPCODES.BEQ: {
        const op1 = this._resolveOperand(instruction.src1, regFile);
        const op2 = this._resolveOperand(instruction.src2, regFile);
        this.vj = op1.value;
        this.qj = op1.tag;
        this.vk = op2.value;
        this.qk = op2.tag;
        this.offset = Number(instruction.offset ?? 0);
        break;
      }

      case OPCODES.CALL: {
        this.label = Number(instruction.label ?? 0);
        regFile.claim("r1", this.name);
        break;
      }

      case OPCODES.RET: {
        const ra = this._resolveOperand("r1", regFile);
        this.vj = ra.value;
        this.qj = ra.tag;
        break;
      }
    }
  }

  snoop(cdb) {
    if (!this.busy || !cdb.occupied || cdb.value === null) {
      return false;
    }
    let captured = false;
    if (this.qj === cdb.sourceTag) {
      this.vj = cdb.value;
      this.qj = null;
      captured = true;
    }
    if (this.qk === cdb.sourceTag) {
      this.vk = cdb.value;
      this.qk = null;
      captured = true;
    }
    return captured;
  }

  operandsReady() {
    if (!this.busy || this.pendingBroadcast || this.readyToCommit) {
      return false;
    }
    return this.qj === null && this.qk === null;
  }

  tickExecute(regFile, memory, pc, cdb) {
    if (!this.busy) {
      return { newPc: pc, event: null };
    }

    if (this.pendingBroadcast) {
      if (cdb.broadcast(this.result, this.name, this.dest)) {
        this.pendingBroadcast = false;
        this.readyToCommit = true;
        return { newPc: pc, event: "broadcast" };
      }
      return { newPc: pc, event: null };
    }

    let startedNow = false;
    if (!this.executing) {
      if (!this.operandsReady()) {
        return { newPc: pc, event: null };
      }
      this.executing = true;
      startedNow = true;
    }

    if (this.remainingCycles > 0) {
      this.remainingCycles -= 1;
      if (this.remainingCycles > 0) {
        return { newPc: pc, event: startedNow ? "started" : null };
      }
    }

    // Execution completed on this cycle
    let newPc = pc;
    switch (this.opcode) {
      case OPCODES.LOAD: {
        const addr = (this.vj ?? 0) + (this.offset ?? 0);
        this.result = memory.read(addr);
        break;
      }
      case OPCODES.STORE: {
        const addr = (this.vk ?? 0) + (this.offset ?? 0);
        memory.write(addr, this.vj ?? 0);
        this.result = null;
        break;
      }
      case OPCODES.ADD:
        this.result = (this.vj ?? 0) + (this.vk ?? 0);
        break;
      case OPCODES.SUB:
        this.result = (this.vj ?? 0) - (this.vk ?? 0);
        break;
      case OPCODES.MUL:
        this.result = ((this.vj ?? 0) * (this.vk ?? 0)) & 0xffff;
        break;
      case OPCODES.NOR:
        this.result = ~((this.vj ?? 0) | (this.vk ?? 0));
        break;
      case OPCODES.BEQ:
        newPc = this.vj === this.vk ? pc + 1 + (this.offset ?? 0) : pc + 1;
        break;
      case OPCODES.CALL:
        regFile.write("r1", pc + 1, this.name);
        newPc = this.label ?? pc + 1;
        break;
      case OPCODES.RET:
        newPc = this.vj ?? pc + 1;
        break;
    }

    const usesCdb = [
      OPCODES.LOAD,
      OPCODES.ADD,
      OPCODES.SUB,
      OPCODES.MUL,
      OPCODES.NOR,
    ].includes(this.opcode);

    if (usesCdb) {
      if (cdb.broadcast(this.result, this.name, this.dest)) {
        this.readyToCommit = true;
      } else {
        this.pendingBroadcast = true;
      }
    } else {
      this.readyToCommit = true;
    }

    return {
      newPc,
      event: startedNow ? "started_and_completed" : "completed",
    };
  }

  canCommit() {
    return this.busy && this.readyToCommit;
  }

  commit(regFile) {
    const writesReg = [
      OPCODES.LOAD,
      OPCODES.ADD,
      OPCODES.SUB,
      OPCODES.MUL,
      OPCODES.NOR,
    ].includes(this.opcode);

    if (writesReg && this.dest && this.dest !== "r0") {
      regFile.write(this.dest, this.result, this.name);
    }
    this.clear();
  }

  statusLabel() {
    if (!this.busy) return "FREE";
    if (this.readyToCommit) return "COMMIT READY";
    if (this.pendingBroadcast) return "CDB WAIT";
    if (this.executing) return "EXECUTING";
    return "WAITING (Qj/Qk)";
  }
}

