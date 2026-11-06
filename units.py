class ReservationUnit:
    def __init__(self, name, unit_type, latency):
        self.name = name
        self.unit_type = unit_type
        self.latency = latency
        self.reset()

    def reset(self):
        self.busy = False
        self.opcode = None
        self.dest = None
        self.vj = None
        self.vk = None
        self.qj = None
        self.qk = None
        self.remaining_cycles = 0
        self.result = None
        self.instruction = None
        self.executing = False
        self.pending_broadcast = False
        self.ready_to_commit = False
        self.label = None

    def is_available(self):
        return not self.busy

    def _source_value(self, register, register_bank):
        if register == "r0":
            return 0, None
        if register_bank.is_reserved(register):
            return None, register_bank.tags[register]
        return register_bank.read(register), None

    def allocate(self, instruction, register_bank):
        self.busy = True
        self.opcode = instruction.opcode
        self.instruction = instruction
        self.remaining_cycles = self.latency
        self.executing = False
        self.pending_broadcast = False
        self.ready_to_commit = False
        self.result = None
        self.label = None

        if self.opcode == "LOAD":
            self.dest = instruction.dest
            self.vj, self.qj = self._source_value(instruction.src1, register_bank)
            self.vk = None
            self.qk = None
            self.offset = int(instruction.offset)
            register_bank.claim(instruction.dest, self.name)

        elif self.opcode == "STORE":
            self.dest = instruction.dest
            self.vj, self.qj = self._source_value(instruction.dest, register_bank)
            self.vk, self.qk = self._source_value(instruction.src1, register_bank)
            self.offset = int(instruction.offset)

        elif self.opcode in ("ADD", "SUB", "MUL", "NOR"):
            self.dest = instruction.dest
            self.vj, self.qj = self._source_value(instruction.src1, register_bank)
            if instruction.immediate is not None:
                self.vk = instruction.immediate
                self.qk = None
            else:
                self.vk, self.qk = self._source_value(instruction.src2, register_bank)
            register_bank.claim(instruction.dest, self.name)

        elif self.opcode == "BEQ":
            self.dest = None
            self.vj, self.qj = self._source_value(instruction.src1, register_bank)
            self.vk, self.qk = self._source_value(instruction.src2, register_bank)
            self.offset = int(instruction.offset)

        elif self.opcode == "CALL":
            self.dest = None
            self.label = int(instruction.label)
            register_bank.claim("r1", self.name)

        elif self.opcode == "RET":
            self.dest = None
            self.vj, self.qj = self._source_value("r1", register_bank)
            self.vk = None
            self.qk = None

    def listen(self, cdb):
        if not self.busy:
            return
        value, source, _ = cdb.receive()
        if value is None:
            return
        if self.qj == source:
            self.vj = value
            self.qj = None
        if self.qk == source:
            self.vk = value
            self.qk = None

    def is_ready_to_execute(self):
        if not self.busy or self.pending_broadcast or self.ready_to_commit:
            return False
        return self.qj is None and self.qk is None

    def step(self, register_bank, memory, pc, cdb):
        if not self.busy:
            return pc, None

        if self.pending_broadcast:
            if cdb.send(self.result, self.name, self.dest):
                self.pending_broadcast = False
                self.ready_to_commit = True
            return pc, None

        if not self.executing:
            if not self.is_ready_to_execute():
                return pc, None
            self.executing = True
            return pc, "started"

        if self.remaining_cycles > 1:
            self.remaining_cycles -= 1
            return pc, None

        self.remaining_cycles = 0
        new_pc = pc
        if self.opcode == "LOAD":
            new_pc = self._complete_load(memory)
        elif self.opcode == "STORE":
            new_pc = self._complete_store(memory)
        elif self.opcode == "ADD":
            self.result = self.vj + self.vk
        elif self.opcode == "SUB":
            self.result = self.vj - self.vk
        elif self.opcode == "MUL":
            self.result = (self.vj * self.vk) & 0xFFFF
        elif self.opcode == "NOR":
            self.result = ~(self.vj | self.vk)
        elif self.opcode == "BEQ":
            new_pc = pc + 1 + self.offset if self.vj == self.vk else pc + 1
        elif self.opcode == "CALL":
            register_bank.write("r1", pc + 1)
            new_pc = self.label
        elif self.opcode == "RET":
            new_pc = self.vj

        if self.opcode in ("LOAD", "ADD", "SUB", "MUL", "NOR"):
            if cdb.send(self.result, self.name, self.dest):
                self.ready_to_commit = True
            else:
                self.pending_broadcast = True
        else:
            self.ready_to_commit = True

        return new_pc, "completed"

    def _complete_load(self, memory):
        address = self.vj + self.offset
        self.result = memory.read(address)
        return self.result

    def _complete_store(self, memory):
        address = self.vk + self.offset
        memory.write(address, self.vj)
        return None

    def can_commit(self):
        return self.busy and self.ready_to_commit

    def commit(self, register_bank):
        if self.opcode in ("LOAD", "ADD", "SUB", "MUL", "NOR") and self.dest != "r0":
            register_bank.write(self.dest, self.result)
        self.reset()
