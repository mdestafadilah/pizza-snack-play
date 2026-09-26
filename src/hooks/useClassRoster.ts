import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { StudentRosterDto } from "@/types/class";

/**
 * Referensi tetap untuk kasus "belum ada data". Nilai baru setiap render akan
 * membuat `useMemo`/`useEffect` pemanggil berjalan terus.
 */
const EMPTY_ROSTER: StudentRosterDto[] = [];

/**
 * Siswa satu kelas beserta orang tuanya — bahan dropdown **Petugas** dan
 * **Orang tua** pada tabel jadwal.
 *
 * `className` yang kosong tidak diambil sama sekali: halaman jadwal boleh
 * terbuka sebelum kelasnya berhasil ditentukan (mis. data siswa belum ada),
 * dan meminta roster untuk kelas kosong hanya menghasilkan 404.
 *
 * Daftar ini jarang berubah dalam satu sesi penyusunan jadwal, jadi hasilnya
 * dianggap segar cukup lama. `invalidateQueries(["class-roster"])` dipakai
 * setelah akun orang tua atau datanya disentuh, supaya dropdown tidak
 * menyimpan nama lama.
 */
export function useClassRoster(className: string | null) {
  const query = useQuery({
    queryKey: ["class-roster", className],
    queryFn: () => api.classes.roster(className!),
    enabled: Boolean(className),
    staleTime: 5 * 60 * 1000,
  });

  return {
    students: query.data?.students ?? EMPTY_ROSTER,
    /**
     * `true` selama roster kelas ini belum pernah berhasil diambil. Dipakai
     * untuk menonaktifkan dropdown, bukan menggantinya dengan spinner —
     * tabel jadwal sudah punya indikator pemuatan sendiri.
     */
    isLoading: query.isPending,
    /** Kelas ada, tetapi belum punya satu siswa pun. */
    isEmpty: query.isSuccess && (query.data?.students.length ?? 0) === 0,
  };
}
