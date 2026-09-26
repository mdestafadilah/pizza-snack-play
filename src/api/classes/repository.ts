import { and, asc, eq, isNotNull, ne } from "drizzle-orm";
import type { Db } from "../../database/db";
import { parents, schedules, students, users } from "../../database/schema";

/** Satu baris roster: siswa, kelasnya, dan akun orang tuanya. */
export interface StudentRosterRow {
  studentId: number;
  studentName: string;
  className: string | null;
  parentId: number;
  parentName: string;
  /** `users.id` akun orang tua — `null` bila profilnya tidak punya akun aktif. */
  parentUserId: number | null;
}

/** Rapikan daftar kelas: buang kosong/spasi, dedupe, urut abjad-numerik. */
function normalize(values: (string | null)[]): string[] {
  const set = new Set<string>();

  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) set.add(trimmed);
  }

  // `numeric: true` agar "2A" mendahului "10A", bukan sebaliknya.
  return [...set].sort((a, b) => a.localeCompare(b, "id", { numeric: true }));
}

/**
 * Kelas bukan tabel tersendiri — daftarnya diturunkan dari data yang ada:
 * kelas anak (`students`), kelas yang dikoordinasi korlas (`users`), dan
 * kelas yang sudah punya baris jadwal (`schedules`).
 *
 * Konsekuensinya kelas hanya berupa teks tanpa id (mis. `"1A"`), sejalan
 * dengan `students.class_name` yang sudah dipakai sebelumnya.
 */
class ClassRepository {
  /** Semua kelas yang dikenal sistem, urut abjad-numerik. */
  async listAll(db: Db): Promise<string[]> {
    const [fromStudents, fromKorlas, fromSchedules] = await Promise.all([
      db
        .selectDistinct({ className: students.className })
        .from(students)
        .where(and(isNotNull(students.className), ne(students.className, ""))),
      db
        .selectDistinct({ className: users.className })
        .from(users)
        .where(and(eq(users.role, "korlas"), isNotNull(users.className))),
      db.selectDistinct({ className: schedules.className }).from(schedules),
    ]);

    return normalize([
      ...fromStudents.map((row) => row.className),
      ...fromKorlas.map((row) => row.className),
      ...fromSchedules.map((row) => row.className),
    ]);
  }

  /** Kelas dari anak-anak seorang orang tua. */
  async listForParent(db: Db, userId: number): Promise<string[]> {
    const rows = await db
      .selectDistinct({ className: students.className })
      .from(students)
      .innerJoin(parents, eq(parents.id, students.parentId))
      .where(
        and(
          eq(parents.userId, userId),
          eq(students.isActive, 1),
          isNotNull(students.className),
          ne(students.className, ""),
        ),
      );

    return normalize(rows.map((row) => row.className));
  }

  /**
   * Siswa aktif satu kelas beserta orang tuanya — bahan dropdown Petugas &
   * Orang tua pada tabel jadwal.
   *
   * Orang tua di-join **kiri**: siswa tetap muncul walau profil orang tuanya
   * nonaktif atau belum punya akun. Menyembunyikannya justru membuat korlas
   * tidak bisa menunjuk piket hanya karena data akunnya belum lengkap; kolom
   * `parentUserId` yang bernilai `null` sudah cukup untuk memberi tahu UI
   * bahwa nama orang tuanya tidak dapat disimpan.
   *
   * Kelas dibandingkan persis (`=`) mengikuti konvensi `students.class_name`
   * yang dipakai di seluruh aplikasi — bukan `like`, yang akan membuat
   * kelas "1" ikut menarik kelas "10".
   */
  async listStudentsForClass(
    db: Db,
    className: string,
  ): Promise<StudentRosterRow[]> {
    const rows = await db
      .select({
        studentId: students.id,
        studentName: students.name,
        className: students.className,
        parentId: parents.id,
        parentName: parents.parentName,
        parentUserId: parents.userId,
      })
      .from(students)
      .leftJoin(parents, eq(parents.id, students.parentId))
      .where(and(eq(students.className, className), eq(students.isActive, 1)))
      .orderBy(asc(students.name));

    return rows.map((row) => ({
      studentId: row.studentId,
      studentName: row.studentName,
      className: row.className,
      parentId: row.parentId ?? 0,
      // Profil orang tua hilang (data lama/rusak) → jangan tampilkan `null`
      // sebagai nama; UI memperlakukannya sebagai "tanpa orang tua".
      parentName: row.parentName ?? "",
      parentUserId: row.parentUserId ?? null,
    }));
  }
}

export const classRepository = new ClassRepository();
