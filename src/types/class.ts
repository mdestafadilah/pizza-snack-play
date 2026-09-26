/** DTO daftar kelas — dipakai bersama oleh API dan frontend. */

export interface ClassListDto {
  /** Kelas yang boleh diakses user ini, urut abjad. */
  classes: string[];
  /**
   * Kelas yang dipakai bila klien tidak menyebut `class` secara eksplisit.
   * `null` bila user belum punya kelas sama sekali.
   */
  default: string | null;
}

/**
 * Siswa satu kelas beserta orang tuanya — bahan dropdown **Petugas** dan
 * **Orang tua** pada tabel jadwal.
 *
 * Keduanya diikat menjadi satu baris, bukan dua daftar terpisah, karena
 * kolom Orang tua diturunkan dari petugas yang dipilih: satu siswa hanya
 * bisa berasal dari satu orang tua. Mengirim dua daftar terpisah justru
 * membuka peluang pasangan yang tidak pernah ada di database.
 */
export interface StudentRosterDto {
  /** `students.id` — yang disimpan sebagai `petugasStudentId`. */
  studentId: number;
  studentName: string;
  /** Kelas siswa; `null` bila datanya belum diisi. */
  className: string | null;
  /** `parents.id` — disimpan sebagai `petugasParentId`. */
  parentId: number;
  /** Nama orang tua/wali; string kosong bila profilnya tidak ada. */
  parentName: string;
  /**
   * `users.id` akun orang tua — `null` bila orang tuanya belum punya akun
   * aktif. Petugas tanpa akun tetap boleh dipilih; yang hilang hanya
   * keterkaitannya dengan login orang tua.
   */
  parentUserId: number | null;
}

/** Balasan `GET /api/classes/:class/roster`. */
export interface ClassRosterDto {
  /** Kelas yang diminta — sudah dinormalkan server. */
  className: string;
  students: StudentRosterDto[];
}
