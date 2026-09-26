/** Uji lintas lapis: roster kelas + penulisan petugas lewat dropdown. */
const BASE = "http://localhost:5173/api";

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* bukan JSON */
  }
  return { status: res.status, json };
}

async function login(username) {
  const r = await call("/auth/login", {
    method: "POST",
    body: { username, password: "snack123" },
  });
  if (r.status !== 200) throw new Error(`login ${username} gagal: ${r.status}`);
  return r.json.data.token;
}

const admin = await login("admin");
const korlas = await login("budi"); // korlas kelas 1

// ── 1. Admin boleh membaca roster kelas 1 ────────────────────
const r1 = await call("/classes/1/roster", { token: admin });
check("admin: GET /classes/1/roster → 200", r1.status === 200, `status ${r1.status}`);
check(
  "admin: roster kelas 1 berisi 2 siswa",
  r1.json?.data?.students?.length === 2,
  `dapat ${r1.json?.data?.students?.length}`,
);

const roster = r1.json?.data?.students ?? [];
const aisyah = roster.find((s) => s.studentName === "Aisyah Sari");
check(
  "admin: Aisyah punya parentName 'Sari Wulandari'",
  aisyah?.parentName === "Sari Wulandari",
  aisyah?.parentName,
);
check(
  "admin: Aisyah punya parentUserId",
  typeof aisyah?.parentUserId === "number",
  String(aisyah?.parentUserId),
);

// ── 2. Korlas boleh membaca roster kelas lain, tetapi tidak boleh ──
// ── menulis petugas ke kelas itu (uji 6 di bawah) ──────────────────
const k1 = await call("/classes/1/roster", { token: korlas });
check("korlas: roster kelas sendiri → 200", k1.status === 200, `status ${k1.status}`);

const k3 = await call("/classes/3/roster", { token: korlas });
check(
  "korlas: roster kelas 3 → 200 (boleh melihat, menulis tetap ditolak)",
  k3.status === 200,
  `status ${k3.status}`,
);

// ── 3. Orang tua TIDAK boleh membaca roster ──────────────────
const parentToken = await login("sari");
const pr = await call("/classes/1/roster", { token: parentToken });
check(
  "parent: roster ditolak → 403 (bukan 200)",
  pr.status === 403,
  `status ${pr.status}`,
);

// ── 4. Kelas tidak dikenal → 404 ─────────────────────────────
const nf = await call("/classes/99/roster", { token: admin });
check("admin: kelas 99 (tidak ada) → 404", nf.status === 404, `status ${nf.status}`);

// ── 5. Menulis petugas lewat studentId: nama diturunkan server ─
const DATE = "2026-10-05"; // Senin
const created = await call("/schedules", {
  method: "POST",
  token: korlas,
  body: {
    scheduleDate: DATE,
    className: "1",
    isHoliday: false,
    petugasStudentId: aisyah.studentId,
    // Klien mencoba menyelipkan nama palsu — harus diabaikan server.
    petugasName: "NAMA PALSU",
    petugasParentName: "ORTU PALSU",
  },
});

check(
  "korlas: create jadwal dgn petugasStudentId → 201/200",
  created.status === 201 || created.status === 200,
  `status ${created.status} ${JSON.stringify(created.json?.message ?? "")}`,
);
check(
  "server menurunkan petugasName dari siswa (bukan 'NAMA PALSU')",
  created.json?.data?.petugasName === "Aisyah Sari",
  created.json?.data?.petugasName,
);
check(
  "server menurunkan petugasParentName (bukan 'ORTU PALSU')",
  created.json?.data?.petugasParentName === "Sari Wulandari",
  created.json?.data?.petugasParentName,
);
check(
  "petugasStudentId & petugasParentId tersimpan",
  created.json?.data?.petugasStudentId === aisyah.studentId &&
    typeof created.json?.data?.petugasParentId === "number",
  `studentId=${created.json?.data?.petugasStudentId} parentId=${created.json?.data?.petugasParentId}`,
);

const scheduleId = created.json?.data?.scheduleId;

// ── 6. Petugas dari kelas lain harus ditolak ─────────────────
const citra = { studentId: 3 }; // Citra Dewi, kelas 2
const cross = await call("/schedules", {
  method: "POST",
  token: korlas,
  body: {
    scheduleDate: "2026-10-06",
    className: "1",
    isHoliday: false,
    petugasStudentId: citra.studentId,
  },
});
check(
  "korlas: petugas dari kelas lain (Citra/kelas 2) → 400",
  cross.status === 400,
  `status ${cross.status} :: ${cross.json?.message ?? ""}`,
);

// ── 7. Mengosongkan petugas ──────────────────────────────────
if (scheduleId) {
  const cleared = await call(`/schedules/${scheduleId}`, {
    method: "PUT",
    token: korlas,
    body: { petugasStudentId: null },
  });
  check(
    "korlas: petugasStudentId null mengosongkan petugas",
    cleared.status === 200 &&
      cleared.json?.data?.petugasName === null &&
      cleared.json?.data?.petugasStudentId === null,
    `petugasName=${cleared.json?.data?.petugasName}`,
  );
}

// ── 8. Menyisakan baris bersih ───────────────────────────────
if (scheduleId) {
  const del = await call(`/schedules/${scheduleId}`, {
    method: "DELETE",
    token: korlas,
  });
  check("bersih-bersih: hapus jadwal uji", del.status === 200, `status ${del.status}`);
}

console.log(`\n${failures === 0 ? "SEMUA LULUS" : `${failures} UJI GAGAL`}`);
process.exit(failures === 0 ? 0 : 1);
