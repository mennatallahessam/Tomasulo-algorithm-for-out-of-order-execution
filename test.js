/**
 * Tomasulo Algorithm Simulator — Automated Unit & Integration Test Suite
 * Author: Mennatallah Essam (@mennatallahessam)
 */

import assert from "node:assert/strict";
import { parseInstructionLine, parseProgramText, parseMemoryText } from "./js/isa.js";
import { TomasuloEngine } from "./js/engine.js";
import { SAMPLE_PROGRAMS, DEFAULT_MEMORY_TEXT } from "./js/presets.js";

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

console.log("Running Tomasulo Simulator Test Suite...\n");

test("Parser handles LOAD, STORE, ALU, immediate, BEQ, CALL, and RET", () => {
  const load = parseInstructionLine("LOAD r4, 8(r2) # comment", 0, 1);
  assert.equal(load.opcode, "LOAD");
  assert.equal(load.dest, "r4");
  assert.equal(load.src1, "r2");
  assert.equal(load.offset, 8);

  const imm = parseInstructionLine("ADD r1, r0, 25", 1, 2);
  assert.equal(imm.opcode, "ADD");
  assert.equal(imm.immediate, 25);

  const beq = parseInstructionLine("BEQ r3, r2, -4", 2, 3);
  assert.equal(beq.opcode, "BEQ");
  assert.equal(beq.offset, -4);
});

test("Register r0 is hardwired to 0 and ignores writes/claims", () => {
  const engine = new TomasuloEngine();
  engine.loadProgramFromText(`
    ADD r0, r0, 99
    ADD r1, r0, 15
  `);
  engine.runToCompletion();
  assert.equal(engine.registers.read("r0"), 0);
  assert.equal(engine.registers.read("r1"), 15);
});

test("RAW, WAW, and WAR hazards are resolved via register renaming", () => {
  const engine = new TomasuloEngine();
  engine.loadProgramFromText(`
    ADD r1, r0, 10
    ADD r2, r0, 20
    MUL r3, r1, r2
    ADD r4, r3, r1
    ADD r3, r0, 7
  `);
  engine.runToCompletion();
  assert.equal(engine.registers.read("r1"), 10);
  assert.equal(engine.registers.read("r2"), 20);
  assert.equal(engine.registers.read("r4"), 210);
  assert.equal(engine.registers.read("r3"), 7);
});

test("Dynamic PC Control-Flow mode skips instructions on taken BEQ", () => {
  const engine = new TomasuloEngine({ fetchMode: "control_flow" });
  engine.loadProgramFromText(`
    ADD r1, r0, 10
    BEQ r0, r0, 2
    ADD r1, r0, 99
    ADD r2, r0, 99
    ADD r2, r1, 5
    RET
  `);
  engine.runToCompletion();
  assert.equal(engine.registers.read("r1"), 10);
  assert.equal(engine.registers.read("r2"), 15);
});

test("All 4 built-in sample programs run to completion in Queue mode", () => {
  for (const [name, source] of Object.entries(SAMPLE_PROGRAMS)) {
    const engine = new TomasuloEngine({ registerCount: 9, fetchMode: "queue" });
    engine.loadMemoryFromText(DEFAULT_MEMORY_TEXT);
    const count = engine.loadProgramFromText(source);
    engine.runToCompletion(1000);
    assert.equal(engine.isComplete(), true, `${name} should complete`);
    assert.equal(engine.instructionsCompleted, count, `${name} should commit all instructions`);
  }
});

console.log(`\nAll ${passed} test suites passed!`);

