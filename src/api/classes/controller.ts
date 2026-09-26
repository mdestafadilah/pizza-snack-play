import type { Context } from "hono";
import { getDb } from "../../database/db";
import type { AuthEnv } from "../middleware/auth";
import {
  responseForbidden,
  responseNotFound,
  responseOK,
} from "../utils/response";
import { classService, type ClassError } from "./service";

function mapError(c: Context<AuthEnv>, error: ClassError) {
  switch (error) {
    case "not_found":
      return responseNotFound(c, "Kelas tidak ditemukan");
    case "forbidden_class":
      return responseForbidden(c, "Kelas ini di luar cakupan Anda");
  }
}

class ClassController {
  /** `GET /api/classes` — daftar kelas yang boleh diakses user. */
  list = async (c: Context<AuthEnv>) => {
    const data = await classService.listForUser(getDb(c.env), c.get("user"));
    return responseOK(c, "Daftar kelas", data);
  };

  /**
   * `GET /api/classes/:class/roster` — siswa satu kelas beserta orang tuanya.
   *
   * Dipakai dropdown Petugas & Orang tua pada tabel jadwal. Hanya pengelola
   * jadwal yang dilayani; lihat `ClassService.roster` untuk alasannya.
   */
  roster = async (c: Context<AuthEnv>) => {
    const result = await classService.roster(
      getDb(c.env),
      c.get("user"),
      c.req.param("class") ?? "",
    );

    if (typeof result === "string") return mapError(c, result);

    return responseOK(c, `Roster kelas ${result.className}`, result);
  };
}

export const classController = new ClassController();
