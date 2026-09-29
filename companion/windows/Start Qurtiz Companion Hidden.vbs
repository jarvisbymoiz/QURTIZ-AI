Option Explicit
Dim shell, folder, command
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = """" & folder & "\node.exe"" """ & folder & "\companion\windows\start.mjs"""
shell.Run command, 0, False
