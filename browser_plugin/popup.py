import tkinter as tk
from tkinter import messagebox

def show_popup(message="💡 We zagen dat je AI hebt gebruikt. Wil je kort uitleggen hoe je het hebt ingezet?"):
    popup = tk.Toplevel(root)
    popup.title("Kritikos")
    popup_width = 480
    popup_height = 240

    screen_width = root.winfo_screenwidth()

    x = int((screen_width / 2) - (popup_width / 2))
    y = 70

    popup.geometry(f"{popup_width}x{popup_height}+{x}+{y}")
    popup.configure(bg="#f0faff")  

    header = tk.Label(
        popup,
        text="🤖 Kritikos",
        font=("Segoe UI", 14, "bold"),
        fg="#0077b6",
        bg="#f0faff"
    )
    header.pack(pady=(15, 5))

    msg = tk.Label(
        popup,
        text=message,
        font=("Segoe UI", 11),
        fg="#023e8a",
        bg="#f0faff",
        wraplength=popup_width - 40,
        justify="center"
    )
    msg.pack(pady=10, padx=20)

    entry = tk.Entry(
        popup,
        width=50,
        font=("Segoe UI", 11),
        relief="solid",
        bg="white",
        fg="black",
        insertbackground="black"
    )
    entry.pack(pady=10, ipady=5)

    def submit():
        user_input = entry.get().strip()
        if not user_input:
            messagebox.showinfo("Tip", "Probeer even kort op te schrijven hoe AI je geholpen heeft 😊")
            return
        print("Student schreef:", user_input)  
        popup.destroy()

    submit_btn = tk.Button(
        popup,
        text="Versturen",
        command=submit,
        font=("Segoe UI", 11, "bold"),
        bg="#00b4d8",
        fg="white",
        relief="flat",
        activebackground="#0096c7",
        activeforeground="white",
        padx=10,
        pady=5
    )
    submit_btn.pack(pady=15)

    popup.protocol("WM_DELETE_WINDOW", lambda: None)

    entry.focus_set()

root = tk.Tk()
root.withdraw()  

show_popup("💡 Het lijkt erop dat je AI hebt gebruikt. Zou je kort kunnen beschrijven hoe dit jouw werk heeft ondersteund? Zo leer je zelf ook kritischer nadenken ✨")

root.mainloop()
