LICENSE RETRIEVAL GUIDE
1. Open PowerShell on the Windows development PC with internet access.
2. Run: cd C:\accounting; .\installer\Get-Licenses.ps1
3. The script downloads the original Node.js v24.21.0 license and WinSW v3 license, and copies license/notice files from installed npm dependencies.
4. Check the installed WinSW executable's version. If it is WinSW 2.x, replace the WinSW license with the one from its exact release/tag.
5. Review installer\licenses\REVIEW-REQUIRED.json, and investigate any missing LICENSE/NOTICE, unusual licenses, and nested bundled third-party components.
6. Ensure installer\MonjaAccounting.iss actually includes the generated licenses directory before publishing. The script does not modify the .iss file.
7. This script requires internet access on the development PC and does not download npm packages.
