class MemoryArray:
    def __init__(self, size=65536):
        self.cells = [0] * size

    def read(self, address):
        return self.cells[address]

    def write(self, address, value):
        self.cells[address] = value


class RegisterBank:
    def __init__(self, registers=8):
        self.values = {f"r{i}": 0 for i in range(registers)}
        self.values["r0"] = 0
        self.reserve = {f"r{i}": False for i in range(registers)}
        self.reserve["r0"] = False
        self.tags = {f"r{i}": None for i in range(registers)}
        self.tags["r0"] = None

    def read(self, register):
        return 0 if register == "r0" else self.values[register]

    def write(self, register, value):
        if register == "r0":
            return
        self.values[register] = value
        self.reserve[register] = False
        self.tags[register] = None

    def claim(self, register, tag):
        if register == "r0":
            return
        self.reserve[register] = True
        self.tags[register] = tag

    def release(self, register):
        if register == "r0":
            return
        self.reserve[register] = False
        self.tags[register] = None

    def is_reserved(self, register):
        return register != "r0" and self.reserve.get(register, False)

    def status_report(self):
        rows = []
        for reg in sorted(self.values.keys()):
            if self.reserve[reg]:
                rows.append(f"{reg}: busy, waiting for {self.tags[reg]}")
            else:
                rows.append(f"{reg}: {self.values[reg]}")
        return "\n".join(rows)

    def get_status(self):
        return self.status_report()


class ResultBus:
    def __init__(self):
        self.occupied = False
        self.value = None
        self.source_tag = None
        self.destination = None

    def send(self, value, source_tag, destination):
        if self.occupied:
            return False
        self.occupied = True
        self.value = value
        self.source_tag = source_tag
        self.destination = destination
        return True

    def receive(self):
        return self.value, self.source_tag, self.destination

    def available(self):
        return not self.occupied

    def reset(self):
        self.occupied = False
        self.value = None
        self.source_tag = None
        self.destination = None
