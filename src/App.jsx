import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

function detectColumns(headers) {
  const h = headers.map((v) => String(v ?? "").toLowerCase().trim());
  const score = (keywords) => (col) =>
    keywords.reduce((s, k) => s + (col.includes(k) ? 1 : 0), 0);

  const rollScore = score(["roll", "rollno", "roll no", "roll number", "rollnumber"]);
  const regScore  = score(["reg", "regno", "reg no", "register", "registration", "enroll"]);
  const nameScore = score(["name", "student", "sname", "full name", "fullname"]);

  const best = (scoreFn) => {
    let bestScore = -1, idx = -1;
    h.forEach((v, i) => {
      const s = scoreFn(v);
      if (s > bestScore) { bestScore = s; idx = i; }
    });
    return bestScore > 0 ? idx : -1;
  };

  return { rollIdx: best(rollScore), regIdx: best(regScore), nameIdx: best(nameScore) };
}

function parseStudents(rows) {
  if (!rows || rows.length < 2) return null;

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const nonEmpty = rows[i].filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (nonEmpty.length >= 2) { headerRowIdx = i; break; }
  }

  const headers = rows[headerRowIdx].map((v) => String(v ?? ""));
  const { rollIdx, regIdx, nameIdx } = detectColumns(headers);

  if (nameIdx === -1 && rollIdx === -1) return null;

  const students = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = nameIdx !== -1 ? String(row[nameIdx] ?? "").trim() : "";
    const roll = rollIdx !== -1 ? String(row[rollIdx] ?? "").trim() : "";
    const reg  = regIdx  !== -1 ? String(row[regIdx]  ?? "").trim() : "N/A";

    if (!name && !roll) continue;

    students.push({ id: i - headerRowIdx, roll: roll || `S${i}`, reg, name: name || roll });
  }
  return students.length > 0 ? students : null;
}

const STORAGE_KEY = "attendance-tracker-students";

// ── Upload Screen ─────────────────────────────────────────────────────────────
function UploadScreen({ onStudentsLoaded }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const inputRef                = useRef();

  const processFile = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      setError("Please upload an Excel (.xlsx / .xls) or CSV file.");
      return;
    }
    setLoading(true);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const students = parseStudents(rows);
        if (!students) {
          setError("Couldn't find student data. Make sure your sheet has Name and/or Roll Number columns.");
          setLoading(false);
          return;
        }
        onStudentsLoaded(students);
      } catch {
        setError("Failed to read file. Please check the format.");
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [onStudentsLoaded]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, [processFile]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F2F2F7",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "24px 20px",
    }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: "linear-gradient(135deg, #1C3D72 0%, #2563EB 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 32px rgba(37,99,235,0.3)",
            fontSize: 36,
          }}>📋</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1C1C1E", margin: 0 }}>
            UNI ATTENDANCE
          </h1>
          <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 8, lineHeight: 1.5 }}>
            Upload your class Excel sheet to get started.<br />
            We'll auto-detect your student list.
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2.5px dashed ${dragging ? "#2563EB" : "#C7C7CC"}`,
            borderRadius: 24,
            background: dragging ? "rgba(37,99,235,0.05)" : "#fff",
            padding: "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: dragging
              ? "0 0 0 4px rgba(37,99,235,0.1)"
              : "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: "none" }}
            onChange={(e) => processFile(e.target.files[0])}
          />
          {loading ? (
            <div>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1E" }}>Reading your file…</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 52, marginBottom: 14 }}>📂</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E", marginBottom: 6 }}>
                Drag & drop your Excel sheet
              </div>
              <div style={{ fontSize: 14, color: "#8E8E93" }}>or tap to browse</div>
              <div style={{ marginTop: 16 }}>
                <span style={{
                  display: "inline-block",
                  background: "linear-gradient(135deg, #1C3D72 0%, #2563EB 100%)",
                  color: "#fff", padding: "12px 28px", borderRadius: 14,
                  fontSize: 15, fontWeight: 700,
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                }}>Choose File</span>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: "#C7C7CC" }}>
                Supports .xlsx · .xls · .csv
              </div>
            </>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 16,
            background: "rgba(255,59,48,0.08)",
            border: "1.5px solid rgba(255,59,48,0.3)",
            borderRadius: 14, padding: "12px 16px",
            fontSize: 14, color: "#FF3B30", fontWeight: 600, textAlign: "center",
          }}>⚠️ {error}</div>
        )}

        <div style={{
          marginTop: 20,
          background: "rgba(37,99,235,0.06)",
          border: "1.5px solid rgba(37,99,235,0.15)",
          borderRadius: 16, padding: "14px 16px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", marginBottom: 6 }}>
            💡 Format Tips
          </div>
          <div style={{ fontSize: 13, color: "#636366", lineHeight: 1.7 }}>
            Your sheet should have columns like:<br />
            <strong>Name</strong>, <strong>Roll No.</strong>, <strong>Reg No.</strong><br />
            Column names are detected automatically — exact names don't matter.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Attendance App ───────────────────────────────────────────────────────
// status: "present" | "absent" | "od"
function AttendanceApp({ students, onReset }) {
  const today = new Date();
  // status map: id -> "present" | "absent" | "od"
  const [status, setStatus]     = useState(() => {
    const m = {};
    students.forEach((s) => { m[s.id] = "present"; });
    return m;
  });
  const [date, setDate]         = useState(today.toISOString().split("T")[0]);
  const [view, setView]         = useState("attendance");
  const [copied, setCopied]     = useState(false);
  const [search, setSearch]     = useState("");
  const [showModal, setShowModal]           = useState(false);
  const [numFormat, setNumFormat]           = useState(null);
  const [sortBy, setSortBy]                 = useState("default");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Cycle: present → absent → od → present
  const cycle = (id) => setStatus((prev) => {
    const cur = prev[id] || "present";
    const next = cur === "present" ? "absent" : cur === "absent" ? "od" : "present";
    return { ...prev, [id]: next };
  });

  // Set OD directly via OD button
  const toggleOD = (id, e) => {
    e.stopPropagation();
    setStatus((prev) => ({
      ...prev,
      [id]: prev[id] === "od" ? "present" : "od",
    }));
  };

  const markAll = (val) => {
    const m = {};
    students.forEach((s) => { m[s.id] = val; });
    setStatus(m);
  };

  const absentees    = students.filter((s) => (status[s.id] || "present") === "absent");
  const odStudents   = students.filter((s) => (status[s.id] || "present") === "od");
  const presentCount = students.length - absentees.length; // OD counted as present
  const absentCount  = absentees.length;
  const odCount      = odStudents.length;
  const displayDate  = fmtDate(date);

  const sortByRoll   = (arr) => [...arr].sort((a, b) => a.roll.localeCompare(b.roll));

  const buildMessage = (fmt) => {
    const sortedAbsent = sortByRoll(absentees);
    const sortedOD     = sortByRoll(odStudents);
    const fmtStudent = (s, i) => {
      if (fmt === "roll") return `${i + 1}. ${s.name} (${s.roll})`;
      if (fmt === "reg")  return `${i + 1}. ${s.name} (${s.reg})`;
      if (fmt === "both") return `${i + 1}. ${s.name} | Roll: ${s.roll} | Reg: ${s.reg}`;
      return `${i + 1}. ${s.name}`;
    };

    const absentSection = absentCount > 0
      ? `*Absentees (sorted by Roll No.):*\n${sortedAbsent.map((s, i) => fmtStudent(s, i)).join("\n")}`
      : `✅ No Absentees`;

    const odSection = odCount > 0
      ? `\n\n*On Duty (OD):*\n${sortedOD.map((s, i) => fmtStudent(s, i)).join("\n")}`
      : "";

    return absentCount === 0 && odCount === 0
      ? `📋 *Attendance Report*\n📅 Date: ${displayDate}\n\n✅ Full Attendance! All ${students.length} students were present.\n\n_Made with Uni Attendance_`
      : `📋 *Attendance Report*\n📅 Date: ${displayDate}\n\n👥 Total Students: ${students.length}\n✅ Present: ${presentCount}\n❌ Absent: ${absentCount}${odCount > 0 ? `\n🔵 On Duty: ${odCount}` : ""}\n\n${absentSection}${odSection}\n\n_Made with Uni Attendance_`;
  };

  const message = buildMessage(numFormat || "roll");

  const handleGenerateClick = () =>
    (absentCount === 0 && odCount === 0) ? setView("message") : setShowModal(true);
  const handleFormatSelect  = (fmt) => {
    setNumFormat(fmt); setShowModal(false); setView("message");
  };
  const handleCopy = () =>
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  const handleWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");

  const hasRoll = students.some((s) => s.roll && s.roll !== "N/A");
  const hasReg  = students.some((s) => s.reg  && s.reg  !== "N/A");

  const filtered = students
    .filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.roll.includes(search) ||
      s.reg.includes(search)
    )
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "roll") return a.roll.localeCompare(b.roll);
      if (sortBy === "reg")  return a.reg.localeCompare(b.reg);
      return a.id - b.id;
    });

  return (
    <div style={{
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
      background: "#F2F2F7",
      minHeight: "100vh",
      maxWidth: 430,
      margin: "0 auto",
      paddingBottom: 80,
    }}>

      {/* Number Format Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }} onClick={() => setShowModal(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "100%", maxWidth: 430,
            background: "#fff",
            borderTopLeftRadius: 28, borderTopRightRadius: 28,
            padding: "24px 20px 40px",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          }}>
            <div style={{ width: 36, height: 4, background: "#E0E0E5", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", marginBottom: 6 }}>
              Format Absentee List
            </div>
            <div style={{ fontSize: 14, color: "#8E8E93", marginBottom: 22 }}>
              How would you like to identify absent students?<br />
              (Always sorted by Roll No. ↑)
            </div>
            {[
              hasReg  && { fmt: "reg",  icon: "🎓", label: "Register Number", sub: "e.g. 1. John Doe (23112032)" },
              hasRoll && { fmt: "roll", icon: "🆔", label: "Roll Number",      sub: "e.g. 1. John Doe (23CU0310006)" },
              (hasRoll && hasReg) && { fmt: "both", icon: "📄", label: "Both Numbers", sub: "e.g. 1. John Doe | Roll: … | Reg: …" },
              { fmt: "none", icon: "👤", label: "Name Only", sub: "e.g. 1. John Doe" },
            ].filter(Boolean).map(({ fmt, icon, label, sub }) => (
              <button key={fmt} onClick={() => handleFormatSelect(fmt)} style={{
                width: "100%",
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", marginBottom: 10,
                background: numFormat === fmt ? "rgba(37,99,235,0.08)" : "#F7F7FA",
                border: numFormat === fmt ? "2px solid #2563EB" : "2px solid transparent",
                borderRadius: 16, cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontSize: 26 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>{sub}</div>
                </div>
                {numFormat === fmt && (
                  <span style={{ marginLeft: "auto", color: "#2563EB", fontSize: 18 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      {showResetConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }} onClick={() => setShowResetConfirm(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 24, padding: "28px 24px",
            maxWidth: 340, width: "100%",
            boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🔄</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1E", marginBottom: 8 }}>
              Load New Class?
            </div>
            <div style={{ fontSize: 14, color: "#8E8E93", marginBottom: 24, lineHeight: 1.5 }}>
              This will remove the current class list. You'll be able to upload a new Excel sheet.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowResetConfirm(false)} style={{
                flex: 1, padding: "13px 0",
                background: "#F2F2F7", color: "#1C1C1E",
                border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={onReset} style={{
                flex: 1, padding: "13px 0",
                background: "#FF3B30", color: "#fff",
                border: "none", borderRadius: 14,
                fontSize: 15, fontWeight: 700, cursor: "pointer",
              }}>Reset</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 12, background: "#fff" }} />

      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #1C3D72 0%, #2563EB 100%)",
        padding: "20px 20px 24px", color: "#fff",
        borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
        boxShadow: "0 4px 24px rgba(37,99,235,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: 1, textTransform: "uppercase" }}>
            UNI ATTENDANCE
          </div>
          <button onClick={() => setShowResetConfirm(true)} style={{
            background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10,
            color: "#fff", fontSize: 12, fontWeight: 600,
            padding: "6px 12px", cursor: "pointer", backdropFilter: "blur(10px)",
          }}>📂 New Class</button>
        </div>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 16 }}>
          Take Attendance
          <span style={{ fontSize: 14, opacity: 0.7, marginLeft: 10, fontWeight: 500 }}>
            ({students.length} students)
          </span>
        </div>

        {/* Date Picker */}
        <div style={{
          background: "rgba(255,255,255,0.15)", borderRadius: 14,
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 16, backdropFilter: "blur(10px)",
        }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <input
            type="date" value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: "transparent", border: "none",
              color: "#fff", fontSize: 16, fontWeight: 600,
              outline: "none", flex: 1, colorScheme: "dark",
            }}
          />
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Total",   val: students.length, color: "rgba(255,255,255,0.2)" },
            { label: "Present", val: presentCount,     color: "rgba(52,199,89,0.3)"  },
            { label: "Absent",  val: absentCount,      color: "rgba(255,69,58,0.3)"  },
            { label: "OD",      val: odCount,          color: "rgba(37,99,235,0.35)" },
          ].map((s) => (
            <div key={s.label} style={{
              flex: 1, background: s.color, borderRadius: 14,
              padding: "10px 4px", textAlign: "center", backdropFilter: "blur(10px)",
            }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{s.val}</div>
              <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab Switch */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ background: "#E4E4EB", borderRadius: 12, padding: 3, display: "flex" }}>
          {["attendance", "message"].map((tab) => (
            <button key={tab} onClick={() => setView(tab)} style={{
              flex: 1, padding: "9px 0", borderRadius: 10,
              border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 14, transition: "all 0.2s",
              background: view === tab ? "#fff" : "transparent",
              color: view === tab ? "#1C3D72" : "#8E8E93",
              boxShadow: view === tab ? "0 1px 6px rgba(0,0,0,0.12)" : "none",
            }}>
              {tab === "attendance" ? "📋 Attendance" : "💬 Message"}
            </button>
          ))}
        </div>
      </div>

      {view === "attendance" && (
        <>
          {/* Search + Mark All */}
          <div style={{ padding: "12px 16px 0", display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              flex: 1, background: "#fff", borderRadius: 12,
              display: "flex", alignItems: "center",
              padding: "10px 12px", gap: 8,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <span style={{ fontSize: 16 }}>🔍</span>
              <input
                placeholder="Search student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "none", outline: "none",
                  fontSize: 15, flex: 1,
                  color: "#1C1C1E", background: "transparent",
                }}
              />
            </div>
            <button onClick={() => markAll("present")} style={{
              background: "#34C759", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 14px",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>All ✓</button>
            <button onClick={() => markAll("absent")} style={{
              background: "#FF3B30", color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 14px",
              fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>All ✗</button>
          </div>

          {/* Sort Row */}
          <div style={{ padding: "10px 16px 0", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93", marginRight: 2 }}>Sort:</span>
            {[
              { val: "default", label: "Default" },
              { val: "name",    label: "Name"    },
              hasRoll && { val: "roll", label: "Roll No." },
              hasReg  && { val: "reg",  label: "Reg No."  },
            ].filter(Boolean).map((opt) => (
              <button key={opt.val} onClick={() => setSortBy(opt.val)} style={{
                padding: "6px 12px", borderRadius: 20, border: "none",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: sortBy === opt.val ? "#2563EB" : "#E4E4EB",
                color: sortBy === opt.val ? "#fff" : "#636366",
                transition: "all 0.2s",
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Student List */}
          <div style={{ padding: "12px 16px 0" }}>
            <div style={{
              background: "#fff", borderRadius: 18, overflow: "hidden",
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}>
              {filtered.map((student, idx) => {
                const st = status[student.id] || "present";
                const isPresent = st === "present";
                const isAbsent  = st === "absent";
                const isOD      = st === "od";
                const rowBg = isPresent ? "#fff" : isAbsent ? "rgba(255,59,48,0.04)" : "rgba(37,99,235,0.04)";
                const badgeColor = isPresent ? "rgba(37,99,235,0.1)" : isAbsent ? "rgba(255,59,48,0.1)" : "rgba(37,99,235,0.15)";
                const numColor = isPresent ? "#2563EB" : isAbsent ? "#FF3B30" : "#2563EB";
                return (
                  <div
                    key={student.id}
                    onClick={() => cycle(student.id)}
                    style={{
                      display: "flex", alignItems: "center",
                      padding: "13px 16px",
                      borderBottom: idx < filtered.length - 1 ? "1px solid #F2F2F7" : "none",
                      cursor: "pointer",
                      background: rowBg,
                    }}
                  >
                    {/* Badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: badgeColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginRight: 12, flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: numColor }}>
                        {student.id}
                      </span>
                    </div>

                    {/* Name & Roll */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 15, fontWeight: 600, color: "#1C1C1E",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>{student.name}</div>
                      <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 1 }}>
                        {student.roll !== "N/A" && student.roll !== "" ? student.roll : student.reg}
                      </div>
                    </div>

                    {/* OD Button */}
                    <div
                      onClick={(e) => toggleOD(student.id, e)}
                      style={{
                        marginRight: 10,
                        padding: "4px 10px",
                        borderRadius: 8,
                        fontSize: 11, fontWeight: 700,
                        cursor: "pointer",
                        border: `1.5px solid ${isOD ? "#2563EB" : "#C7C7CC"}`,
                        background: isOD ? "#2563EB" : "transparent",
                        color: isOD ? "#fff" : "#8E8E93",
                        transition: "all 0.2s",
                        flexShrink: 0,
                      }}
                    >OD</div>

                    {/* Present/Absent Checkbox */}
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      border: isPresent ? "none" : isOD ? "none" : "2px solid #C7C7CC",
                      background: isPresent ? "#34C759" : isOD ? "rgba(37,99,235,0.15)" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s", flexShrink: 0,
                    }}>
                      {isPresent && (
                        <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                          <path d="M1 5L5.5 9.5L13 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {isAbsent && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M1 1L11 11M11 1L1 11" stroke="#FF3B30" strokeWidth="2.2" strokeLinecap="round"/>
                        </svg>
                      )}
                      {isOD && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#2563EB" }}>OD</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate Button */}
          <div style={{ padding: "20px 16px 0" }}>
            <button onClick={handleGenerateClick} style={{
              width: "100%", padding: "16px",
              background: "linear-gradient(135deg, #1C3D72 0%, #2563EB 100%)",
              color: "#fff", border: "none", borderRadius: 16,
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(37,99,235,0.35)", letterSpacing: 0.3,
            }}>
              Generate WhatsApp Message →
            </button>
          </div>
        </>
      )}

      {view === "message" && (
        <div style={{ padding: "16px 16px 0" }}>

          {absentCount > 0 && numFormat && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(37,99,235,0.07)",
              border: "1.5px solid rgba(37,99,235,0.2)",
              borderRadius: 14, padding: "10px 14px", marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, color: "#2563EB", fontWeight: 600 }}>
                {numFormat === "roll" && "🆔 Using Roll Number"}
                {numFormat === "reg"  && "🎓 Using Register Number"}
                {numFormat === "both" && "📄 Showing Both Numbers"}
                {numFormat === "none" && "👤 Name Only"}
                <span style={{ fontSize: 11, opacity: 0.75, marginLeft: 6 }}>· Sorted by Roll No. ↑</span>
              </div>
              <button onClick={() => setShowModal(true)} style={{
                background: "#2563EB", color: "#fff",
                border: "none", borderRadius: 8,
                padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Change</button>
            </div>
          )}

          {absentCount > 0 && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#FF3B30", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  ❌ Absentees ({absentCount})
                </div>
                <div style={{ fontSize: 11, color: "#8E8E93", fontWeight: 600 }}>↑ Roll No. order</div>
              </div>
              {sortByRoll(absentees).map((s, i) => (
                <div key={s.id} style={{
                  display: "flex", gap: 10, padding: "7px 0",
                  borderBottom: i < absentees.length - 1 ? "1px solid #F2F2F7" : "none",
                }}>
                  <span style={{ color: "#8E8E93", fontSize: 13, minWidth: 20 }}>{i + 1}.</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#8E8E93" }}>
                      {numFormat === "roll" && s.roll}
                      {numFormat === "reg"  && s.reg}
                      {numFormat === "both" && `Roll: ${s.roll}  |  Reg: ${s.reg}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {odCount > 0 && (
            <div style={{
              background: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
              boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#2563EB", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  🔵 On Duty — OD ({odCount})
                </div>
                <div style={{ fontSize: 11, color: "#8E8E93", fontWeight: 600 }}>↑ Roll No. order</div>
              </div>
              {sortByRoll(odStudents).map((s, i) => (
                <div key={s.id} style={{
                  display: "flex", gap: 10, padding: "7px 0",
                  borderBottom: i < odStudents.length - 1 ? "1px solid #F2F2F7" : "none",
                }}>
                  <span style={{ color: "#8E8E93", fontSize: 13, minWidth: 20 }}>{i + 1}.</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1E" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#8E8E93" }}>
                      {numFormat === "roll" && s.roll}
                      {numFormat === "reg"  && s.reg}
                      {numFormat === "both" && `Roll: ${s.roll}  |  Reg: ${s.reg}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {absentCount === 0 && odCount === 0 && (
            <div style={{
              background: "rgba(52,199,89,0.1)",
              border: "1.5px solid rgba(52,199,89,0.3)",
              borderRadius: 16, padding: 20, marginBottom: 14, textAlign: "center",
            }}>
              <div style={{ fontSize: 36 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#34C759", marginTop: 8 }}>Full Attendance!</div>
              <div style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>
                All {students.length} students are present
              </div>
            </div>
          )}

          <div style={{
            background: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#8E8E93", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Message Preview
            </div>
            <pre style={{
              fontFamily: "'SF Pro Text', -apple-system, sans-serif",
              fontSize: 14, lineHeight: 1.6, color: "#1C1C1E",
              whiteSpace: "pre-wrap", margin: 0,
              background: "#F9F9FB", borderRadius: 10, padding: 14,
            }}>{message}</pre>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={handleWhatsApp} style={{
              width: "100%", padding: "16px",
              background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              color: "#fff", border: "none", borderRadius: 16,
              fontSize: 16, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(37,211,102,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Send via WhatsApp
            </button>
            <button onClick={handleCopy} style={{
              width: "100%", padding: "16px",
              background: copied ? "#34C759" : "#F2F2F7",
              color: copied ? "#fff" : "#1C1C1E",
              border: "none", borderRadius: 16,
              fontSize: 16, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s",
            }}>
              {copied ? "✅ Copied!" : "📋 Copy to Clipboard"}
            </button>
          </div>
        </div>
      )}

      <div style={{
        textAlign: "center", padding: "16px 0 100px",
        fontSize: 11, color: "#C7C7CC", fontWeight: 500, letterSpacing: 0.3,
      }}>
        Made by Ashwin Vijayan
      </div>

      {/* Bottom Tab Bar */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(0,0,0,0.08)",
        padding: "10px 0 20px",
        display: "flex", justifyContent: "space-around",
      }}>
        {[
          { id: "attendance", icon: "📋", label: "Attendance" },
          { id: "message",    icon: "💬", label: "Message"    },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setView(tab.id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            background: "none", border: "none", cursor: "pointer", padding: "6px 24px",
          }}>
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: view === tab.id ? "#2563EB" : "#8E8E93" }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [students, setStudents]         = useState(null);
  const [storageChecked, setStorageChecked] = useState(false);

  // Load saved students from localStorage on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) setStudents(parsed);
      }
    } catch { /* corrupt data, start fresh */ }
    setStorageChecked(true);
  }, []);

  const handleStudentsLoaded = (s) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* storage full */ }
    setStudents(s);
  };

  const handleReset = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setStudents(null);
  };

  if (!storageChecked) {
    return (
      <div style={{
        minHeight: "100vh", background: "#F2F2F7",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 15, color: "#8E8E93", fontWeight: 500 }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!students) return <UploadScreen onStudentsLoaded={handleStudentsLoaded} />;
  return <AttendanceApp students={students} onReset={handleReset} />;
}
