class Instruction:
    def __init__(self, opcode, dest=None, src1=None, src2=None, offset=None, label=None, immediate=None):
        self.opcode = opcode.upper()
        self.dest = dest
        self.src1 = src1
        self.src2 = src2
        self.offset = offset
        self.label = label
        self.immediate = immediate

    def __hash__(self):
        return id(self)

    def __eq__(self, other):
        return self is other

    def __str__(self):
        if self.opcode in ("LOAD", "STORE"):
            return f"{self.opcode} {self.dest}, {self.offset}({self.src1})"
        if self.opcode == "BEQ":
            return f"{self.opcode} {self.src1}, {self.src2}, {self.offset}"
        if self.opcode == "CALL":
            return f"{self.opcode} {self.label}"
        if self.opcode == "RET":
            return self.opcode
        if self.immediate is not None:
            return f"{self.opcode} {self.dest}, {self.src1}, #{self.immediate}"
        return f"{self.opcode} {self.dest}, {self.src1}, {self.src2}"


def parse_instruction(line):
    clean_line = line.split("#", 1)[0].strip()
    if not clean_line:
        return None

    tokens = clean_line.replace(",", "").split()
    if not tokens:
        return None

    opcode = tokens[0].upper()

    if opcode in ("LOAD", "STORE") and len(tokens) >= 3:
        dest = tokens[1]
        address = tokens[2]
        if "(" in address and address.endswith(")"):
            offset, base = address.split("(")
            base = base[:-1]
        else:
            offset = "0"
            base = address
        return Instruction(opcode, dest=dest, src1=base, offset=offset)

    if opcode == "BEQ" and len(tokens) >= 4:
        return Instruction(opcode, src1=tokens[1], src2=tokens[2], offset=tokens[3])

    if opcode == "CALL" and len(tokens) >= 2:
        return Instruction(opcode, label=tokens[1])

    if opcode == "RET":
        return Instruction(opcode)

    if opcode in ("ADD", "SUB", "MUL", "NOR") and len(tokens) >= 3:
        dest = tokens[1]
        src1 = tokens[2]
        ingredient = tokens[3] if len(tokens) > 3 else None
        if ingredient is None:
            return Instruction(opcode, dest=dest, src1=src1)
        try:
            immediate = int(ingredient)
            return Instruction(opcode, dest=dest, src1=src1, immediate=immediate)
        except ValueError:
            return Instruction(opcode, dest=dest, src1=src1, src2=ingredient)

    return None
