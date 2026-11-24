//! `gospell start` and `gospell restart`'s relaunch on every OS: the only commands
//! that open GoSpell. Everything else in the CLI talks to a GoSpell already running.

#[cfg(not(target_os = "macos"))]
use super::running;
use super::{ControlReply, Output, print};

/// How long `gospell start` keeps watching for a GoSpell to answer after a launch
/// that can't become one has exited.
#[cfg(not(target_os = "macos"))]
const START_GRACE: std::time::Duration = std::time::Duration::from_secs(2);

/// What `gospell start` says when GoSpell runs but hasn't answered yet.
#[cfg(not(target_os = "macos"))]
const STILL_STARTING: &str =
    "Started GoSpell; it isn't answering yet (it may be loading its model)";

/// `gospell start` on macOS: `open`s the GoSpell.app this `gospell` belongs to, then
/// waits until it answers.
#[cfg(target_os = "macos")]
pub(super) fn start(output: Output) -> u8 {
    use std::time::{Duration, Instant};

    if let Some(pid) = crate::local_api::running_pid() {
        return print(
            ControlReply::unchanged(format!("GoSpell is already running (pid {pid})")),
            output,
        );
    }
    let arguments = open_arguments(
        installed_bundle().as_deref(),
        crate::app_paths::is_macos_test_build(),
        std::env::vars_os(),
    );
    match std::process::Command::new("/usr/bin/open")
        .args(arguments)
        .status()
    {
        Ok(status) if status.success() => {}
        Ok(_) | Err(_) => {
            return print(
                ControlReply::error("failed", "couldn't open GoSpell.app; is it installed?"),
                output,
            );
        }
    }
    let started = Instant::now();
    while started.elapsed() < Duration::from_secs(20) {
        if let Some(pid) = crate::local_api::running_pid() {
            return print(
                ControlReply::done(format!("Started GoSpell (pid {pid})")),
                output,
            );
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    print(
        ControlReply::done("Opened GoSpell; it isn't answering yet (setup may be waiting)"),
        output,
    )
}

/// `gospell start` on Linux and Windows: a detached `gospell app --hidden`, which
/// forwards to the running GoSpell, starts its systemd unit, or becomes GoSpell,
/// then waits until it answers.
#[cfg(not(target_os = "macos"))]
pub(super) fn start(output: Output) -> u8 {
    print(start_reply(), output)
}

/// After a restart's quit on Linux and Windows: waits for the old GoSpell to
/// go, then starts the new one. A Linux unit restarts by itself.
#[cfg(not(target_os = "macos"))]
pub(super) fn reopen_after_restart(old: Option<crate::local_api::ExitWatch>) -> ControlReply {
    use std::time::{Duration, Instant};

    #[cfg(target_os = "linux")]
    if crate::linux::service::supervised() {
        return ControlReply::done("Restarting GoSpell");
    }
    // The watch was taken while the old GoSpell still ran, before it got the
    // quit, so it can only be about that process. The local API was the wrong
    // signal: on Windows its discovery file goes first, then the tray, and
    // the instance event last, at process exit; on Linux the service lock is
    // released before that file. A successor launched into any of it exited
    // at once because another GoSpell still held what it needed.
    let gone = match old {
        Some(process) => process.wait(Duration::from_secs(30)),
        None => {
            let started = Instant::now();
            while running() && started.elapsed() <= Duration::from_secs(30) {
                std::thread::sleep(Duration::from_millis(200));
            }
            !running()
        }
    };
    if !gone {
        return ControlReply::error(
            "failed",
            "GoSpell is still finishing its work; run `gospell start` once it quits",
        );
    }
    start_reply()
}

#[cfg(not(target_os = "macos"))]
fn start_reply() -> ControlReply {
    use std::time::{Duration, Instant};

    if running() {
        return ControlReply::unchanged("GoSpell is already running");
    }
    #[cfg(target_os = "linux")]
    if crate::linux::service::instance_answers() {
        return super::older_gospell();
    }
    let executable = match std::env::current_exe() {
        Ok(executable) => executable,
        Err(error) => {
            return ControlReply::error("failed", format!("couldn't find gospell: {error}"));
        }
    };
    let mut command = std::process::Command::new(executable);
    command
        .args(["app", "--hidden"])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(target_os = "linux")]
    std::os::unix::process::CommandExt::process_group(&mut command, 0);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP: no console, and
        // Ctrl-C in this terminal doesn't reach it.
        command.creation_flags(0x0000_0008 | 0x0000_0200);
    }
    // A Windows `gospell app` from a 2.3.1 install's layout starts the managed
    // copy and exits instead of becoming GoSpell, so its exit is a start in
    // progress. Asked before the spawn, because that is the launch it
    // describes.
    #[cfg(target_os = "windows")]
    let legacy_handoff = crate::updater::legacy::will_take_over();
    #[cfg(not(target_os = "windows"))]
    let legacy_handoff = false;
    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(error) => {
            return ControlReply::error("failed", format!("couldn't start GoSpell: {error}"));
        }
    };
    let started = Instant::now();
    let mut exited = None;
    let mut give_up_at = started + Duration::from_secs(20);
    // A `gospell app` that exits is not proof that GoSpell failed: on Linux it
    // forwards to the systemd unit and exits once the forward is accepted,
    // and on Windows a 2.3.1 install starts the managed copy and exits. So
    // keep watching for a GoSpell to answer after the exit; only a launch that
    // can't become one gives up, and it gets a short grace first so the
    // successor of a GoSpell still finishing its drain is seen if it does arrive.
    loop {
        if running() {
            return ControlReply::done("Started GoSpell");
        }
        if exited.is_none()
            && let Ok(Some(status)) = child.try_wait()
        {
            exited = Some(status);
            if !forwards_to_gospell(status, legacy_handoff) {
                // Keep watching for the short grace, but never past the
                // ordinary wait.
                give_up_at = (Instant::now() + START_GRACE).min(started + Duration::from_secs(20));
            }
        }
        if Instant::now() >= give_up_at {
            break;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    match exited {
        // The GoSpell such a launch starts may only be starting; answer as the
        // ordinary wait does rather than calling the handoff a failure.
        Some(status) if forwards_to_gospell(status, legacy_handoff) => {
            ControlReply::done(STILL_STARTING)
        }
        // A successful launch that yielded found another GoSpell holding the
        // instance; a failed one never became GoSpell at all.
        Some(status) if status.success() => ControlReply::error(
            "failed",
            "GoSpell started and exited right away; another GoSpell is probably still shutting \
             down, so run `gospell start` again",
        ),
        Some(status) => ControlReply::error(
            "failed",
            format!(
                "GoSpell exited right away ({status}); see process.log, then run `gospell start` again"
            ),
        ),
        None => ControlReply::done(STILL_STARTING),
    }
}

/// Whether a `gospell app` that exited successfully can still become the GoSpell the
/// caller waited for: on Linux it forwards to the systemd unit (a 2.3.1
/// install replaces that process instead, so it never returns), and on
/// Windows a 2.3.1 install starts the managed copy in the background and
/// exits.
#[cfg(not(target_os = "macos"))]
fn forwards_to_gospell(status: std::process::ExitStatus, legacy_handoff: bool) -> bool {
    status.success() && (cfg!(target_os = "linux") || legacy_handoff)
}

/// `open` arguments for `gospell start`: the caller's `GOSPELL_*` environment, then
/// the GoSpell.app this `gospell` belongs to, or the installed app by bundle id.
#[cfg(target_os = "macos")]
fn open_arguments(
    bundle: Option<&std::path::Path>,
    test_build: bool,
    vars: impl IntoIterator<Item = (std::ffi::OsString, std::ffi::OsString)>,
) -> Vec<std::ffi::OsString> {
    let mut arguments = crate::desktop::onboarding::open_env_arguments(vars);
    match bundle {
        Some(bundle) => arguments.push(bundle.into()),
        None => arguments.extend([
            "-b".into(),
            if test_build {
                "com.goml.gospell.test"
            } else {
                "com.goml.gospell"
            }
            .into(),
        ]),
    }
    arguments
}

/// The GoSpell.app this `gospell` belongs to, when it runs from (or links into) one.
#[cfg(target_os = "macos")]
fn installed_bundle() -> Option<std::path::PathBuf> {
    let executable = std::fs::canonicalize(std::env::current_exe().ok()?).ok()?;
    executable
        .ancestors()
        .nth(3)
        .filter(|path| path.extension().is_some_and(|extension| extension == "app"))
        .map(ToOwned::to_owned)
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::open_arguments;

    #[test]
    fn start_forwards_the_callers_gospell_environment() {
        let vars = || {
            [
                ("HOME", "/Users/alex"),
                ("GOSPELL_RETAIN_DICTATION_AUDIO", "1"),
                ("GOSPELL_ENABLE_LLM", "1"),
            ]
            .map(|(key, value)| (key.into(), value.into()))
        };
        let strings = |arguments: Vec<std::ffi::OsString>| {
            arguments
                .into_iter()
                .map(|argument| argument.into_string().unwrap())
                .collect::<Vec<_>>()
        };
        let env = [
            "--env",
            "GOSPELL_ENABLE_LLM=1",
            "--env",
            "GOSPELL_RETAIN_DICTATION_AUDIO=1",
        ];
        let bundle = std::path::Path::new("/Applications/GoSpell.app");
        assert_eq!(
            strings(open_arguments(Some(bundle), false, vars())),
            [&env[..], &["/Applications/GoSpell.app"]].concat()
        );
        assert_eq!(
            strings(open_arguments(None, false, vars())),
            [&env[..], &["-b", "com.goml.gospell"]].concat()
        );
        assert_eq!(
            strings(open_arguments(None, true, [])),
            ["-b", "com.goml.gospell.test"]
        );
    }
}
