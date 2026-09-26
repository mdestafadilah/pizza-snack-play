import type { Db } from "../../database/db";
import type { JwtPayload } from "../../types/auth";
import type { ClassListDto, ClassRosterDto } from "../../types/class";
import { classRepository } from "./repository";

export type ClassError = "not_found" | "forbidden_class";

class ClassService {
  /**
   * Kelas yang boleh diakses user beserta kelas default-nya.
   *
   * - `admin`  → semua kelas
   * - `korlas` → semua kelas (boleh **melihat** kelas lain, mis. untuk
   *              membandingkan menu antarkelas). Wewenang **mengubah** tetap
   *              terkunci ke kelasnya sendiri — ditegakkan `resolveWriteClass`
   *              dan `canWriteClass`, bukan di sini.
   * - `parent` → hanya kelas anak-anaknya
   */
  async listForUser(db: Db, user: JwtPayload): Promise<ClassListDto> {
    const classes = await this.allowedClasses(db, user);
    return { classes, default: defaultClassFor(user, classes) };
  }

  /**
   * Roster satu kelas — daftar siswa untuk dropdown Petugas pada tabel jadwal.
   *
   * Kelas ini **menyaring sendiri** lewat `allowedClasses`, tidak mengandalkan
   * middleware. `canWriteClass` di jalur jadwal belum menolong di sini: orang
   * tua juga boleh membaca kelas anaknya, sedangkan roster memuat nama orang
   * tua siswa lain dan akun mereka — data yang tidak ada urusannya bagi
   * sesama orang tua. Jadi hanya pengelola jadwal (admin & korlas) yang
   * dilayani, dan korlas hanya untuk kelasnya sendiri.
   *
   * `not_found` dibedakan dari `forbidden_class` supaya pesan errornya jujur:
   * kolom kelas yang salah ketik tidak boleh terbaca sebagai "tidak berhak".
   */
  async roster(
    db: Db,
    user: JwtPayload,
    requested: string,
  ): Promise<ClassRosterDto | ClassError> {
    const allowed = await this.allowedClasses(db, user);
    const className = requested.trim();

    if (!className) return "not_found";

    // Admin boleh melihat kelas apa pun yang dikenal sistem, termasuk kelas
    // yang belum punya siswa — karena itu keberadaannya dicek lebih dulu,
    // bukan sekadar keanggotaan di daftar kelas yang berpenghuni.
    if (user.role === "admin") {
      const known = await classRepository.listAll(db);
      if (!known.includes(className)) return "not_found";
    } else if (!allowed.includes(className)) {
      return "forbidden_class";
    }

    const rows = await classRepository.listStudentsForClass(db, className);

    return {
      className,
      students: rows.map((row) => ({
        studentId: row.studentId,
        studentName: row.studentName,
        className: row.className,
        parentId: row.parentId,
        parentName: row.parentName,
        parentUserId: row.parentUserId,
      })),
    };
  }

  /** Inti pembatasan kelas — dipakai juga oleh resolver cakupan jadwal. */
  async allowedClasses(db: Db, user: JwtPayload): Promise<string[]> {
    if (user.role === "admin" || user.role === "korlas") {
      return classRepository.listAll(db);
    }

    return classRepository.listForParent(db, user.sub);
  }
}

/**
 * Kelas yang dipakai bila klien tidak menyebut kelas secara eksplisit.
 *
 * Korlas memakai kelas yang dikoordinasinya walau daftarnya berisi semua kelas —
 * tanpa itu halaman baca (mis. Hari Ini) terbuka di kelas pertama menurut abjad,
 * bukan kelas yang menjadi tanggung jawabnya.
 */
function defaultClassFor(user: JwtPayload, classes: string[]): string | null {
  const own = user.className?.trim();
  if (user.role === "korlas" && own && classes.includes(own)) return own;

  return classes[0] ?? null;
}

export const classService = new ClassService();
