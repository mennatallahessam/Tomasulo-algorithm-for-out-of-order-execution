/**
 * Tomasulo Algorithm Simulator — Built-in Sample Programs & Memory Presets
 * Author: Mennatallah Essam (@mennatallahessam)
 */

export const SAMPLE_PROGRAMS = Object.freeze({
  "program.txt": `ADD r1, r0, r0    # r1 = 0
STORE r1, 0(r2)   # mem[20] = 10
LOAD r4, 0(r2)    # r4 = mem[20] = 10
ADD r6, r4, r5    # r6 = r4 + r5 = 40
SUB r8, r6, r4    # r8 = r6 - r4 = 30
NOR r6, r6, r0    # r6 = ~(r6 | 0) = ~40
ADD r7, r0, 50    # r7 = 50 (executed after return)
RET               # Return to caller`,

  "program1.txt": `ADD r1, r0, r0    # r1 = 0
ADD r2, r0, r0    # r2 = 0
ADD r3, r0, r0    # r3 = 0
ADD r1, r0, 10    # r1 = 10
ADD r2, r0, 20    # r2 = 20
STORE r1, 0(r2)   # mem[20] = 10
ADD r3, r0, 30    # r3 = 30
STORE r3, 4(r2)   # mem[24] = 30
LOAD r4, 0(r2)    # r4 = mem[20] = 10
LOAD r5, 4(r2)    # r5 = mem[24] = 30
ADD r6, r4, r5    # r6 = r4 + r5 = 40
MUL r7, r4, r5    # r7 = r4 * r5 = 300
SUB r8, r6, r4    # r8 = r6 - r4 = 30
NOR r6, r6, r0    # r6 = ~(r6 | 0) = ~40
BEQ r0, r0, 2     # Should take branch (skip 2 instructions)
ADD r1, r0, 99    # Should be skipped
ADD r2, r0, 99    # Should be skipped
ADD r1, r0, 50    # r1 = 50
RET               # Return (undefined since we didn't call)`,

  "program2.txt": `ADD r1, r0, 10    # r1 = 10 (array base address)
ADD r2, r0, 5     # r2 = 5 (array size)
ADD r3, r0, 0     # r3 = 0 (loop counter)
ADD r4, r0, 0     # r4 = 0 (sum)
ADD r5, r0, 5     # value 5
STORE r5, 0(r1)   # mem[10] = 5
ADD r5, r0, 10    # value 10
STORE r5, 1(r1)   # mem[11] = 10
ADD r5, r0, 15    # value 15
STORE r5, 2(r1)   # mem[12] = 15
ADD r5, r0, 20    # value 20
STORE r5, 3(r1)   # mem[13] = 20
ADD r5, r0, 25    # value 25
STORE r5, 4(r1)   # mem[14] = 25
LOAD r5, 0(r1)    # Load array element at current pointer
ADD r4, r4, r5    # Add to sum
ADD r1, r1, 1     # Increment array pointer
ADD r3, r3, 1     # Increment counter
BEQ r3, r2, 3     # If counter == size, exit loop (skip 3 instructions)
CALL 9            # Call recursive function at instruction 9
ADD r7, r0, 0     # Dummy instruction
BEQ r0, r0, -7    # Jump back to loop start
ADD r6, r0, 100   # Set r6 to 100 (just a dummy operation)
RET               # Return to caller
ADD r7, r0, r4    # Copy sum to r7`,

  "program3.txt": `ADD r1, r0, 1     # r1 = 1
ADD r2, r0, 2     # r2 = 2
ADD r3, r0, 3     # r3 = 3
ADD r4, r0, 4     # r4 = 4
ADD r7, r0, 100   # r7 = 100 (base memory address)
STORE r1, 0(r7)   # mem[100] = 1
STORE r2, 4(r7)   # mem[104] = 2
STORE r3, 8(r7)   # mem[108] = 3
STORE r4, 12(r7)  # mem[112] = 4
ADD r5, r1, r2    # r5 = r1 + r2 = 3
LOAD r6, 8(r7)    # r6 = mem[108] = 3 (independent of previous)
MUL r2, r5, r6    # r2 = r5 * r6 = 9 (depends on previous two)
SUB r3, r6, r1    # r3 = r6 - r1 = 2 (depends on r6 and r1)
BEQ r5, r6, 3     # Branch taken if r5 == r6 (both are 3)
ADD r1, r0, 99    # Skipped if branch taken
CALL 32           # Skipped if branch taken
ADD r5, r0, 0     # Skipped if branch taken
NOR r4, r2, r3    # r4 = ~(r2 | r3) = ~(9 | 2)
MUL r5, r2, r4    # r5 = r2 * r4 (depends on previous)
STORE r5, 16(r7)  # mem[116] = r5 (depends on previous)
ADD r1, r0, 0     # r1 = 0 (loop counter)
ADD r2, r0, 5     # r2 = 5 (loop limit)
ADD r1, r1, 1     # Increment counter
BEQ r1, r2, 3     # Exit loop when counter reaches limit
LOAD r3, 0(r7)    # Load value from memory
ADD r3, r3, r1    # Add counter to loaded value
BEQ r0, r0, -4    # Jump back to loop start
ADD r6, r0, 200   # r6 = 200
RET               # Return to caller`,
});

export const DEFAULT_MEMORY_TEXT = `10 42
11 73
12 15`;

