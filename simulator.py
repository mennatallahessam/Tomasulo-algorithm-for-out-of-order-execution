from memory import MemoryArray, RegisterBank, ResultBus
from parser import parse_instruction
from units import ReservationUnit

class TomasuloSimulator:
    def __init__(self) -> None:
        self.memory = MemoryArray()
        self.registers = RegisterBank()
        self.instruction_queue = []
        self.total_cycle = 0
        self.pc = 0
        self.instructions_completed = 0
        self.branches_encountered = 0
        self.branch_mispredictions = 0
        self.instruction_timing = {}
        self.common_data_bus = ResultBus()

        self.LRS = [ReservationUnit("LRS1", "Load", 6), ReservationUnit("LRS2", "Load", 6)]
        self.SRS = [ReservationUnit("SRS1", "Store", 6), ReservationUnit("SRS2", "Store", 6)]
        self.BEQ = [ReservationUnit("BEQ1", "Branch", 1), ReservationUnit("BEQ2", "Branch", 1)]
        self.CALL_RET = [ReservationUnit("CALL_RET1", "Call/Return", 1)]
        self.ADD_SUB = [ReservationUnit("ADD_SUB1", "ALU", 2), ReservationUnit("ADD_SUB2", "ALU", 2)]
        self.NOR = [ReservationUnit("NOR1", "ALU", 1)]
        self.MUL = [ReservationUnit("MUL1", "ALU", 10)]

    @property
    def register_file(self):
        return self.registers

    def get_all_reservation_stations(self):
        return self.LRS + self.SRS + self.BEQ + self.CALL_RET + self.ADD_SUB + self.NOR + self.MUL

    def _station_group_for(self, instruction):
        if instruction.opcode == "LOAD":
            return self.LRS
        if instruction.opcode == "STORE":
            return self.SRS
        if instruction.opcode == "BEQ":
            return self.BEQ
        if instruction.opcode in ("CALL", "RET"):
            return self.CALL_RET
        if instruction.opcode in ("ADD", "SUB"):
            return self.ADD_SUB
        if instruction.opcode == "NOR":
            return self.NOR
        if instruction.opcode == "MUL":
            return self.MUL
        return []

    def load_program(self, program_path):
        self.instruction_queue.clear()
        with open(program_path, 'r') as source:
            for raw in source:
                line = raw.strip()
                if not line or line.startswith('#'):
                    continue
                instruction = parse_instruction(line)
                if instruction:
                    self.instruction_queue.append(instruction)

    def load_memory_data(self, file_path):
        try:
            with open(file_path, 'r') as source:
                for raw in source:
                    text = raw.strip()
                    if not text or text.startswith('#'):
                        continue
                    parts = text.split()
                    if len(parts) < 2:
                        continue
                    address = int(parts[0])
                    value = int(parts[1])
                    self.memory.write(address, value)
            return True
        except Exception:
            return False

    def issue_instruction(self):
        if not self.instruction_queue:
            return False

        current = self.instruction_queue[0]
        group = self._station_group_for(current)
        if not group:
            return False

        for station in group:
            if station.is_available():
                self.instruction_queue.pop(0)
                station.allocate(current, self.registers)
                self.instruction_timing[current] = {
                    'issue': self.total_cycle,
                    'execute_start': None,
                    'execute_complete': None,
                    'writeback': None,
                }
                return True
        return False

    def handle_execution(self):
        for station in self.get_all_reservation_stations():
            old_pc = self.pc
            next_pc, stage = station.step(self.registers, self.memory, self.pc, self.common_data_bus)
            if stage == 'started' and station.instruction in self.instruction_timing:
                self.instruction_timing[station.instruction]['execute_start'] = self.total_cycle
            if stage == 'completed' and station.instruction in self.instruction_timing:
                self.instruction_timing[station.instruction]['execute_complete'] = self.total_cycle

            if next_pc is not None and next_pc != self.pc:
                if station.opcode == 'BEQ':
                    self.branches_encountered += 1
                    if next_pc != old_pc + 1:
                        self.branch_mispredictions += 1
                self.pc = next_pc

    def handle_writeback(self):
        for station in self.get_all_reservation_stations():
            station.listen(self.common_data_bus)

        self.common_data_bus.reset()

        for station in self.get_all_reservation_stations():
            if station.can_commit():
                if station.instruction in self.instruction_timing:
                    self.instruction_timing[station.instruction]['writeback'] = self.total_cycle
                station.commit(self.registers)
                self.instructions_completed += 1
                break

    def is_simulation_complete(self):
        queue_empty = not self.instruction_queue
        all_free = all(not station.busy for station in self.get_all_reservation_stations())
        return queue_empty and all_free

    def calculate_ipc(self):
        return self.instructions_completed / self.total_cycle if self.total_cycle else 0.0

    def get_branch_prediction_accuracy(self):
        if self.branches_encountered == 0:
            return 100.0
        return (self.branches_encountered - self.branch_mispredictions) / self.branches_encountered * 100.0

    def display_register_status(self):
        print(self.register_file.get_status())

    def display_reservation_stations(self):
        for station in self.get_all_reservation_stations():
            if station.busy:
                print(f"{station.name}: {station.opcode} vj={station.vj} vk={station.vk} qj={station.qj} qk={station.qk} cycles={station.remaining_cycles}")

    def display_timing_table(self):
        print("Instruction Timing Table")
        print("Instr\tIssue\tStart\tComplete\tWriteback")
        for instruction, timing in self.instruction_timing.items():
            print(f"{instruction}\t{timing['issue']}\t{timing['execute_start']}\t{timing['execute_complete']}\t{timing['writeback']}")

    def simulate(self):
        while not self.is_simulation_complete():
            self.total_cycle += 1
            self.handle_writeback()
            self.handle_execution()
            self.issue_instruction()
            if self.total_cycle > 1000:
                break

if __name__ == '__main__':
    simulator = TomasuloSimulator()
    simulator.load_program('program.txt')
    simulator.simulate()
