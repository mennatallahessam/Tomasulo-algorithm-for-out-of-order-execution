"""
Tomasulo Algorithm Simulator — Graphical User Interface

Original project authors:
    Omar Abdelhady (@3-bhd)
    Muhammad Yasser Elghazaly (@my612)
    The American University in Cairo

GUI redesign and display fixes:
    Mennatallah Essam (@mennatallahessam)
"""

import os
import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.patches as mpatches
import numpy as np


PALETTE = {
    "bg_root": "#0f172a",       # Slate 900
    "bg_panel": "#1e293b",      # Slate 800
    "bg_card": "#334155",       # Slate 700
    "bg_input": "#0b1120",      # Deep slate
    "fg_primary": "#f8fafc",    # Slate 50
    "fg_secondary": "#94a3b8",  # Slate 400
    "accent": "#38bdf8",        # Sky 400
    "accent_hover": "#0284c7",  # Sky 600
    "success": "#22c55e",       # Green 500
    "warning": "#f59e0b",       # Amber 500
    "danger": "#ef4444",        # Red 500
    "violet": "#a855f7",        # Purple 500
    "border": "#475569",        # Slate 600
}


class TomasuloGUI:
    def __init__(self, root, simulator_class):
        self.root = root
        self.root.title("Tomasulo Execution Studio — Out-of-Order Simulator")
        self.root.geometry("1360x860")
        self.root.minsize(1100, 720)
        self.root.configure(bg=PALETTE["bg_root"])

        self.simulator_class = simulator_class
        self.simulator = None

        self.program_file_var = tk.StringVar()
        self.memory_file_var = tk.StringVar()
        self.cycle_var = tk.StringVar(value="0")
        self.status_badge_var = tk.StringVar(value="IDLE")
        self.cdb_status_var = tk.StringVar(value="CDB: Idle")
        self.mem_start_var = tk.StringVar(value="0")
        self.mem_end_var = tk.StringVar(value="64")
        self.mem_nonzero_only = tk.BooleanVar(value=False)

        self.stats_vars = {
            "Total_Cycles": tk.StringVar(value="0"),
            "Instructions_Completed": tk.StringVar(value="0"),
            "IPC": tk.StringVar(value="0.00"),
            "Branch_Accuracy": tk.StringVar(value="100.0%"),
            "Queue_Remaining": tk.StringVar(value="0"),
        }

        self._configure_styles()
        self.create_ui()

    def _configure_styles(self):
        style = ttk.Style(self.root)
        style.theme_use("clam")

        style.configure(".", background=PALETTE["bg_root"], foreground=PALETTE["fg_primary"], font=("Segoe UI", 10))
        style.configure("TFrame", background=PALETTE["bg_root"])
        style.configure("Panel.TFrame", background=PALETTE["bg_panel"])
        style.configure("Card.TFrame", background=PALETTE["bg_card"])

        style.configure(
            "TLabelframe",
            background=PALETTE["bg_panel"],
            foreground=PALETTE["accent"],
            bordercolor=PALETTE["border"],
            relief="solid",
            borderwidth=1,
        )
        style.configure(
            "TLabelframe.Label",
            background=PALETTE["bg_panel"],
            foreground=PALETTE["accent"],
            font=("Segoe UI", 10, "bold"),
        )

        style.configure("TLabel", background=PALETTE["bg_panel"], foreground=PALETTE["fg_primary"])
        style.configure("Root.TLabel", background=PALETTE["bg_root"], foreground=PALETTE["fg_primary"])
        style.configure("Muted.TLabel", background=PALETTE["bg_panel"], foreground=PALETTE["fg_secondary"], font=("Segoe UI", 9))
        style.configure("HeaderTitle.TLabel", background=PALETTE["bg_panel"], foreground=PALETTE["fg_primary"], font=("Segoe UI", 15, "bold"))
        style.configure("HeaderSub.TLabel", background=PALETTE["bg_panel"], foreground=PALETTE["fg_secondary"], font=("Segoe UI", 9))
        style.configure("CardTitle.TLabel", background=PALETTE["bg_card"], foreground=PALETTE["fg_secondary"], font=("Segoe UI", 8, "bold"))
        style.configure("CardValue.TLabel", background=PALETTE["bg_card"], foreground=PALETTE["accent"], font=("Consolas", 14, "bold"))

        style.configure(
            "TButton",
            background=PALETTE["bg_card"],
            foreground=PALETTE["fg_primary"],
            bordercolor=PALETTE["border"],
            focuscolor=PALETTE["accent"],
            padding=(12, 6),
            font=("Segoe UI", 9, "bold"),
        )
        style.map(
            "TButton",
            background=[("active", PALETTE["border"]), ("pressed", PALETTE["accent_hover"])],
            foreground=[("active", PALETTE["fg_primary"])],
        )

        style.configure(
            "Accent.TButton",
            background=PALETTE["accent"],
            foreground=PALETTE["bg_root"],
            padding=(14, 6),
            font=("Segoe UI", 9, "bold"),
        )
        style.map(
            "Accent.TButton",
            background=[("active", PALETTE["accent_hover"]), ("pressed", PALETTE["accent_hover"])],
            foreground=[("active", PALETTE["fg_primary"])],
        )

        style.configure(
            "TEntry",
            fieldbackground=PALETTE["bg_input"],
            foreground=PALETTE["fg_primary"],
            insertcolor=PALETTE["fg_primary"],
            bordercolor=PALETTE["border"],
            padding=4,
        )

        style.configure(
            "TNotebook",
            background=PALETTE["bg_root"],
            borderwidth=0,
            tabmargins=(4, 4, 4, 0),
        )
        style.configure(
            "TNotebook.Tab",
            background=PALETTE["bg_panel"],
            foreground=PALETTE["fg_secondary"],
            padding=(16, 8),
            font=("Segoe UI", 10, "bold"),
        )
        style.map(
            "TNotebook.Tab",
            background=[("selected", PALETTE["accent"]), ("active", PALETTE["bg_card"])],
            foreground=[("selected", PALETTE["bg_root"]), ("active", PALETTE["fg_primary"])],
        )

        style.configure(
            "Treeview",
            background=PALETTE["bg_input"],
            fieldbackground=PALETTE["bg_input"],
            foreground=PALETTE["fg_primary"],
            rowheight=26,
            bordercolor=PALETTE["border"],
            font=("Consolas", 9),
        )
        style.configure(
            "Treeview.Heading",
            background=PALETTE["bg_card"],
            foreground=PALETTE["accent"],
            font=("Segoe UI", 9, "bold"),
            relief="flat",
        )
        style.map(
            "Treeview",
            background=[("selected", PALETTE["accent_hover"])],
            foreground=[("selected", PALETTE["fg_primary"])],
        )

        style.configure(
            "TCheckbutton",
            background=PALETTE["bg_panel"],
            foreground=PALETTE["fg_primary"],
        )

    def create_ui(self):
        self._create_header_bar()
        self._create_Control_strip()

        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=12, pady=(4, 12))

        self.create_dashboard_tab()
        self.create_timing_and_stats_tab()
        self.create_memory_tab()

    def _create_header_bar(self):
        header = ttk.Frame(self.root, style="Panel.TFrame", padding=(16, 10))
        header.pack(fill=tk.X, padx=12, pady=(12, 6))

        title_box = ttk.Frame(header, style="Panel.TFrame")
        title_box.pack(side=tk.LEFT, fill=tk.Y)
        ttk.Label(title_box, text="TOMASULO EXECUTION STUDIO", style="HeaderTitle.TLabel").pack(anchor=tk.W)
        ttk.Label(
            title_box,
            text="Dynamic Scheduling  •  Register Renaming  •  Common Data Bus Visualizer",
            style="HeaderSub.TLabel",
        ).pack(anchor=tk.W)

        kpi_container = ttk.Frame(header, style="Panel.TFrame")
        kpi_container.pack(side=tk.RIGHT)

        kpi_specs = [
            ("STATUS", self.status_badge_var),
            ("CYCLE", self.cycle_var),
            ("COMPLETED", self.stats_vars["Instructions_Completed"]),
            ("IPC", self.stats_vars["IPC"]),
            ("BRANCH ACC", self.stats_vars["Branch_Accuracy"]),
            ("IN QUEUE", self.stats_vars["Queue_Remaining"]),
        ]
        for title, var in kpi_specs:
            card = ttk.Frame(kpi_container, style="Card.TFrame", padding=(12, 6))
            card.pack(side=tk.LEFT, padx=4)
            ttk.Label(card, text=title, style="CardTitle.TLabel").pack(anchor=tk.W)
            ttk.Label(card, textvariable=var, style="CardValue.TLabel").pack(anchor=tk.W)

    def _create_Control_strip(self):
        bar = ttk.Frame(self.root, style="Panel.TFrame", padding=(12, 8))
        bar.pack(fill=tk.X, padx=12, pady=(0, 6))

        files_frame = ttk.Frame(bar, style="Panel.TFrame")
        files_frame.pack(side=tk.LEFT, fill=tk.X, expand=True)

        ttk.Label(files_frame, text="Program:").pack(side=tk.LEFT, padx=(0, 4))
        ttk.Entry(files_frame, textvariable=self.program_file_var, width=34).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(files_frame, text="Browse Program", command=self.load_program).pack(side=tk.LEFT, padx=(0, 14))

        ttk.Label(files_frame, text="Memory:").pack(side=tk.LEFT, padx=(0, 4))
        ttk.Entry(files_frame, textvariable=self.memory_file_var, width=24).pack(side=tk.LEFT, padx=(0, 4))
        ttk.Button(files_frame, text="Browse Memory", command=self.load_memory).pack(side=tk.LEFT, padx=(0, 8))

        actions = ttk.Frame(bar, style="Panel.TFrame")
        actions.pack(side=tk.RIGHT)

        ttk.Button(actions, text="Initialize", style="Accent.TButton", command=self.initialize_simulator).pack(side=tk.LEFT, padx=3)
        ttk.Button(actions, text="Step Cycle  ▶", style="Accent.TButton", command=self.step_simulator).pack(side=tk.LEFT, padx=3)
        ttk.Button(actions, text="Run All  ⏩", command=self.run_simulator).pack(side=tk.LEFT, padx=3)
        ttk.Button(actions, text="Reset  ↺", command=self.reset_simulator).pack(side=tk.LEFT, padx=3)

    def create_dashboard_tab(self):
        dashboard = ttk.Frame(self.notebook)
        self.notebook.add(dashboard, text="  Live Execution Dashboard  ")

        paned = ttk.PanedWindow(dashboard, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=4)

        # Left pane: Program Source + Event Log
        left_pane = ttk.Frame(paned)
        paned.add(left_pane, weight=2)

        prog_frame = ttk.LabelFrame(left_pane, text="  Assembly Program Source  ", padding=8)
        prog_frame.pack(fill=tk.BOTH, expand=True, padx=(0, 6), pady=(0, 6))

        self.program_text = scrolledtext.ScrolledText(
            prog_frame,
            wrap=tk.NONE,
            bg=PALETTE["bg_input"],
            fg=PALETTE["fg_primary"],
            insertbackground=PALETTE["fg_primary"],
            font=("Consolas", 10),
            relief="flat",
            height=14,
        )
        self.program_text.pack(fill=tk.BOTH, expand=True)

        log_frame = ttk.LabelFrame(left_pane, text="  Cycle & Event Log  ", padding=8)
        log_frame.pack(fill=tk.BOTH, expand=True, padx=(0, 6))

        self.log_text = scrolledtext.ScrolledText(
            log_frame,
            wrap=tk.WORD,
            bg=PALETTE["bg_input"],
            fg=PALETTE["fg_secondary"],
            insertbackground=PALETTE["fg_primary"],
            font=("Consolas", 9),
            relief="flat",
            height=10,
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # Right pane: Reservation Stations + Register File
        right_pane = ttk.Frame(paned)
        paned.add(right_pane, weight=3)

        rs_frame = ttk.LabelFrame(right_pane, text="  Reservation Stations & Functional Units  ", padding=8)
        rs_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 6))

        cdb_bar = ttk.Frame(rs_frame, style="Card.TFrame", padding=(10, 4))
        cdb_bar.pack(fill=tk.X, pady=(0, 6))
        ttk.Label(cdb_bar, textvariable=self.cdb_status_var, style="CardValue.TLabel", font=("Consolas", 10, "bold")).pack(anchor=tk.W)

        rs_columns = ("Name", "Type", "Busy", "Op", "Vj", "Vk", "Qj", "Qk", "Cycles")
        self.rs_table = ttk.Treeview(rs_frame, columns=rs_columns, show="headings", height=11)
        col_widths = {
            "Name": 85,
            "Type": 90,
            "Busy": 55,
            "Op": 65,
            "Vj": 70,
            "Vk": 70,
            "Qj": 75,
            "Qk": 75,
            "Cycles": 65,
        }
        for col in rs_columns:
            self.rs_table.heading(col, text=col)
            self.rs_table.column(col, width=col_widths[col], anchor=tk.CENTER)

        self.rs_table.tag_configure("busy", background="#1e3a5f", foreground="#bae6fd")
        self.rs_table.tag_configure("executing", background="#14532d", foreground="#bbf7d0")
        self.rs_table.tag_configure("idle", background=PALETTE["bg_input"], foreground=PALETTE["fg_secondary"])

        rs_scroll = ttk.Scrollbar(rs_frame, orient=tk.VERTICAL, command=self.rs_table.yview)
        self.rs_table.configure(yscroll=rs_scroll.set)
        self.rs_table.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        rs_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        # Register file section (structured table + raw status mirror for compatibility)
        reg_frame = ttk.LabelFrame(right_pane, text="  Register File & Rename Tags  ", padding=8)
        reg_frame.pack(fill=tk.BOTH, expand=True)

        reg_cols = ("Register", "Value", "State", "Producer Tag")
        self.reg_table = ttk.Treeview(reg_frame, columns=reg_cols, show="headings", height=8)
        for col in reg_cols:
            self.reg_table.heading(col, text=col)
            self.reg_table.column(col, width=110, anchor=tk.CENTER)

        self.reg_table.tag_configure("reserved", background="#451a03", foreground="#fde68a")
        self.reg_table.tag_configure("ready", background=PALETTE["bg_input"], foreground=PALETTE["fg_primary"])

        reg_scroll = ttk.Scrollbar(reg_frame, orient=tk.VERTICAL, command=self.reg_table.yview)
        self.reg_table.configure(yscroll=reg_scroll.set)
        self.reg_table.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        reg_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        # Hidden text widget preserved for full API compatibility
        self.reg_text = scrolledtext.ScrolledText(reg_frame, height=1)

    def create_timing_and_stats_tab(self):
        tab = ttk.Frame(self.notebook)
        self.notebook.add(tab, text="  Timing Diagram & Utilization  ")

        paned = ttk.PanedWindow(tab, orient=tk.HORIZONTAL)
        paned.pack(fill=tk.BOTH, expand=True, pady=4)

        timing_box = ttk.LabelFrame(paned, text="  Instruction Pipeline Timing Diagram  ", padding=8)
        paned.add(timing_box, weight=3)

        self.timing_fig = Figure(figsize=(7.5, 5.5), dpi=100, facecolor=PALETTE["bg_panel"])
        self.timing_ax = self.timing_fig.add_subplot(111)
        self._style_axes(self.timing_ax, "Instruction Timing Diagram", "Clock Cycles", "Instructions")

        self.timing_canvas = FigureCanvasTkAgg(self.timing_fig, timing_box)
        self.timing_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

        stats_box = ttk.LabelFrame(paned, text="  Functional Unit Utilization  ", padding=8)
        paned.add(stats_box, weight=2)

        self.stats_fig = Figure(figsize=(5.5, 5.5), dpi=100, facecolor=PALETTE["bg_panel"])
        self.stats_ax = self.stats_fig.add_subplot(111)
        self._style_axes(self.stats_ax, "Functional Unit Utilization", "Functional Unit Group", "Busy %")

        self.stats_canvas = FigureCanvasTkAgg(self.stats_fig, stats_box)
        self.stats_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)

    def create_memory_tab(self):
        memory_frame = ttk.Frame(self.notebook)
        self.notebook.add(memory_frame, text="  Memory Inspector  ")

        ctrl_frame = ttk.Frame(memory_frame, style="Panel.TFrame", padding=(12, 8))
        ctrl_frame.pack(fill=tk.X, pady=(4, 6))

        ttk.Label(ctrl_frame, text="Start Address:").pack(side=tk.LEFT, padx=(0, 4))
        ttk.Entry(ctrl_frame, textvariable=self.mem_start_var, width=10).pack(side=tk.LEFT, padx=(0, 12))

        ttk.Label(ctrl_frame, text="End Address:").pack(side=tk.LEFT, padx=(0, 4))
        ttk.Entry(ctrl_frame, textvariable=self.mem_end_var, width=10).pack(side=tk.LEFT, padx=(0, 12))

        ttk.Checkbutton(
            ctrl_frame,
            text="Non-zero cells only",
            variable=self.mem_nonzero_only,
            command=self.update_memory_display,
        ).pack(side=tk.LEFT, padx=(0, 12))

        ttk.Button(ctrl_frame, text="Inspect Range", style="Accent.TButton", command=self.update_memory_display).pack(side=tk.LEFT, padx=4)
        ttk.Button(ctrl_frame, text="0–64", command=lambda: self._quick_mem_range(0, 64)).pack(side=tk.LEFT, padx=2)
        ttk.Button(ctrl_frame, text="96–128", command=lambda: self._quick_mem_range(96, 128)).pack(side=tk.LEFT, padx=2)

        table_wrap = ttk.LabelFrame(memory_frame, text="  Word Memory Contents (65,536 Words)  ", padding=8)
        table_wrap.pack(fill=tk.BOTH, expand=True)

        columns = ("Address", "Value", "Hex", "Binary", "ASCII")
        self.memory_table = ttk.Treeview(table_wrap, columns=columns, show="headings")

        widths = {"Address": 100, "Value": 110, "Hex": 110, "Binary": 220, "ASCII": 90}
        for col in columns:
            self.memory_table.heading(col, text=col)
            self.memory_table.column(col, width=widths[col], anchor=tk.CENTER)

        self.memory_table.tag_configure("nonzero", background="#1e3a5f", foreground="#38bdf8")
        self.memory_table.tag_configure("zero", background=PALETTE["bg_input"], foreground=PALETTE["fg_secondary"])

        scrollbar = ttk.Scrollbar(table_wrap, orient=tk.VERTICAL, command=self.memory_table.yview)
        self.memory_table.configure(yscroll=scrollbar.set)
        self.memory_table.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

    def _quick_mem_range(self, start, end):
        self.mem_start_var.set(str(start))
        self.mem_end_var.set(str(end))
        self.update_memory_display()

    def _style_axes(self, ax, title, xlabel, ylabel):
        ax.set_facecolor(PALETTE["bg_input"])
        ax.set_title(title, color=PALETTE["fg_primary"], fontsize=11, fontweight="bold", pad=10)
        ax.set_xlabel(xlabel, color=PALETTE["fg_secondary"], fontsize=9)
        ax.set_ylabel(ylabel, color=PALETTE["fg_secondary"], fontsize=9)
        ax.tick_params(colors=PALETTE["fg_secondary"], labelsize=8)
        for spine in ax.spines.values():
            spine.set_color(PALETTE["border"])
        ax.grid(True, linestyle="--", linewidth=0.5, color=PALETTE["border"], alpha=0.4)

    # Utility & Action methods
    def log(self, message):
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)

    def load_program(self):
        filename = filedialog.askopenfilename(
            title="Select Program File",
            filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")],
        )
        if filename:
            self.program_file_var.set(filename)
            try:
                with open(filename, "r") as f:
                    content = f.read()
                self.program_text.delete(1.0, tk.END)
                self.program_text.insert(tk.END, content)
                self.log(f"[Program] Loaded {os.path.basename(filename)}")
            except Exception as e:
                self.log(f"[Error] Could not read program: {str(e)}")

    def load_memory(self):
        filename = filedialog.askopenfilename(
            title="Select Memory Data File",
            filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")],
        )
        if filename:
            self.memory_file_var.set(filename)
            if self.simulator:
                try:
                    if self.simulator.load_memory_data(filename):
                        self.log(f"[Memory] Loaded {os.path.basename(filename)}")
                        self.update_memory_display()
                    else:
                        self.log("[Error] Failed to parse memory data file")
                except Exception as e:
                    self.log(f"[Error] Loading memory data: {str(e)}")
            else:
                self.log(f"[Memory] Selected {os.path.basename(filename)} (will load on Initialize)")

    def initialize_simulator(self):
        program_path = self.program_file_var.get().strip()
        if not program_path:
            self.log("[Error] No program file selected.")
            return

        self.log("Initializing simulator...")
        try:
            self.simulator = self.simulator_class()
            self.simulator.load_program(program_path)

            with open(program_path, "r") as f:
                self.program_text.delete(1.0, tk.END)
                self.program_text.insert(tk.END, f.read())

            mem_path = self.memory_file_var.get().strip()
            if mem_path and os.path.exists(mem_path):
                if self.simulator.load_memory_data(mem_path):
                    self.log(f"[Memory] Preloaded {os.path.basename(mem_path)}")

            self.cycle_var.set("0")
            self.status_badge_var.set("READY")
            self.update_all_displays()
            self.update_memory_display()
            self.log("[OK] Simulator initialized and ready.")
        except Exception as e:
            self.status_badge_var.set("ERROR")
            self.log(f"[Error] Initialization failed: {str(e)}")

    def step_simulator(self):
        if not self.simulator:
            self.log("[Error] Initialize the simulator first.")
            return

        if self.simulator.is_simulation_complete():
            self.status_badge_var.set("DONE")
            self.log("[Info] Simulation has already completed.")
            return

        try:
            self.simulator.total_cycle += 1
            self.cycle_var.set(str(self.simulator.total_cycle))
            self.status_badge_var.set("RUNNING")

            self.log(f"── Cycle {self.simulator.total_cycle} ──")
            self.simulator.handle_writeback()
            self.simulator.handle_execution()
            self.simulator.issue_instruction()

            self.update_all_displays()

            if self.simulator.is_simulation_complete():
                self.status_badge_var.set("DONE")
                self.log(f"[Complete] Finished in {self.simulator.total_cycle} cycles.")
        except Exception as e:
            self.status_badge_var.set("ERROR")
            self.log(f"[Error] Step failed: {str(e)}")

    def run_simulator(self):
        if not self.simulator:
            self.log("[Error] Initialize the simulator first.")
            return

        try:
            self.log("Running full simulation...")
            self.status_badge_var.set("RUNNING")
            max_cycles = 1000

            while not self.simulator.is_simulation_complete() and self.simulator.total_cycle < max_cycles:
                self.simulator.total_cycle += 1
                self.simulator.handle_writeback()
                self.simulator.handle_execution()
                self.simulator.issue_instruction()

                if self.simulator.total_cycle % 10 == 0:
                    self.cycle_var.set(str(self.simulator.total_cycle))
                    self.root.update()

            self.cycle_var.set(str(self.simulator.total_cycle))
            self.update_all_displays()
            self.update_memory_display()

            if self.simulator.total_cycle >= max_cycles:
                self.status_badge_var.set("LIMIT")
                self.log("[Warning] Reached 1000-cycle safety cap.")
            else:
                self.status_badge_var.set("DONE")
                self.log(f"[Complete] Finished in {self.simulator.total_cycle} cycles.")
        except Exception as e:
            self.status_badge_var.set("ERROR")
            self.log(f"[Error] Simulation failed: {str(e)}")

    def reset_simulator(self):
        self.simulator = None
        self.cycle_var.set("0")
        self.status_badge_var.set("IDLE")
        self.cdb_status_var.set("CDB: Idle")

        self.reg_text.delete(1.0, tk.END)
        for item in self.reg_table.get_children():
            self.reg_table.delete(item)
        for item in self.rs_table.get_children():
            self.rs_table.delete(item)
        for item in self.memory_table.get_children():
            self.memory_table.delete(item)

        self.timing_ax.clear()
        self._style_axes(self.timing_ax, "Instruction Timing Diagram", "Clock Cycles", "Instructions")
        self.timing_canvas.draw()

        self.stats_ax.clear()
        self._style_axes(self.stats_ax, "Functional Unit Utilization", "Functional Unit Group", "Busy %")
        self.stats_canvas.draw()

        self.stats_vars["Total_Cycles"].set("0")
        self.stats_vars["Instructions_Completed"].set("0")
        self.stats_vars["IPC"].set("0.00")
        self.stats_vars["Branch_Accuracy"].set("100.0%")
        self.stats_vars["Queue_Remaining"].set("0")

        self.log("[Reset] Simulator state cleared.")

    # Display updaters
    def update_all_displays(self):
        if not self.simulator:
            return
        self.update_register_display()
        self.update_reservation_station_display()
        self.update_timing_diagram()
        self.update_statistics()

    def update_register_display(self):
        if not self.simulator:
            return

        reg_bank = self.simulator.register_file
        self.reg_text.delete(1.0, tk.END)
        self.reg_text.insert(tk.END, reg_bank.get_status())

        for item in self.reg_table.get_children():
            self.reg_table.delete(item)

        for reg_name in sorted(reg_bank.values.keys()):
            val = reg_bank.values[reg_name]
            reserved = reg_bank.reserve.get(reg_name, False)
            tag = reg_bank.tags.get(reg_name) or "—"
            state = "Waiting" if reserved else "Ready"
            row_tag = "reserved" if reserved else "ready"
            self.reg_table.insert("", "end", values=(reg_name, val, state, tag), tags=(row_tag,))

    def update_reservation_station_display(self):
        if not self.simulator:
            return

        cdb = self.simulator.common_data_bus
        if cdb.occupied:
            self.cdb_status_var.set(f"CDB: Broadcasting {cdb.value} from {cdb.source_tag} → {cdb.destination}")
        else:
            self.cdb_status_var.set("CDB: Idle (available)")

        for item in self.rs_table.get_children():
            self.rs_table.delete(item)

        for rs in self.simulator.get_all_reservation_stations():
            unit_kind = getattr(rs, "unit_type", getattr(rs, "op_type", ""))
            if rs.busy and getattr(rs, "executing", False):
                row_tag = "executing"
            elif rs.busy:
                row_tag = "busy"
            else:
                row_tag = "idle"

            self.rs_table.insert(
                "",
                "end",
                values=(
                    rs.name,
                    unit_kind,
                    "BUSY" if rs.busy else "Free",
                    rs.opcode if rs.busy else "—",
                    rs.vj if rs.vj is not None else "",
                    rs.vk if rs.vk is not None else "",
                    rs.qj if rs.qj is not None else "",
                    rs.qk if rs.qk is not None else "",
                    rs.remaining_cycles if rs.busy else "",
                ),
                tags=(row_tag,),
            )

    def update_timing_diagram(self):
        if not self.simulator or not hasattr(self.simulator, "instruction_timing"):
            return

        self.timing_ax.clear()
        self._style_axes(self.timing_ax, "Instruction Timing Diagram", "Clock Cycles", "Instructions")

        instructions = list(self.simulator.instruction_timing.keys())
        if not instructions:
            self.timing_canvas.draw()
            return

        y_positions = list(range(len(instructions)))
        self.timing_ax.set_yticks(y_positions)
        self.timing_ax.set_yticklabels([f"{idx}: {inst}" for idx, inst in enumerate(instructions)])
        self.timing_ax.invert_yaxis()

        for i, inst in enumerate(instructions):
            timing = self.simulator.instruction_timing[inst]
            issue_c = timing.get("issue")
            start_c = timing.get("execute_start")
            end_c = timing.get("execute_complete")
            wb_c = timing.get("writeback")

            if issue_c is not None:
                self.timing_ax.plot([issue_c], [i], marker="o", color=PALETTE["accent"], markersize=8, zorder=4)

            if start_c is not None and end_c is not None:
                self.timing_ax.plot([start_c, end_c], [i, i], color=PALETTE["warning"], linewidth=4, solid_capstyle="round", zorder=3)
            elif start_c is not None:
                self.timing_ax.plot([start_c, self.simulator.total_cycle], [i, i], color=PALETTE["warning"], linewidth=2, linestyle=":", zorder=3)

            if wb_c is not None:
                self.timing_ax.plot([wb_c], [i], marker="D", color=PALETTE["success"], markersize=8, zorder=5)

        max_cycle = max(
            max([t.get("writeback") or t.get("execute_complete") or t.get("issue") or 0 for t in self.simulator.instruction_timing.values()]),
            self.simulator.total_cycle,
        ) + 2
        self.timing_ax.set_xlim(0, max_cycle)

        issue_patch = mpatches.Patch(color=PALETTE["accent"], label="Issue")
        exec_patch = mpatches.Patch(color=PALETTE["warning"], label="Execute")
        wb_patch = mpatches.Patch(color=PALETTE["success"], label="Writeback")
        legend = self.timing_ax.legend(handles=[issue_patch, exec_patch, wb_patch], loc="lower right", facecolor=PALETTE["bg_panel"], edgecolor=PALETTE["border"])
        for text in legend.get_texts():
            text.set_color(PALETTE["fg_primary"])

        self.timing_fig.tight_layout()
        self.timing_canvas.draw()

    def update_memory_display(self):
        if not self.simulator:
            return

        try:
            start_addr = int(self.mem_start_var.get())
            end_addr = int(self.mem_end_var.get())

            if start_addr < 0 or end_addr < start_addr:
                self.log("[Error] Invalid memory address range.")
                return

            for item in self.memory_table.get_children():
                self.memory_table.delete(item)

            cells = getattr(self.simulator.memory, "cells", getattr(self.simulator.memory, "mem", []))
            upper = min(end_addr + 1, len(cells))
            nonzero_only = self.mem_nonzero_only.get()

            for addr in range(start_addr, upper):
                value = cells[addr]
                if nonzero_only and value == 0:
                    continue
                masked = value & 0xFFFF
                binary = format(masked, "016b")
                hex_val = f"0x{masked:04X}"
                ascii_char = chr(value) if 32 <= value <= 126 else "·"
                tag = "nonzero" if value != 0 else "zero"
                self.memory_table.insert("", "end", values=(addr, value, hex_val, binary, ascii_char), tags=(tag,))
        except ValueError:
            self.log("[Error] Memory addresses must be integers.")
        except Exception as e:
            self.log(f"[Error] Memory inspector failed: {str(e)}")

    def update_statistics(self):
        if not self.simulator:
            return

        self.stats_vars["Total_Cycles"].set(str(self.simulator.total_cycle))
        self.stats_vars["Instructions_Completed"].set(str(self.simulator.instructions_completed))
        self.stats_vars["Queue_Remaining"].set(str(len(self.simulator.instruction_queue)))
        self.stats_vars["IPC"].set(f"{self.simulator.calculate_ipc():.2f}")
        self.stats_vars["Branch_Accuracy"].set(f"{self.simulator.get_branch_prediction_accuracy():.1f}%")

        self.stats_ax.clear()
        self._style_axes(self.stats_ax, "Functional Unit Utilization", "Functional Unit Group", "Busy %")

        rs_types = {
            "Load": self.simulator.LRS,
            "Store": self.simulator.SRS,
            "Branch": self.simulator.BEQ,
            "Call/Ret": self.simulator.CALL_RET,
            "ADD/SUB": self.simulator.ADD_SUB,
            "MUL": self.simulator.MUL,
            "NOR": self.simulator.NOR,
        }

        labels = list(rs_types.keys())
        utilization = [
            (sum(1 for rs in stations if rs.busy) / len(stations) * 100.0) if stations else 0.0
            for stations in rs_types.values()
        ]

        x_pos = np.arange(len(labels))
        bars = self.stats_ax.bar(x_pos, utilization, align="center", color=PALETTE["accent"], edgecolor=PALETTE["fg_primary"], width=0.6)
        for bar, pct in zip(bars, utilization):
            if pct > 0:
                self.stats_ax.text(
                    bar.get_x() + bar.get_width() / 2,
                    min(pct + 3, 95),
                    f"{pct:.0f}%",
                    ha="center",
                    va="bottom",
                    color=PALETTE["fg_primary"],
                    fontsize=8,
                    fontweight="bold",
                )

        self.stats_ax.set_xticks(x_pos)
        self.stats_ax.set_xticklabels(labels, rotation=30, ha="right")
        self.stats_ax.set_ylim(0, 105)
        self.stats_fig.tight_layout()
        self.stats_canvas.draw()
