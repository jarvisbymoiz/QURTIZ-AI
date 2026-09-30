Option Explicit
Dim shell, folder, root, command
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(CreateObject("Scripting.FileSystemObject").GetParentFolderName(folder))
command = """" & root & "\node.exe"" """ & root & "\companion\windows\start.mjs"""
shell.Run command, 0, False
