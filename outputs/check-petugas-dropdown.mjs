/**
 * Verifikasi tampilan: dropdown Petugas & Orang tua yang saling terhubung
 * pada tabel jadwal (/jadwal).
 *
 * Jalankan: node outputs/check-petugas-dropdown.mjs
 * (dev server harus jalan di localhost:5173)
 *
 * Yang diperiksa — akibat nyata dari perubahan, bukan hiasan:
 * - Dua kolom teks bebas lama ("Petugas…" / "Orang tua…") tidak ada lagi.
 * - Kolom Petugas kini berisi daftar siswa kelas yang sedang dilihat.
 * - Kolom Orang tua mengikuti siswa yang dipilih (read-only).
 * - Memilih siswa benar-benar tersimpan ke server (bukan hanya di layar).
 * - Konsol bersih.
 */
import fs from "fs";
import puppeteer from "puppeteer-core";

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = "http://localhost:5173";
const SHOTS = "D:/DEV/JS/pizza-snack-play/outputs/screenshots";

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--proxy-server=direct://", "--proxy-bypass-list=*"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // ── Masuk sebagai admin ────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.waitForSelector("input", { timeout: 15000 });

  // Form-nya controlled React: klik lalu ketik lewat keyboard, bukan
  // `elementHandle.type()`, supaya `onChange`-nya benar-benar terpicu.
  const inputs = await page.$$("input");
  await inputs[0].click();
  await page.keyboard.type("admin", { delay: 20 });
  await inputs[1].click();
  await page.keyboard.type("snack123", { delay: 20 });
  await page.click('button[type="submit"]');

  // Login berhasil memunculkan dialog "Mulai" dulu — halaman baru berpindah
  // setelah dialog itu ditutup.
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Mulai"),
    { timeout: 20000 },
  );
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.trim() === "Mulai")
      .click();
  });

  await page.waitForFunction(() => !location.pathname.includes("/login"), {
    timeout: 20000,
  });

  // ── Buka /jadwal ───────────────────────────────────────────
  await page.goto(`${BASE}/jadwal`, { waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => document.body.innerText.includes("Kelola Jadwal"),
    { timeout: 20000 },
  );
  // Beri waktu query roster selesai.
  await new Promise((r) => setTimeout(r, 2500));

  const bodyText = await page.evaluate(() => document.body.innerText);

  check(
    'placeholder teks bebas "Petugas…" sudah tidak ada',
    !bodyText.includes("Petugas…"),
  );
  check(
    'placeholder teks bebas "Orang tua…" sudah tidak ada',
    !bodyText.includes("Orang tua…"),
  );

  // ── Periksa dropdown petugas pada baris pertama ────────────
  const cells = await page.evaluate(() => {
    const selects = [...document.querySelectorAll("select")];
    return selects.map((s) => ({
      value: s.value,
      disabled: s.disabled,
      options: [...s.options].map((o) => o.textContent.trim()),
    }));
  });

  const petugasSelects = cells.filter((s) =>
    s.options.some((o) => o.includes("belum ada petugas")),
  );
  const parentSelects = cells.filter(
    (s) => s.disabled && s.options.length === 1,
  );

  check(
    "kolom Petugas memakai <select> (bukan input teks)",
    petugasSelects.length > 0,
    `${petugasSelects.length} dropdown`,
  );
  check(
    "dropdown Petugas memuat nama siswa kelas 1",
    petugasSelects[0]?.options.includes("Aisyah Sari") &&
      petugasSelects[0]?.options.includes("Bagas Budi"),
    petugasSelects[0]?.options.join(", "),
  );
  check(
    "kolom Orang tua read-only (disabled, satu opsi)",
    parentSelects.length > 0,
    `${parentSelects.length} kolom read-only`,
  );

  await page.screenshot({ path: `${SHOTS}/petugas-dropdown-before.png` });

  // ── Pindah beberapa bulan ke depan agar dapat baris draft ──────
  // Jadwal hasil seed semuanya sudah dipublikasi, dan baris
  // `locked`/`published` memang tidak boleh diubah (409) — jadi uji simpan
  // harus memakai baris yang masih bisa disunting.
  for (let i = 0; i < 4; i++) {
    await page.click('[aria-label="Bulan berikutnya"]');
    await new Promise((r) => setTimeout(r, 1200));
  }
  await new Promise((r) => setTimeout(r, 2500));

  const monthLabel = await page.evaluate(() => {
    const el = [...document.querySelectorAll("h2, h3, p")].find((n) =>
      /^(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+\d{4}$/.test(n.textContent.trim()),
    );
    return el?.textContent.trim() ?? null;
  });
  console.log(`  (bulan aktif: ${monthLabel})`);

  // ── Pilih siswa, pastikan kolom ortu ikut berubah & tersimpan ──
  const rowHandle = await page.evaluateHandle(() => {
    const selects = [...document.querySelectorAll("select")];
    const petugas = selects.find((s) =>
      [...s.options].some((o) => o.textContent.includes("belum ada petugas")),
    );
    return petugas.closest("li");
  });

  const studentId = await page.evaluate((li) => {
    const s = [...li.querySelectorAll("select")].find((x) =>
      [...x.options].some((o) => o.textContent.includes("belum ada petugas")),
    );
    const opt = [...s.options].find((o) => o.textContent.trim() === "Aisyah Sari");
    return opt?.value ?? null;
  }, rowHandle);

  check("opsi Aisyah Sari punya value (studentId)", Boolean(studentId), String(studentId));

  let savedOk = false;
  if (studentId) {
    const [resp] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes("/api/schedules") &&
          ["POST", "PUT"].includes(r.request().method()),
        { timeout: 15000 },
      ),
      page.evaluate((li, val) => {
        const s = [...li.querySelectorAll("select")].find((x) =>
          [...x.options].some((o) => o.textContent.includes("belum ada petugas")),
        );
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        ).set;
        setter.call(s, val);
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }, rowHandle, studentId),
    ]);

    const payload = await resp.json().catch(() => null);
    savedOk =
      resp.ok() &&
      payload?.data?.petugasName === "Aisyah Sari" &&
      payload?.data?.petugasParentName === "Sari Wulandari";

    check(
      "memilih siswa tersimpan sebagai petugas (nama diturunkan server)",
      savedOk,
      `status ${resp.status()} :: petugasName=${payload?.data?.petugasName} ortu=${payload?.data?.petugasParentName}`,
    );
  }

  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${SHOTS}/petugas-dropdown-after.png` });

  // Kolom orang tua pada baris itu sekarang harus menampilkan nama ortu.
  const parentShown = await page.evaluate((li) => {
    const dis = [...li.querySelectorAll("select")].filter((s) => s.disabled);
    return dis.map((s) => s.options[s.selectedIndex]?.textContent.trim());
  }, rowHandle);

  check(
    "kolom Orang tua mengikuti siswa terpilih",
    parentShown.some((t) => t === "Sari Wulandari"),
    parentShown.join(" | "),
  );

  // ── Bersih-bersih: kosongkan lagi ──────────────────────────
  if (studentId) {
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/schedules") && r.request().method() === "PUT",
        { timeout: 15000 },
      ),
      page.evaluate((li) => {
        const s = [...li.querySelectorAll("select")].find((x) =>
          [...x.options].some((o) => o.textContent.includes("belum ada petugas")),
        );
        const setter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value",
        ).set;
        setter.call(s, "");
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }, rowHandle),
    ]);
  }

  check(
    "konsol bersih (tanpa error React)",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" || "),
  );

  console.log(`\n${fail === 0 ? "SEMUA LULUS" : `${fail} UJI GAGAL`} (${pass} lulus)`);
  console.log(`Screenshot: ${SHOTS}`);
  process.exitCode = fail === 0 ? 0 : 1;
} finally {
  await browser.close();
}
