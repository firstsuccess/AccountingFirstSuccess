#define MyAppName "もんじゃ会計"
#define MyAppVersion "1.0.0"
#define MyAppId "MonjaAccounting"
#define SourceRoot "C:\accounting"

[Setup]
AppId={{A5D8A6B1-8D63-4D0E-A71E-21F5F916C12E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\MonjaAccounting
DefaultGroupName={#MyAppName}
OutputDir=Output
OutputBaseFilename=MonjaAccountingSetup-{#MyAppVersion}
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
UninstallDisplayName={#MyAppName}
SetupLogging=yes
CloseApplications=no
RestartApplications=no
DisableDirPage=no

[Dirs]
Name: "{app}\logs"
Name: "{commonappdata}\MonjaAccounting"; Permissions: admins-full

[Files]
; .gitignore-aligned distribution policy (allowlist, not a blanket copy):
; EXCLUDED: .env, .env.*, users.json, logs/, *.log, *.bak, *.bak.*, .git/
; OPTIONAL ALLOWED: .env.example (non-secret sample only).
; EXCEPTION: node_modules/ is intentionally bundled because mssql and its
; dependencies are required at runtime; do not apply the Git ignore rule here.
; Review the contents of runtime dependencies and licenses before distribution.
; Application: include only the explicitly listed runtime files.
Source: "{#SourceRoot}\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SourceRoot}\package.json"; DestDir: "{app}"; Flags: ignoreversion
#ifexist "C:\accounting\.env.example"
Source: "{#SourceRoot}\.env.example"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist
#endif
#ifexist "C:\accounting\.env.sample"
Source: "{#SourceRoot}\.env.sample"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist
#endif
Source: "{#SourceRoot}\node_modules\*"; DestDir: "{app}\node_modules"; Excludes: ".env,.env.*,users.json,*.log,*.bak,*.bak.*,logs\*,.git\*"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#SourceRoot}\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "{#SourceRoot}\service\MonjaAccounting.exe"; DestDir: "{app}\service"; Flags: ignoreversion
Source: "{#SourceRoot}\service\MonjaAccounting.xml"; DestDir: "{app}\service"; Flags: ignoreversion
; Additional documentation and deployment resources (included when present).
#ifexist "C:\accounting\readme.docx"
Source: "{#SourceRoot}\readme.docx"; DestDir: "{app}"; Flags: ignoreversion
#endif
#ifexist "C:\accounting\機能一覧.xlsx"
Source: "{#SourceRoot}\機能一覧.xlsx"; DestDir: "{app}"; Flags: ignoreversion
#endif
#ifexist "C:\accounting\README.md"
Source: "{#SourceRoot}\README.md"; DestDir: "{app}"; Flags: ignoreversion
#endif
#ifexist "C:\accounting\LICENSE"
Source: "{#SourceRoot}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
#endif
#if DirExists("C:\accounting\sql")
Source: "{#SourceRoot}\sql\*"; DestDir: "{app}\sql"; Excludes: "*.env,*.env.*,*.bak,*.bak.*,*.log"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
#if DirExists("C:\accounting\iis")
Source: "{#SourceRoot}\iis\*"; DestDir: "{app}\iis"; Excludes: "*.env,*.env.*,*.bak,*.bak.*,*.log"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif
; SQL scripts and IIS configuration are copied only, not automatically executed.
; Additional runtime files must be explicitly reviewed and added if server.js imports them.
; Licenses: supply these files before compiling a distributable build.
Source: "{#SourceRoot}\installer\licenses\*"; DestDir: "{app}\licenses"; Flags: ignoreversion recursesubdirs createallsubdirs
; Helpers extracted to temp for pre-copy operations, and installed for uninstall.
Source: "{#SourceRoot}\installer\scripts\service-maintenance.ps1"; Flags: dontcopy
Source: "{#SourceRoot}\installer\scripts\service-maintenance.ps1"; DestDir: "{app}\installer"; Flags: ignoreversion
; サーバー側共通ライブラリ
Source: "{#SourceRoot}\lib\*"; DestDir: "{app}\lib"; Flags: ignoreversion recursesubdirs createallsubdirs

; Web画面一式
Source: "{#SourceRoot}\public\*"; DestDir: "{app}\public"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\設定フォルダー"; Filename: "{sys}\explorer.exe"; Parameters: """{commonappdata}\MonjaAccounting"""

[Code]
var
  ExistingService: Boolean;
  WasRunning: Boolean;
  PreviousInstallDir: String;

function RunHelper(const ScriptPath, Operation, InstallDir, StateFile: String): Boolean;
var
  ResultCode: Integer;
  Params: String;
begin
  Params := '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + ScriptPath +
    '" -Operation ' + Operation + ' -InstallDir "' + InstallDir +
    '" -StateFile "' + StateFile + '"';
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    Params, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Helper, StateFile: String;
begin
  Result := '';
  ExtractTemporaryFile('service-maintenance.ps1');
  Helper := ExpandConstant('{tmp}\service-maintenance.ps1');
  StateFile := ExpandConstant('{tmp}\monja-service-state.txt');
  if not RunHelper(Helper, 'before', ExpandConstant('{app}'), StateFile) then
    Result := 'Windowsサービスの停止に失敗しました。ログとサービス状態を確認してください。インストールは中止します。';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Helper, StateFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    Helper := ExpandConstant('{app}\installer\service-maintenance.ps1');
    StateFile := ExpandConstant('{tmp}\monja-service-state.txt');
    if not RunHelper(Helper, 'after', ExpandConstant('{app}'), StateFile) then
      MsgBox('ファイルは配置されましたが、サービスの登録または復旧に失敗しました。管理者としてサービス状態を確認してください。', mbError, MB_OK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Helper, StateFile: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    Helper := ExpandConstant('{app}\installer\service-maintenance.ps1');
    StateFile := ExpandConstant('{tmp}\monja-uninstall-state.txt');
    if FileExists(Helper) then
      if not RunHelper(Helper, 'uninstall', ExpandConstant('{app}'), StateFile) then
        MsgBox('サービスの削除に失敗しました。残存サービスを手動で確認してください。', mbError, MB_OK);
  end;
end;

[UninstallDelete]
; Deliberately do not delete {commonappdata}\MonjaAccounting or SQL Server data.
; .env is not packaged and is deliberately not listed for deletion.
