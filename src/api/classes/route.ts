import { Hono } from "hono";
import { requireAuth, type AuthEnv } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { classController } from "./controller";

/**
 * Kelas — daftar kelas untuk mengisi pemilih kelas di UI, plus roster siswa
 * per kelas untuk dropdown petugas pada tabel jadwal.
 *
 * `GET /` boleh dipanggil semua role yang sudah login; isinya sudah
 * dipersempit sesuai role (lihat `ClassService.listForUser`).
 *
 * `GET /:class/roster` justru **dibatasi** ke admin & korlas. Isinya bukan
 * sekadar nama siswa: ada nama orang tua dan id akunnya, yang tidak ada
 * urusannya bagi orang tua lain. Pembatasan role dipasang di sini, sedangkan
 * cakupan kelasnya ditegakkan di service (admin = semua kelas, korlas =
 * kelasnya sendiri).
 */
const rosterReaders = requireRole("admin", "korlas");

export const classesRoute = new Hono<AuthEnv>()
  .get("/", requireAuth, classController.list)
  .get("/:class/roster", requireAuth, rosterReaders, classController.roster);
