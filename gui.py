import tkinter as tk
from tkinter import ttk, filedialog, scrolledtext
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import matplotlib.patches as mpatches
import numpy as np

class TomasuloGUI:
    def __init__(self, root, simulator_class):
        self.root = root
        self.root.title("Tomasulo Algorithm Simulator")
        self.root.geometry("1200x800")
        
        # Store the simulator class for creating instances
        self.simulator_class = simulator_class
        self.simulator = None
        
        # Initialize the UI
        self.create_ui()
    
    def create_ui(self):
        # Main notebook for tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Create tabs
        self.create_control_tab()
        self.create_status_tab()
        self.create_timing_tab()
        self.create_memory_tab()
        self.create_stats_tab()
    
    def create_control_tab(self):
        control_frame = ttk.Frame(self.notebook)
        self.notebook.add(control_frame, text="Control")
        
        # Top section - File loading and control buttons
        top_frame = ttk.LabelFrame(control_frame, text="Control Panel")
        top_frame.pack(fill=tk.X, padx=10, pady=10)
        
        # File selection
        file_frame = ttk.Frame(top_frame)
        file_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(file_frame, text="Program File:").pack(side=tk.LEFT, padx=5)
        self.program_file_var = tk.StringVar()
        ttk.Entry(file_frame, textvariable=self.program_file_var, width=50).pack(side=tk.LEFT, padx=5)
        ttk.Button(file_frame, text="Browse...", command=self.load_program).pack(side=tk.LEFT, padx=5)
        
        ttk.Label(file_frame, text="Memory File:").pack(side=tk.LEFT, padx=5)
        self.memory_file_var = tk.StringVar()
        ttk.Entry(file_frame, textvariable=self.memory_file_var, width=25).pack(side=tk.LEFT, padx=5)
        ttk.Button(file_frame, text="Browse...", command=self.load_memory).pack(side=tk.LEFT, padx=5)
        # Control buttons
        button_frame = ttk.Frame(top_frame)
        button_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Button(button_frame, text="Initialize", command=self.initialize_simulator).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Step", command=self.step_simulator).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Run All", command=self.run_simulator).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Reset", command=self.reset_simulator).pack(side=tk.LEFT, padx=5)
        
        # Cycle counter
        cycle_frame = ttk.Frame(top_frame)
        cycle_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Label(cycle_frame, text="Current Cycle:").pack(side=tk.LEFT, padx=5)
        self.cycle_var = tk.StringVar(value="0")
        ttk.Label(cycle_frame, textvariable=self.cycle_var, font=("Arial", 12, "bold")).pack(side=tk.LEFT, padx=5)
        
        # Middle section - Program view
        program_frame = ttk.LabelFrame(control_frame, text="Program")
        program_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.program_text = scrolledtext.ScrolledText(program_frame, wrap=tk.WORD)
        self.program_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Bottom section - Log
        log_frame = ttk.LabelFrame(control_frame, text="Simulation Log")
        log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, wrap=tk.WORD, height=10)
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

    def create_status_tab(self):
        status_frame = ttk.Frame(self.notebook)
        self.notebook.add(status_frame, text="Status")
        
        # Left side - Register file
        reg_frame = ttk.LabelFrame(status_frame, text="Register File")
        reg_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.reg_text = scrolledtext.ScrolledText(reg_frame, wrap=tk.WORD)
        self.reg_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Right side - Reservation stations
        rs_frame = ttk.LabelFrame(status_frame, text="Reservation Stations")
        rs_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Create table for reservation stations
        columns = ("Name", "Type", "Busy", "Op", "Vj", "Vk", "Qj", "Qk", "Cycles")
        self.rs_table = ttk.Treeview(rs_frame, columns=columns, show="headings")
        
        # Configure columns
        for col in columns:
            self.rs_table.heading(col, text=col)
            self.rs_table.column(col, width=70)
        
        # Add scrollbar
        scrollbar = ttk.Scrollbar(rs_frame, orient=tk.VERTICAL, command=self.rs_table.yview)
        self.rs_table.configure(yscroll=scrollbar.set)
        
        # Pack elements
        self.rs_table.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    
    def create_timing_tab(self):
        timing_frame = ttk.Frame(self.notebook)
        self.notebook.add(timing_frame, text="Timing")
        
        # Create matplotlib figure for timing diagram
        self.timing_fig = Figure(figsize=(10, 8), dpi=100)
        self.timing_ax = self.timing_fig.add_subplot(111)
        
        # Configure the plot
        self.timing_ax.set_xlabel("Cycles")
        self.timing_ax.set_ylabel("Instructions")
        self.timing_ax.set_title("Instruction Timing Diagram")
        
        # Create the canvas
        self.timing_canvas = FigureCanvasTkAgg(self.timing_fig, timing_frame)
        self.timing_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
    def create_memory_tab(self):
        memory_frame = ttk.Frame(self.notebook)
        self.notebook.add(memory_frame, text="Memory")
        # Controls for memory view
        ctrl_frame = ttk.Frame(memory_frame)
        ctrl_frame.pack(fill=tk.X, padx=10, pady=10)
        ttk.Label(ctrl_frame, text="Start Address:").pack(side=tk.LEFT, padx=5)
        self.mem_start_var = tk.StringVar(value="0")
        ttk.Entry(ctrl_frame, textvariable=self.mem_start_var, width=10).pack(side=tk.LEFT, padx=5)
        ttk.Label(ctrl_frame, text="End Address:").pack(side=tk.LEFT, padx=5)
        self.mem_end_var = tk.StringVar(value="50")
        ttk.Entry(ctrl_frame, textvariable=self.mem_end_var, width=10).pack(side=tk.LEFT, padx=5)
        ttk.Button(ctrl_frame, text="View", command=self.update_memory_display).pack(side=tk.LEFT, padx=10)

        

        # Memory display as table

        columns = ("Address", "Value", "Binary", "ASCII")

        self.memory_table = ttk.Treeview(memory_frame, columns=columns, show="headings")

        

        # Configure column headings

        for col in columns:

            self.memory_table.heading(col, text=col)

        

        self.memory_table.column("Address", width=100)

        self.memory_table.column("Value", width=100)

        self.memory_table.column("Binary", width=200)

        self.memory_table.column("ASCII", width=100)

        

        # Add scrollbar

        scrollbar = ttk.Scrollbar(memory_frame, orient=tk.VERTICAL, command=self.memory_table.yview)

        self.memory_table.configure(yscroll=scrollbar.set)

        

        # Pack elements

        self.memory_table.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=10, pady=10)

        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
    def create_stats_tab(self):
        stats_frame = ttk.Frame(self.notebook)
        self.notebook.add(stats_frame, text="Statistics")
        
        # Top section - Performance metrics
        metrics_frame = ttk.LabelFrame(stats_frame, text="Performance Metrics")
        metrics_frame.pack(fill=tk.X, padx=10, pady=10)
        
        # Create metrics display
        self.stats_vars = {}
        metrics = [
            ("Total_Cycles", "Total Cycles:", "0"),
            ("Instructions_Completed", "Instructions Completed:", "0"),
            ("IPC", "IPC (Instructions Per Cycle):", "0.00"),
            ("Branch_Accuracy", "Branch Prediction Accuracy:", "0.00%")
        ]
        
        for i, (key, label, default) in enumerate(metrics):
            ttk.Label(metrics_frame, text=label).grid(row=i, column=0, sticky=tk.W, padx=10, pady=5)
            var = tk.StringVar(value=default)
            ttk.Label(metrics_frame, textvariable=var, font=("Arial", 12, "bold")).grid(row=i, column=1, sticky=tk.W, padx=10, pady=5)
            self.stats_vars[key] = var
        
        # Bottom section - Resource utilization graph
        graph_frame = ttk.LabelFrame(stats_frame, text="Resource Utilization")
        graph_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Create matplotlib figure for statistics
        self.stats_fig = Figure(figsize=(8, 4), dpi=100)
        self.stats_ax = self.stats_fig.add_subplot(111)
        
        # Configure the plot
        self.stats_ax.set_xlabel("Cycles")
        self.stats_ax.set_ylabel("Utilization %")
        self.stats_ax.set_title("Functional Unit Utilization")
        
        # Create the canvas
        self.stats_canvas = FigureCanvasTkAgg(self.stats_fig, graph_frame)
        self.stats_canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

            # Utility functions
    def log(self, message):
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)  # Scroll to the end
    def load_memory(self):
        if not self.simulator:
            self.log("Error: Initialize simulator first")
            return
        filename = filedialog.askopenfilename(
            title="Select Memory Data File",
            filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
        )
        
        if filename:
            try:
                success = self.simulator.load_memory_data(filename)
                if success:
                    self.log(f"Memory data loaded from {filename}")
                else:
                    self.log("Failed to load memory data")
            except Exception as e:
                self.log(f"Error loading memory data: {str(e)}")
    # Action methods
    def load_program(self):
        filename = filedialog.askopenfilename(
            title="Select Program File",
            filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
        )
        
        if filename:
            self.program_file_var.set(filename)
            try:
                with open(filename, 'r') as f:
                    content = f.read()
                    self.program_text.delete(1.0, tk.END)
                    self.program_text.insert(tk.END, content)
                self.log(f"Program loaded from {filename}")
            except Exception as e:
                self.log(f"Error loading program: {str(e)}")
    def initialize_simulator(self):
        if not self.program_file_var.get():
            self.log("Error: No program file selected")
            return
        
        self.log("Initializing simulator...")
        try:
            # Create a new simulator instance
            self.simulator = self.simulator_class()
            
            # Load the program
            self.simulator.load_program(self.program_file_var.get())
            
            # Reset the cycle counter
            self.cycle_var.set("0")
            
            # Update displays
            self.update_all_displays()
            
            self.log("Simulator initialized successfully")
        except Exception as e:
            self.log(f"Error initializing simulator: {str(e)}")
    
    def step_simulator(self):
        if not self.simulator:
            self.log("Error: Simulator not initialized")
            return
        
        try:
            # Execute one cycle
            self.simulator.total_cycle += 1
            self.cycle_var.set(str(self.simulator.total_cycle))
            
            self.log(f"\n==== CYCLE {self.simulator.total_cycle} ====")
            
            # Execute the simulation steps in reverse order
            self.simulator.handle_writeback()
            self.simulator.handle_execution()
            self.simulator.issue_instruction()
            
            # Update displays
            self.update_all_displays()
            
            # Check if simulation is complete
            if self.simulator.is_simulation_complete():
                self.log("Simulation complete!")
        except Exception as e:
            self.log(f"Error during simulation step: {str(e)}")
    
    def run_simulator(self):
        if not self.simulator:
            self.log("Error: Simulator not initialized")
            return
        
        try:
            self.log("Running simulation...")
            
            # Run until completion or safety limit
            max_cycles = 1000  # Safety limit
            
            while (not self.simulator.is_simulation_complete() and 
                   self.simulator.total_cycle < max_cycles):
                # Execute one cycle
                self.simulator.total_cycle += 1
                
                # Execute the simulation steps in reverse order
                self.simulator.handle_writeback()
                self.simulator.handle_execution()
                self.simulator.issue_instruction()
                
                # Update cycle counter occasionally (not every cycle for performance)
                if self.simulator.total_cycle % 10 == 0:
                    self.cycle_var.set(str(self.simulator.total_cycle))
                    self.root.update()
            
            # Final update
            self.cycle_var.set(str(self.simulator.total_cycle))
            self.update_all_displays()
            
            if self.simulator.total_cycle >= max_cycles:
                self.log("Warning: Reached maximum cycle limit")
            else:
                self.log(f"Simulation complete in {self.simulator.total_cycle} cycles")
        except Exception as e:
            self.log(f"Error during simulation: {str(e)}")
    
    def reset_simulator(self):
        self.simulator = None
        self.cycle_var.set("0")
        
        # Clear displays
        self.reg_text.delete(1.0, tk.END)
        
        for item in self.rs_table.get_children():
            self.rs_table.delete(item)
        
        # Clear plots
        self.timing_ax.clear()
        self.timing_ax.set_xlabel("Cycles")
        self.timing_ax.set_ylabel("Instructions")
        self.timing_ax.set_title("Instruction Timing Diagram")
        self.timing_canvas.draw()
        
        self.stats_ax.clear()
        self.stats_ax.set_xlabel("Cycles")
        self.stats_ax.set_ylabel("Utilization %")
        self.stats_ax.set_title("Functional Unit Utilization")
        self.stats_canvas.draw()
        
        # Reset statistics
        for var in self.stats_vars.values():
            var.set("0")
        self.stats_vars["IPC"].set("0.00")
        self.stats_vars["Branch_Accuracy"].set("0.00%")
        
        self.log("Simulator reset")

            # Update display methods
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
        
        self.reg_text.delete(1.0, tk.END)
        self.reg_text.insert(tk.END, self.simulator.register_file.get_status())
    
    def update_reservation_station_display(self):
        if not self.simulator:
            return
        
        # Clear current entries
        for item in self.rs_table.get_children():
            self.rs_table.delete(item)
        
        # Add new entries
        for rs in self.simulator.get_all_reservation_stations():
            self.rs_table.insert("", "end", values=(
                rs.name,
                rs.op_type,
                "Yes" if rs.busy else "No",
                rs.opcode if rs.busy else "",
                rs.vj if rs.vj is not None else "",
                rs.vk if rs.vk is not None else "",
                rs.qj if rs.qj is not None else "",
                rs.qk if rs.qk is not None else "",
                rs.remaining_cycles if rs.busy else ""
            ))
    
    def update_timing_diagram(self):
        if not self.simulator or not hasattr(self.simulator, 'instruction_timing'):
            return
        
        # Clear the current plot
        self.timing_ax.clear()
        
        # Get the instructions and their timing info
        instructions = list(self.simulator.instruction_timing.keys())
        
        if not instructions:
            return
        
        # Set up the y-axis
        y_positions = range(len(instructions))
        self.timing_ax.set_yticks(y_positions)
        self.timing_ax.set_yticklabels([str(inst) for inst in instructions])
        
        # Plot the timing stages for each instruction
        for i, inst in enumerate(instructions):
            timing = self.simulator.instruction_timing[inst]
            
            # Plot issue stage
            if timing['issue'] is not None:
                self.timing_ax.plot([timing['issue']], [i], 'bo', markersize=8)
            
            # Plot execute stage
            if timing['execute_start'] is not None and timing['execute_complete'] is not None:
                self.timing_ax.plot(
                    [timing['execute_start'], timing['execute_complete']], 
                    [i, i], 
                    'r-', 
                    linewidth=2
                )
            
            # Plot writeback stage
            if timing['writeback'] is not None:
                self.timing_ax.plot([timing['writeback']], [i], 'go', markersize=8)
        
        # Set up the x-axis to cover all cycles
        max_cycle = max(
            max([t.get('writeback', 0) or 0 for t in self.simulator.instruction_timing.values()]),
            self.simulator.total_cycle
        ) + 1
        self.timing_ax.set_xlim(0, max_cycle)
        
        # Add legend
        blue_dot = mpatches.Patch(color='blue', label='Issue')
        red_line = mpatches.Patch(color='red', label='Execute')
        green_dot = mpatches.Patch(color='green', label='Writeback')
        self.timing_ax.legend(handles=[blue_dot, red_line, green_dot])
        
        # Set labels
        self.timing_ax.set_xlabel("Cycles")
        self.timing_ax.set_ylabel("Instructions")
        self.timing_ax.set_title("Instruction Timing Diagram")
        
        # Update the canvas
        self.timing_canvas.draw()
    def update_memory_display(self):

        if not self.simulator:

            self.log("Error: Simulator not initialized")

            return

        

        try:

            start_addr = int(self.mem_start_var.get())

            end_addr = int(self.mem_end_var.get())

            

            if start_addr < 0 or end_addr < start_addr:

                self.log("Error: Invalid address range")

                return

                

            # Clear existing items

            for item in self.memory_table.get_children():

                self.memory_table.delete(item)

            

            # Add memory contents

            for addr in range(start_addr, end_addr + 1):

                if addr < len(self.simulator.memory.mem):

                    value = self.simulator.memory.mem[addr]

                    binary = format(value, '016b')  # 16-bit binary representation

                    # Try to interpret as ASCII if in printable range

                    ascii_char = chr(value) if 32 <= value <= 126 else "."

                    

                    self.memory_table.insert("", "end", values=(

                        addr, value, binary, ascii_char

                    ))

            

            self.log(f"Displayed memory range: {start_addr}-{end_addr}")

        except ValueError:

            self.log("Error: Address must be a number")

        except Exception as e:

            self.log(f"Error displaying memory: {str(e)}")
    def update_statistics(self):
        if not self.simulator:
            return
        
        # Update basic statistics
        self.stats_vars["Total_Cycles"].set(str(self.simulator.total_cycle))
        self.stats_vars["Instructions_Completed"].set(str(self.simulator.instructions_completed))
        
        # Calculate IPC
        if self.simulator.total_cycle > 0:
            ipc = self.simulator.instructions_completed / self.simulator.total_cycle
            self.stats_vars["IPC"].set(f"{ipc:.2f}")
        
        # Calculate branch prediction accuracy
        if self.simulator.branches_encountered > 0:
            accuracy = ((self.simulator.branches_encountered - self.simulator.branch_mispredictions) / 
                      self.simulator.branches_encountered * 100)
            self.stats_vars["Branch_Accuracy"].set(f"{accuracy:.2f}%")
        
        # Update resource utilization chart
        self.stats_ax.clear()
        
        # Count busy reservation stations by type
        rs_types = {
            "Load": [rs for rs in self.simulator.LRS],
            "Store": [rs for rs in self.simulator.SRS],
            "Branch": [rs for rs in self.simulator.BEQ],
            "Call/Ret": [rs for rs in self.simulator.CALL_RET],
            "ADD/SUB": [rs for rs in self.simulator.ADD_SUB],
            "MUL": [rs for rs in self.simulator.MUL],
            "NOR": [rs for rs in self.simulator.NOR]
        }
        
        # Calculate utilization percentages
        labels = list(rs_types.keys())
        utilization = []
        
        for rs_type, stations in rs_types.items():
            if stations:
                busy_count = sum(1 for rs in stations if rs.busy)
                utilization.append(busy_count / len(stations) * 100)
            else:
                utilization.append(0)
        
        # Plot utilization
        x_pos = np.arange(len(labels))
        self.stats_ax.bar(x_pos, utilization, align='center', alpha=0.5)
        self.stats_ax.set_xticks(x_pos)
        self.stats_ax.set_xticklabels(labels, rotation=45)
        self.stats_ax.set_ylim(0, 100)
        
        # Set labels
        self.stats_ax.set_xlabel('Functional Unit Type')
        self.stats_ax.set_ylabel('Utilization %')
        self.stats_ax.set_title('Functional Unit Utilization')
        
        # Update the canvas
        self.stats_canvas.draw()
