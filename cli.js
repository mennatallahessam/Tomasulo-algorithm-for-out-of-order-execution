/**
 * Tomasulo Algorithm Simulator — Command-Line Runner (Node.js)
 * Author: Mennatallah Essam (@mennatallahessam)
 *
 * Usage:
 *   node cli.js [program_file] [memory_file]
 */

import fs from "node:fs";
import path from "node:path";
import { TomasuloEngine } from "./js/engine.js";

const programArg = process.argv[2] || "program1.txt";
const memoryArg = process.argv[3] || "data.txt";

const engine = new TomasuloEngine({ registerCount: 9 });

if (fs.existsSync(memoryArg)) {
  const memText = fs.readFileSync(path.resolve(memoryArg), "utf8");
  engine.loadMemoryFromText(memText);
}

if (!fs.existsSync(programArg)) {
  console.error(`Error: Program file not found: ${programArg}`);
  process.exit(1);
}

const progText = fs.readFileSync(path.resolve(programArg), "utf8");
engine.loadProgramFromText(progText);
engine.runToCompletion(1000);

console.log("================================================================");
console.log(`Tomasulo Simulation Report — ${path.basename(programArg)}`);
console.log("================================================================");
console.log(`Total Cycles           : ${engine.totalCycles}`);
console.log(`Instructions Completed : ${engine.instructionsCompleted}`);
console.log(`IPC                    : ${engine.calculateIpc().toFixed(3)}`);
console.log(`Branch Accuracy        : ${engine.branchPredictionAccuracy().toFixed(1)}%`);
console.log("----------------------------------------------------------------");
console.log("Instruction Timing Table:");
console.log(" #  | Instruction              | Station   | Issue | Exec      | WB");
console.log("----+--------------------------+-----------+-------+-----------+----");
engine.timingRecords.forEach((rec, i) => {
  const idx = String(i + 1).padStart(2, " ");
  const inst = rec.instruction.padEnd(24, " ");
  const st = rec.station.padEnd(9, " ");
  const iss = String(rec.issue ?? "-").padStart(5, " ");
  const ex =
    rec.executeStart !== null
      ? `${rec.executeStart}->${rec.executeComplete ?? "?"}`.padStart(9, " ")
      : "        -";
  const wb = String(rec.writeback ?? "-").padStart(3, " ");
  console.log(` ${idx} | ${inst} | ${st} | ${iss} | ${ex} | ${wb}`);
});
console.log("----------------------------------------------------------------");
console.log("Final Register File:");
for (const reg of engine.registers.snapshot()) {
  console.log(
    `  ${reg.name.padEnd(3, " ")} = ${String(reg.value).padStart(6, " ")}  (${
      reg.busy ? `waiting on ${reg.tag}` : "ready"
    })`
  );
}
console.log("================================================================");
