import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabaseConfigured } from "./lib/supabase";
import {
  sendCode,
  verifyCode,
  signOut,
  getCurrentUser,
  onAuthChange,
  type ForjaUser,
} from "./lib/auth";
import {
  listMyBuilds,
  listProjects,
  createProject,
  renameProject,
  setProjectColor,
  deleteProject,
  renameBuild,
  deleteBuild,
  setBuildProject,
  importBuild,
  type LibraryBuild,
  type Project,
} from "./lib/builds";

const COLORS = ["#1A5C2A", "#9A6A3C", "#6E5AA8", "#2F6E8F", "#A34A3C", "#7A7268"];

const CSS = `
.fa-root{position:fixed;inset:0;z-index:2147483000;pointer-events:none;font-family:'Inter',system-ui,sans-serif;color:#18181B;}
.fa-root *{box-sizing:border-box;}
.fa-btn{pointer-events:auto;position:fixed;right:20px;bottom:20px;display:inline-flex;align-items:center;gap:8px;background:#1A5C2A;color:#fff;border:none;border-radius:24px;padding:12px 18px;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:600;font-size:14px;cursor:pointer;box-shadow:0 8px 22px rgba(26,92,42,.34);}
.fa-btn:hover{background:#123f1d;}
.fa-avatar{pointer-events:auto;position:fixed;right:20px;bottom:20px;width:52px;height:52px;border-radius:50%;background:#1A5C2A;color:#fff;border:none;display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed','Inter',sans-serif;font-weight:700;font-size:18px;cursor:pointer;box-shadow:0 8px 22px rgba(26,92,42,.34);}
.fa-menu{pointer-events:auto;position:fixed;right:20px;bottom:84px;background:#FBF8F1;border:1px solid #D4CCB8;border-radius:12px;padding:6px;min-width:230px;box-shadow:0 16px 40px rgba(40,30,15,.22);}
.fa-menu .who{padding:10px 12px 8px;border-bottom:1px solid #D4CCB8;margin-bottom:6px;}
.fa-menu .em{font-family:'JetBrains Mono',monospace;font-size:12px;color:#7A7268;word-break:break-all;}
.fa-mi{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;padding:10px 12px;border-radius:8px;font-size:14px;color:#4A4540;cursor:pointer;}
.fa-mi:hover{background:#E8E2D6;}
.fa-mi.danger{color:#8a2318;}
.fa-overlay{pointer-events:auto;position:fixed;inset:0;background:rgba(40,30,15,.42);display:flex;align-items:center;justify-content:center;padding:20px;}
.fa-modal{background:#FBF8F1;border:1px solid #D4CCB8;border-radius:16px;width:100%;max-width:420px;padding:26px;box-shadow:0 24px 60px rgba(40,30,15,.28);}
.fa-cap{font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.08em;font-size:12px;color:#1A5C2A;font-weight:600;}
.fa-modal h2{font-family:'Barlow Condensed','Inter',sans-serif;font-weight:700;font-size:24px;margin:6px 0 6px;}
.fa-modal p{color:#4A4540;font-size:14px;line-height:1.55;margin:0 0 18px;}
.fa-fl{display:block;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-size:12px;color:#7A7268;margin-bottom:7px;}
.fa-in{width:100%;background:#fff;border:1px solid #C0B8A4;border-radius:10px;padding:13px 14px;font-size:15px;font-family:'Inter',sans-serif;color:#18181B;}
.fa-in:focus{outline:none;border-color:#1A5C2A;box-shadow:0 0 0 3px rgba(26,92,42,.14);}
.fa-primary{width:100%;background:#1A5C2A;color:#fff;border:none;border-radius:10px;padding:14px;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.06em;font-weight:600;font-size:15px;margin-top:18px;cursor:pointer;}
.fa-primary:hover{background:#123f1d;}
.fa-primary:disabled{opacity:.6;cursor:default;}
.fa-ghost{width:100%;background:none;color:#7A7268;border:none;border-radius:10px;padding:11px;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:600;font-size:14px;margin-top:8px;cursor:pointer;}
.fa-ghost:hover{background:#E8E2D6;}
.fa-danger{background:#8a2318;}
.fa-danger:hover{background:#6d1a12;}
.fa-row2{display:flex;gap:10px;}
.fa-row2 .fa-primary{margin-top:0;}
.fa-row2 .fa-outline{width:100%;background:none;border:1px solid #C0B8A4;color:#4A4540;border-radius:10px;padding:14px;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:600;font-size:15px;cursor:pointer;}
.fa-pins{display:flex;gap:9px;}
.fa-pins input{width:100%;aspect-ratio:1;text-align:center;font-family:'JetBrains Mono',monospace;font-size:23px;border:1px solid #C0B8A4;border-radius:10px;background:#fff;color:#18181B;}
.fa-pins input:focus{outline:none;border-color:#1A5C2A;box-shadow:0 0 0 3px rgba(26,92,42,.14);}
.fa-err{color:#991B1B;font-size:13px;margin-top:12px;}
.fa-x{background:none;border:none;color:#7A7268;font-size:22px;line-height:1;float:right;cursor:pointer;margin:-6px -6px 0 0;}
.fa-drawer{pointer-events:auto;position:fixed;top:0;right:0;height:100%;width:440px;max-width:94vw;background:#F0EBE0;border-left:1px solid #D4CCB8;display:flex;flex-direction:column;box-shadow:-16px 0 40px rgba(40,30,15,.16);}
.fa-dh{padding:20px 22px;border-bottom:1px solid #D4CCB8;display:flex;align-items:center;justify-content:space-between;}
.fa-dh h2{font-family:'Barlow Condensed','Inter',sans-serif;font-weight:700;font-size:22px;margin:0;text-transform:uppercase;letter-spacing:.03em;}
.fa-dh .cnt{font-size:12px;color:#7A7268;font-family:'JetBrains Mono',monospace;}
.fa-newp{margin:14px 22px 6px;background:none;border:1.5px dashed #C0B8A4;border-radius:12px;padding:12px;width:calc(100% - 44px);font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:600;color:#123f1d;cursor:pointer;font-size:14px;}
.fa-newp:hover{background:#E7EFE7;border-color:#bcd3bc;}
.fa-list{flex:1;overflow:auto;padding:8px 16px 24px;}
.fa-folder{margin:12px 6px 4px;}
.fa-fhead{display:flex;align-items:center;gap:9px;padding:8px 6px;}
.fa-dot{width:12px;height:12px;border-radius:4px;flex:0 0 auto;cursor:pointer;}
.fa-fn{font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:600;font-size:14px;color:#18181B;flex:1;cursor:pointer;}
.fa-fc{font-size:11px;color:#7A7268;font-family:'JetBrains Mono',monospace;}
.fa-pmenu{background:none;border:none;color:#7A7268;cursor:pointer;font-size:16px;padding:2px 4px;}
.fa-fbody{border-left:2px solid #D4CCB8;margin-left:11px;padding-left:6px;}
.fa-card{background:#FBF8F1;border:1px solid #D4CCB8;border-radius:11px;padding:12px 13px;margin:8px 4px;}
.fa-card .nm{font-weight:600;font-size:14.5px;}
.fa-card .dt{font-size:11.5px;color:#7A7268;margin-top:4px;}
.fa-card .actions{display:flex;gap:7px;margin-top:11px;align-items:center;}
.fa-card .actions button{border:1px solid #C0B8A4;background:#F4EFE4;border-radius:8px;padding:7px 9px;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:11.5px;font-weight:600;color:#4A4540;cursor:pointer;display:inline-flex;align-items:center;gap:5px;}
.fa-card .actions button:hover{background:#fff;}
.fa-card .actions .grow{flex:1;justify-content:center;}
.fa-sel{margin-top:9px;width:100%;background:#fff;border:1px solid #D4CCB8;border-radius:8px;padding:7px 9px;font-size:12.5px;color:#4A4540;font-family:'Inter',sans-serif;}
.fa-empty{text-align:center;color:#7A7268;font-size:13.5px;padding:30px 16px;line-height:1.55;}
.fa-banner{pointer-events:auto;position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#FBF8F1;border:1px solid #C0B8A4;border-radius:14px;padding:14px 16px;width:min(540px,92vw);box-shadow:0 18px 44px rgba(40,30,15,.22);display:flex;gap:13px;align-items:center;}
.fa-banner .ic{width:40px;height:40px;border-radius:10px;background:#E7EFE7;color:#123f1d;display:flex;align-items:center;justify-content:center;font-size:20px;flex:0 0 auto;}
.fa-banner .t1{font-weight:600;font-size:14px;}
.fa-banner .t2{font-size:12px;color:#7A7268;margin-top:2px;}
.fa-banner .add{background:#1A5C2A;color:#fff;border:none;border-radius:9px;padding:10px 14px;font-family:'Barlow Condensed','Inter',sans-serif;text-transform:uppercase;letter-spacing:.05em;font-weight:600;font-size:13px;cursor:pointer;white-space:nowrap;}
.fa-toast{pointer-events:none;position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:#18181B;color:#fff;padding:11px 18px;border-radius:10px;font-size:13.5px;box-shadow:0 10px 30px rgba(0,0,0,.25);}
`;

function initials(email: string): string {
  const s = (email || "?").trim();
  const at = s.split("@")[0] || "?";
  const parts = at.split(/[.\-_]/).filter(Boolean);
  const a = (parts[0] || at)[0] || "?";
  const b = parts[1] ? parts[1][0] : (at[1] || "");
  return (a + b).toUpperCase();
}

type PromptState = { title: string; label: string; value: string; cta: string; onSave: (v: string) => void } | null;
type ConfirmState = { title: string; body: string; cta: string; onOk: () => void } | null;

function ForjaAccountsInner() {
  const [user, setUser] = useState<ForjaUser>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [pins, setPins] = useState<string[]>(["", "", "", "", "", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [builds, setBuilds] = useState<LibraryBuild[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [promptVal, setPromptVal] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [importCode, setImportCode] = useState<string | null>(null);
  const [importDismissed, setImportDismissed] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = (m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    let mounted = true;
    getCurrentUser().then((u) => {
      if (mounted) {
        setUser(u);
        setReady(true);
      }
    });
    const unsub = onAuthChange((u) => {
      setUser(u);
    });
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("b");
      if (code) setImportCode(code);
    } catch {
      // ignore
    }
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const refreshLibrary = async () => {
    const [b, p] = await Promise.all([listMyBuilds(), listProjects()]);
    if (b.ok) setBuilds(b.builds);
    if (p.ok) setProjects(p.projects);
  };

  useEffect(() => {
    if (user) refreshLibrary();
    else {
      setBuilds([]);
      setProjects([]);
      setDrawerOpen(false);
      setMenuOpen(false);
    }
  }, [user]);

  if (!supabaseConfigured || !ready) return null;

  const openLogin = () => {
    setErr("");
    setStep("email");
    setPins(["", "", "", "", "", ""]);
    setLoginOpen(true);
  };

  const doSend = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setErr("");
    const r = await sendCode(email);
    setBusy(false);
    if (r.ok) {
      setStep("code");
      setTimeout(() => pinRefs.current[0]?.focus(), 60);
    } else setErr(r.error || "Couldn't send the code. Try again.");
  };

  const doVerify = async () => {
    const token = pins.join("");
    if (token.length < 6) {
      setErr("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setErr("");
    const r = await verifyCode(email, token);
    setBusy(false);
    if (r.ok) {
      setLoginOpen(false);
      showToast("Signed in");
    } else {
      setErr(r.error || "That code didn't work. Check it and try again.");
    }
  };

  const onPin = (i: number, v: string) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const next = [...pins];
    next[i] = digit;
    setPins(next);
    if (digit && i < 5) pinRefs.current[i + 1]?.focus();
  };
  const onPinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pins[i] && i > 0) pinRefs.current[i - 1]?.focus();
  };

  const openBuild = (code: string) => {
    window.location.href = `${window.location.origin}/?b=${code}`;
  };
  const shareBuild = async (code: string) => {
    const link = `${window.location.origin}/?b=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied");
    } catch {
      showToast(link);
    }
  };

  const askNewProject = () => {
    setPromptVal("");
    setPrompt({
      title: "Start a new project",
      label: "Project name",
      value: "",
      cta: "Create project",
      onSave: async (v) => {
        const color = COLORS[projects.length % COLORS.length];
        const r = await createProject(v || "New project", color);
        if (r.ok) {
          await refreshLibrary();
          showToast("Project created");
        } else showToast(r.error || "Couldn't create project");
      },
    });
  };
  const askRenameBuild = (b: LibraryBuild) => {
    setPromptVal(b.name || "");
    setPrompt({
      title: "Rename build",
      label: "Build name",
      value: b.name || "",
      cta: "Save name",
      onSave: async (v) => {
        await renameBuild(b.id, v || "Untitled build");
        await refreshLibrary();
        showToast("Renamed");
      },
    });
  };
  const askRenameProject = (p: Project) => {
    setPromptVal(p.name);
    setPrompt({
      title: "Rename project",
      label: "Project name",
      value: p.name,
      cta: "Save name",
      onSave: async (v) => {
        await renameProject(p.id, v || p.name);
        await refreshLibrary();
        showToast("Renamed");
      },
    });
  };
  const askDeleteBuild = (b: LibraryBuild) => {
    setConfirm({
      title: `Delete “${b.name}”?`,
      body: "This build will be removed from your library.",
      cta: "Delete build",
      onOk: async () => {
        await deleteBuild(b.id);
        await refreshLibrary();
        showToast("Build deleted");
      },
    });
  };
  const askDeleteProject = (p: Project) => {
    setConfirm({
      title: `Delete “${p.name}”?`,
      body: "The builds inside it move to your Personal builds — nothing is deleted.",
      cta: "Delete project",
      onOk: async () => {
        await deleteProject(p.id);
        await refreshLibrary();
        showToast("Project deleted");
      },
    });
  };
  const cycleColor = async (p: Project) => {
    const idx = COLORS.indexOf(p.color || "");
    const color = COLORS[(idx + 1) % COLORS.length];
    await setProjectColor(p.id, color);
    await refreshLibrary();
  };
  const moveBuild = async (b: LibraryBuild, projectId: string) => {
    await setBuildProject(b.id, projectId || null);
    await refreshLibrary();
  };
  const doImport = async () => {
    if (!importCode) return;
    const r = await importBuild(importCode);
    if (r.ok) {
      await refreshLibrary();
      setImportDismissed(true);
      setDrawerOpen(true);
      showToast("Added to your library");
    } else showToast(r.error || "Couldn't add build");
  };

  const groups = useMemo(() => {
    const g = projects.map((p) => ({ project: p, items: builds.filter((b) => b.project_id === p.id) }));
    const personal = builds.filter((b) => !b.project_id);
    return { g, personal };
  }, [projects, builds]);

  const pColor = (b: LibraryBuild) => {
    const p = projects.find((x) => x.id === b.project_id);
    return p?.color || "#7A7268";
  };

  const buildCard = (b: LibraryBuild) => (
    <div className="fa-card" key={b.id}>
      <div className="nm">{b.name || "Untitled build"}</div>
      <div className="dt">{new Date(b.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</div>
      <div className="actions">
        <button className="grow" onClick={() => openBuild(b.code)}>Open</button>
        <button onClick={() => shareBuild(b.code)}>Share</button>
        <button onClick={() => askRenameBuild(b)} aria-label="Rename">Rename</button>
        <button onClick={() => askDeleteBuild(b)} aria-label="Delete" style={{ color: "#8a2318" }}>Delete</button>
      </div>
      <select className="fa-sel" value={b.project_id || ""} onChange={(e) => moveBuild(b, e.target.value)}>
        <option value="">— Personal (no project) —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="fa-root">
      <style>{CSS}</style>

      {/* Floating control */}
      {!user && (
        <button className="fa-btn" onClick={openLogin}>Sign in · save your builds</button>
      )}
      {user && (
        <button className="fa-avatar" onClick={() => setMenuOpen((v) => !v)} aria-label="Account">
          {initials(user.email)}
        </button>
      )}
      {user && menuOpen && (
        <div className="fa-menu">
          <div className="who"><div className="em">{user.email}</div></div>
          <button className="fa-mi" onClick={() => { setMenuOpen(false); setDrawerOpen(true); refreshLibrary(); }}>My builds</button>
          <button className="fa-mi danger" onClick={async () => { setMenuOpen(false); await signOut(); showToast("Signed out"); }}>Sign out</button>
        </div>
      )}

      {/* Import banner */}
      {user && importCode && !importDismissed && (
        <div className="fa-banner">
          <div className="ic">↓</div>
          <div style={{ flex: 1 }}>
            <div className="t1">Add this shared build to your library</div>
            <div className="t2">Saves an editable copy to My Builds — the original stays with its owner.</div>
          </div>
          <button className="add" onClick={doImport}>Add to my library</button>
          <button className="fa-x" onClick={() => setImportDismissed(true)}>×</button>
        </div>
      )}

      {/* Login modal */}
      {loginOpen && (
        <div className="fa-overlay" onClick={(e) => { if (e.target === e.currentTarget) setLoginOpen(false); }}>
          <div className="fa-modal">
            <button className="fa-x" onClick={() => setLoginOpen(false)}>×</button>
            {step === "email" ? (
              <>
                <div className="fa-cap">Forja account</div>
                <h2>Sign in or create your profile</h2>
                <p>Enter your email and we'll send you a 6-digit code. No password to remember.</p>
                <span className="fa-fl">Email address</span>
                <input className="fa-in" type="email" value={email} placeholder="name@email.com"
                  onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") doSend(); }} />
                {err && <div className="fa-err">{err}</div>}
                <button className="fa-primary" disabled={busy} onClick={doSend}>{busy ? "Sending…" : "Send my code"}</button>
              </>
            ) : (
              <>
                <div className="fa-cap">Check your email</div>
                <h2>Enter your code</h2>
                <p>We sent a 6-digit code to <b>{email}</b>. It expires in 1 hour.</p>
                <div className="fa-pins">
                  {pins.map((v, i) => (
                    <input key={i} ref={(el) => (pinRefs.current[i] = el)} inputMode="numeric" maxLength={1}
                      value={v} onChange={(e) => onPin(i, e.target.value)} onKeyDown={(e) => onPinKey(i, e)} />
                  ))}
                </div>
                {err && <div className="fa-err">{err}</div>}
                <button className="fa-primary" disabled={busy} onClick={doVerify}>{busy ? "Verifying…" : "Verify and sign in"}</button>
                <button className="fa-ghost" onClick={() => { setStep("email"); setErr(""); }}>Use a different email</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* My Builds drawer */}
      {user && drawerOpen && (
        <>
          <div className="fa-overlay" style={{ background: "rgba(40,30,15,.3)", justifyContent: "flex-end", padding: 0 }} onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
            <div className="fa-drawer">
              <div className="fa-dh">
                <div><h2>My Builds</h2><div className="cnt">{builds.length} builds · {projects.length} projects</div></div>
                <button className="fa-x" style={{ float: "none", margin: 0 }} onClick={() => setDrawerOpen(false)}>×</button>
              </div>
              <button className="fa-newp" onClick={askNewProject}>+ New project</button>
              <div className="fa-list">
                {builds.length === 0 && (
                  <div className="fa-empty">Your library is empty. Build a racquet and hit Save &amp; Share while signed in — it'll appear here.</div>
                )}
                {groups.g.map(({ project, items }) => (
                  <div className="fa-folder" key={project.id}>
                    <div className="fa-fhead">
                      <span className="fa-dot" style={{ background: project.color || "#7A7268" }} onClick={() => cycleColor(project)} title="Change color" />
                      <span className="fa-fn" onClick={() => setCollapsed((c) => ({ ...c, [project.id]: !c[project.id] }))}>{project.name}</span>
                      <span className="fa-fc">{items.length}</span>
                      <button className="fa-pmenu" onClick={() => askRenameProject(project)} title="Rename">✎</button>
                      <button className="fa-pmenu" onClick={() => askDeleteProject(project)} title="Delete" style={{ color: "#8a2318" }}>🗑</button>
                    </div>
                    {!collapsed[project.id] && (
                      <div className="fa-fbody">
                        {items.length ? items.map(buildCard) : <div className="fa-empty" style={{ padding: "10px 12px" }}>No builds in this project yet</div>}
                      </div>
                    )}
                  </div>
                ))}
                {groups.personal.length > 0 && (
                  <div className="fa-folder">
                    <div className="fa-fhead">
                      <span className="fa-dot" style={{ background: "#7A7268" }} />
                      <span className="fa-fn">Personal builds</span>
                      <span className="fa-fc">{groups.personal.length}</span>
                    </div>
                    <div className="fa-fbody">{groups.personal.map(buildCard)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Prompt modal */}
      {prompt && (
        <div className="fa-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPrompt(null); }}>
          <div className="fa-modal">
            <button className="fa-x" onClick={() => setPrompt(null)}>×</button>
            <div className="fa-cap">Forja</div>
            <h2>{prompt.title}</h2>
            <span className="fa-fl">{prompt.label}</span>
            <input className="fa-in" autoFocus value={promptVal} onChange={(e) => setPromptVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { prompt.onSave(promptVal.trim()); setPrompt(null); } }} />
            <button className="fa-primary" onClick={() => { prompt.onSave(promptVal.trim()); setPrompt(null); }}>{prompt.cta}</button>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirm && (
        <div className="fa-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirm(null); }}>
          <div className="fa-modal">
            <button className="fa-x" onClick={() => setConfirm(null)}>×</button>
            <div className="fa-cap">Confirm</div>
            <h2>{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div className="fa-row2">
              <button className="fa-outline" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="fa-primary fa-danger" style={{ marginTop: 0 }} onClick={() => { confirm.onOk(); setConfirm(null); }}>{confirm.cta}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="fa-toast">{toast}</div>}
    </div>
  );
}

// Hard isolation: if anything in the account layer throws, render nothing
// rather than let it affect the main app.
class SilentBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // swallow — the account layer must never break the spec builder
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function ForjaAccounts() {
  return (
    <SilentBoundary>
      <ForjaAccountsInner />
    </SilentBoundary>
  );
}
