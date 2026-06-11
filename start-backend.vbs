Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d C:\Users\26436\WorkBuddy\2026-05-27-17-47-54\颐智康养\backend && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000", 0, False
