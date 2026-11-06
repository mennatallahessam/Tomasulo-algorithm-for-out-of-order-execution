import tkinter as tk
from gui import TomasuloGUI
from simulator import TomasuloSimulator  # Import your simulator class

def main():
    # Create the main window
    root = tk.Tk()
    
    # Create the GUI app with your simulator class
    app = TomasuloGUI(root, TomasuloSimulator)
    
    # Run the app
    root.mainloop()

if __name__ == "__main__":
    main()
