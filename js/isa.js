/**
 * Tomasulo Algorithm Simulator — Instruction Set & Parser
 * Author: Mennatallah Essam (@mennatallahessam)
 */

export const OPCODES = Object.freeze({
  LOAD: "LOAD",
  STORE: "STORE",
  BEQ: "BEQ",
  CALL: "CALL",
  RET: "RET",
  ADD: "ADD",
  SUB: "SUB",
  MUL: "MUL",
  NOR: "NOR",
});

export class InstructionNode {
  /**
   * @param {object} params
   * @param {number} params.id
   * @param {string} params.opcode
   * @param {string|null} [params.dest]
   * @param {string|null} [params.src1]
   * @param {string|null} [params.src2]
   * @param {number|null} [params.offset]
   * @param {number|null} [params.label]
   * @param {number|null} [params.immediate]
   * @param {string} [params.rawText]
   * @param {number} [params.lineNumber]
   */
  constructor({
    id,
    opcode,
    dest = null,
    src1 = null,
    src2 = null,
    offset = null,
    label = null,
    immediate = null,
    rawText = "",
    lineNumber = 0,
  }) {
    this.id = id;
    this.opcode = opcode.toUpperCase();
    this.dest = dest ? dest.toLowerCase() : null;
    this.src1 = src1 ? src1.toLowerCase() : null;
    this.src2 = src2 ? src2.toLowerCase() : null;
    this.offset = offset !== null && offset !== undefined ? Number(offset) : null;
    this.label = label !== null && label !== undefined ? Number(label) : null;
    this.immediate =
      immediate !== null && immediate !== undefined ? Number(immediate) : null;
    this.rawText = rawText;
    this.lineNumber = lineNumber;
  }

  format() {
    switch (this.opcode) {
      case OPCODES.LOAD:
      case OPCODES.STORE:
        return `${this.opcode} ${this.dest}, ${this.offset}(${this.src1})`;
      case OPCODES.BEQ:
        return `${this.opcode} ${this.src1}, ${this.src2}, ${this.offset}`;
      case OPCODES.CALL:
        return `${this.opcode} ${this.label}`;
      case OPCODES.RET:
        return OPCODES.RET;
      default:
        if (this.immediate !== null) {
          return `${this.opcode} ${this.dest}, ${this.src1}, #${this.immediate}`;
        }
        return `${this.opcode} ${this.dest}, ${this.src1}, ${this.src2}`;
    }
  }

  toString() {
    return this.format();
  }
}

/**
 * Parses a single line of assembly text into an InstructionNode (or null if comment/blank).
 * @param {string} line
 * @param {number} id
 * @param {number} lineNumber
 * @returns {InstructionNode|null}
 */
export function parseInstructionLine(line, id = 0, lineNumber = 1) {
  const withoutComment = line.split("#")[0].trim();
  if (!withoutComment) {
    return null;
  }

  const tokens = withoutComment.replace(/,/g, " ").trim().split(/\s+/);
  if (tokens.length === 0 || !tokens[0]) {
    return null;
  }

  const opcode = tokens[0].toUpperCase();

  if ((opcode === OPCODES.LOAD || opcode === OPCODES.STORE) && tokens.length >= 3) {
    const dest = tokens[1];
    const addrExpr = tokens[2];
    let offset = 0;
    let base = addrExpr;

    if (addrExpr.includes("(") && addrExpr.endsWith(")")) {
      const [offPart, basePart] = addrExpr.slice(0, -1).split("(");
      offset = offPart.trim() === "" ? 0 : parseInt(offPart.trim(), 10);
      base = basePart.trim();
    }

    return new InstructionNode({
      id,
      opcode,
      dest,
      src1: base,
      offset: Number.isNaN(offset) ? 0 : offset,
      rawText: withoutComment,
      lineNumber,
    });
  }

  if (opcode === OPCODES.BEQ && tokens.length >= 4) {
    return new InstructionNode({
      id,
      opcode,
      src1: tokens[1],
      src2: tokens[2],
      offset: parseInt(tokens[3], 10),
      rawText: withoutComment,
      lineNumber,
    });
  }

  if (opcode === OPCODES.CALL && tokens.length >= 2) {
    return new InstructionNode({
      id,
      opcode,
      label: parseInt(tokens[1], 10),
      rawText: withoutComment,
      lineNumber,
    });
  }

  if (opcode === OPCODES.RET) {
    return new InstructionNode({
      id,
      opcode,
      rawText: withoutComment,
      lineNumber,
    });
  }

  if (
    [OPCODES.ADD, OPCODES.SUB, OPCODES.MUL, OPCODES.NOR].includes(opcode) &&
    tokens.length >= 3
  ) {
    const dest = tokens[1];
    const src1 = tokens[2];
    const third = tokens.length > 3 ? tokens[3].replace(/^#/, "") : null;

    if (third === null) {
      return new InstructionNode({
        id,
        opcode,
        dest,
        src1,
        rawText: withoutComment,
        lineNumber,
      });
    }

    const parsedImm = Number(third);
    if (!Number.isNaN(parsedImm) && /^-?\d+$/.test(third)) {
      return new InstructionNode({
        id,
        opcode,
        dest,
        src1,
        immediate: parsedImm,
        rawText: withoutComment,
        lineNumber,
      });
    }

    return new InstructionNode({
      id,
      opcode,
      dest,
      src1,
      src2: third,
      rawText: withoutComment,
      lineNumber,
    });
  }

  return null;
}

/**
 * Parses a multi-line program into an array of InstructionNode objects.
 * @param {string} sourceText
 * @returns {InstructionNode[]}
 */
export function parseProgramText(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  const instructions = [];
  let nextId = 0;

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }
    const inst = parseInstructionLine(trimmed, nextId, idx + 1);
    if (inst) {
      instructions.push(inst);
      nextId += 1;
    }
  });

  return instructions;
}

/**
 * Parses memory initialization text ("address value" per line).
 * @param {string} memoryText
 * @returns {Array<{address: number, value: number}>}
 */
export function parseMemoryText(memoryText) {
  const entries = [];
  const lines = memoryText.split(/\r?\n/);

  for (const raw of lines) {
    const clean = raw.split("#")[0].trim();
    if (!clean) continue;
    const parts = clean.split(/\s+/);
    if (parts.length < 2) continue;
    const address = parseInt(parts[0], 10);
    const value = parseInt(parts[1], 10);
    if (!Number.isNaN(address) && !Number.isNaN(value)) {
      entries.push({ address, value });
    }
  }

  return entries;
}

