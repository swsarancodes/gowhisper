; Per-user Windows installer for GoSpell. It installs exactly the managed layout
; that .github/release/install-windows.ps1 creates and src/windows_updater.rs updates:
;
;   %APPDATA%\gospell\versions\<version>\gospell.exe
;   %APPDATA%\gospell\versions\<version>\gospell.com  (the console entry point)
;   %APPDATA%\gospell\bin\gospell.com  (on the user's PATH)
;   %APPDATA%\gospell\current-version
;   %APPDATA%\gospell\install.json  (the direct-install receipt)
;   Start Menu\Programs\GoSpell.lnk  (description "GoSpell managed install")
;
; so the app keeps updating itself from the release service afterwards. The
; uninstaller lives outside versions\ because the updater prunes old version
; directories. Settings, logs, history, and models stay on uninstall, as with
; install-windows.ps1 -Uninstall.
;
; Compile with scripts/build-windows-installer.ps1, which passes:
;   /DAppVersion=2.3.0 /DArch=x64|arm64 /DExecutable=<gospell.exe> /DConsole=<gospell.com>
;   /DOutputDir=<dir> [/DSignedEngineDir=<dir of the signed uninst-*.e32>]
; Console is left out only to wrap a release published before gospell.com.

#ifndef AppVersion
  #error Pass /DAppVersion=<version>
#endif
#ifndef Arch
  #error Pass /DArch=x64 or /DArch=arm64
#endif
#ifndef Executable
  #error Pass /DExecutable=<path to gospell.exe>
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif

#if Arch == "x64"
  #define AllowedArchitectures "x64os"
#elif Arch == "arm64"
  #define AllowedArchitectures "arm64"
#else
  #error Arch must be x64 or arm64
#endif

[Setup]
; Keep this AppId forever: it names the Apps & Features entry that
; src/windows_updater.rs keeps current after self-updates.
AppId={{6ED48C92-5177-41F4-B8D6-37B7B02CFDF4}
AppName=GoSpell
AppVersion={#AppVersion}
AppVerName=GoSpell {#AppVersion}
AppPublisher=GoML
AppPublisherURL=https://goml.io/
AppSupportURL=https://github.com/goml/gospell/issues
AppUpdatesURL=https://github.com/goml/gospell/releases
PrivilegesRequired=lowest
ArchitecturesAllowed={#AllowedArchitectures}
ArchitecturesInstallIn64BitMode={#AllowedArchitectures}
DefaultDirName={userappdata}\gospell
DisableDirPage=yes
UsePreviousAppDir=no
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableWelcomePage=yes
UninstallFilesDir={app}\uninstall
UninstallDisplayName=GoSpell
UninstallDisplayIcon={app}\uninstall\gospell.ico
SetupIconFile=..\..\resources\windows\gospell.ico
WizardStyle=modern
; GoSpell's art (the finished page's side panel and the progress page's
; header mark) at 100% and 200%; Setup picks the one nearest the display's scale.
WizardImageFile=..\..\resources\windows\wizard-image-100.bmp,..\..\resources\windows\wizard-image-200.bmp
WizardSmallImageFile=..\..\resources\windows\wizard-small-100.bmp,..\..\resources\windows\wizard-small-200.bmp
Compression=lzma2/max
SolidCompression=yes
OutputDir={#OutputDir}
OutputBaseFilename=gospell-setup-{#AppVersion}-windows-{#Arch}
CloseApplications=yes
RestartApplications=no
; Adding or removing bin on PATH reaches new terminals without signing out.
ChangesEnvironment=yes
MinVersion=10.0
; Setup runs from a copy of its engine that it extracts to %TEMP%, and the
; uninstaller it writes is another copy of it. Smart App Control
; (VerifiedAndReputableDesktop) blocks an unsigned copy ("Unable to execute
; file in the temporary directory", error 4551), so the engine must be signed.
; SignedUninstaller embeds a signature in it: scripts/build-windows-installer.ps1
; compiles once with -ExtractSignedEngine to leave the unsigned engine ISCC asks
; to have signed, and again with -SignedEngineDir pointing at the signed file.
; Without the define (Test builds) the compile is unchanged and unsigned.
#ifdef SignedEngineDir
SignedUninstaller=yes
SignedUninstallerDir="{#SignedEngineDir}"
#endif

[Files]
Source: "{#Executable}"; DestDir: "{app}\versions\{#AppVersion}"; DestName: "gospell.exe"; Flags: ignoreversion
#ifdef Console
Source: "{#Console}"; DestDir: "{app}\versions\{#AppVersion}"; DestName: "gospell.com"; Flags: ignoreversion
Source: "{#Console}"; DestDir: "{app}\bin"; DestName: "gospell.com"; Flags: ignoreversion
#endif
Source: "..\..\resources\windows\gospell.ico"; DestDir: "{app}\uninstall"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\GoSpell"; Filename: "{app}\versions\{#AppVersion}\gospell.exe"; Parameters: "app"; WorkingDir: "{app}\versions\{#AppVersion}"; Comment: "GoSpell managed install"

[Run]
Filename: "{app}\versions\{#AppVersion}\gospell.exe"; Parameters: "app"; Description: "Open GoSpell"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\versions"
Type: filesandordirs; Name: "{app}\updates"
Type: filesandordirs; Name: "{app}\bin"
Type: files; Name: "{app}\current-version"
Type: files; Name: "{app}\current-version.partial"
Type: files; Name: "{app}\install.json"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  { Installs this version whatever is installed now: versions are never
    compared, and the self-updater follows the channel's current release. }
end;

procedure StopManagedGoSpell();
var
  ResultCode: Integer;
  Versions, Bin: String;
begin
  Versions := ExpandConstant('{app}\versions\');
  StringChangeEx(Versions, '''', '''''', True);
  Bin := ExpandConstant('{app}\bin\');
  StringChangeEx(Bin, '''', '''''', True);
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -WindowStyle Hidden -Command "Get-Process gospell -ErrorAction SilentlyContinue | ' +
    'Where-Object { $_.Path -and ($_.Path.StartsWith(''' + Versions + ''', [StringComparison]::OrdinalIgnoreCase) -or ' +
    '$_.Path.StartsWith(''' + Bin + ''', [StringComparison]::OrdinalIgnoreCase)) } | ' +
    'Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500"',
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

{ An earlier version left running would hold the instance lock. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopManagedGoSpell();
  Result := '';
end;

{ Replaces Path with Contents through a .partial file. }
procedure WriteAtomically(Path, Contents: String);
var
  Partial: String;
begin
  Partial := Path + '.partial';
  DeleteFile(Partial);
  if not SaveStringToFile(Partial, Contents, False) then
    RaiseException('Could not write ' + Partial);
  DeleteFile(Path);
  if not RenameFile(Partial, Path) then
    RaiseException('Could not write ' + Path);
end;

{ The same as UTF-8 without a byte order mark: SaveStringToFile writes the
  ANSI code page, which turns a non-ASCII profile path in install.json into
  bytes GoSpell can't read, so the install stopped updating itself (#1352). }
procedure WriteUtf8Atomically(Path, Contents: String);
var
  Partial: String;
  Lines: TArrayOfString;
begin
  Partial := Path + '.partial';
  DeleteFile(Partial);
  SetArrayLength(Lines, 1);
  Lines[0] := Contents;
  if not SaveStringsToUTF8FileWithoutBOM(Partial, Lines, False) then
    RaiseException('Could not write ' + Partial);
  DeleteFile(Path);
  if not RenameFile(Partial, Path) then
    RaiseException('Could not write ' + Path);
end;

{ Path's entries compared case-insensitively, ignoring a trailing backslash. }
function NormalPath(Path: String): String;
begin
  Result := ';' + AnsiLowercase(Path) + ';';
  StringChangeEx(Result, '\;', ';', True);
end;

function PathHas(Path, Folder: String): Boolean;
begin
  Result := Pos(';' + AnsiLowercase(Folder) + ';', NormalPath(Path)) > 0;
end;

{ Puts bin, where gospell.com lives, on the user's PATH, so a terminal runs `gospell`
  as the console program that waits for gospell.exe. }
procedure AddBinToPath();
var
  Path, Bin: String;
begin
  Bin := ExpandConstant('{app}\bin');
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', Path) then
    Path := '';
  if PathHas(Path, Bin) then
    exit;
  if (Path <> '') and (Copy(Path, Length(Path), 1) <> ';') then
    Path := Path + ';';
  RegWriteExpandStringValue(HKCU, 'Environment', 'Path', Path + Bin);
end;

procedure RemoveBinFromPath();
var
  Path, Bin, Entry, Kept: String;
  At: Integer;
begin
  Bin := ExpandConstant('{app}\bin');
  if not RegQueryStringValue(HKCU, 'Environment', 'Path', Path) then
    exit;
  if not PathHas(Path, Bin) then
    exit;
  { Rebuilt without the entry; the comparison form loses the original case. }
  Path := Path + ';';
  Kept := '';
  while Path <> '' do
  begin
    At := Pos(';', Path);
    Entry := Copy(Path, 1, At - 1);
    Delete(Path, 1, At);
    if (Entry <> '') and not PathHas(Entry, Bin) then
    begin
      if Kept <> '' then
        Kept := Kept + ';';
      Kept := Kept + Entry;
    end;
  end;
  RegWriteExpandStringValue(HKCU, 'Environment', 'Path', Kept);
end;

{ Launch at login names a version's gospell.exe, as src/windows/login_item.rs
  writes it. Point an enabled one at this version, as the app's updater does,
  so signing in doesn't start the version this replaced. A value outside the
  managed versions folder is the user's and stays; a disabled one stays off. }
procedure FollowLaunchAtLogin();
var
  Command: String;
begin
  if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'GoSpell', Command) and
     (Pos(LowerCase(ExpandConstant('{app}\versions\')), LowerCase(Command)) > 0) then
    RegWriteStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'GoSpell',
      '"' + ExpandConstant('{app}\versions\{#AppVersion}\gospell.exe') + '" app --hidden');
end;

{ Point current-version at this version only once its files are in place,
  then mark the install as direct so the app updates itself
  (docs/plans/release-service.md). }
procedure CurStepChanged(CurStep: TSetupStep);
var
  Root: String;
begin
  if CurStep = ssPostInstall then
  begin
    WriteAtomically(ExpandConstant('{app}\current-version'), '{#AppVersion}' + #10);
    Root := ExpandConstant('{app}');
    StringChangeEx(Root, '\', '\\', True);
    WriteUtf8Atomically(ExpandConstant('{app}\install.json'),
      '{"app":"gospell","artifact":"desktop","channel":"stable","method":"direct","root":"' + Root + '"}');
    FollowLaunchAtLogin();
#ifdef Console
    AddBinToPath();
#endif
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Command: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    { Self-updates run from newer version directories this uninstaller did
      not create, so stop any GoSpell running from the managed layout. }
    StopManagedGoSpell();
    if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'GoSpell', Command) and
       (Pos(LowerCase(ExpandConstant('{app}\versions\')), LowerCase(Command)) > 0) then
      RegDeleteValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Run', 'GoSpell');
    RemoveBinFromPath();
  end;
end;
