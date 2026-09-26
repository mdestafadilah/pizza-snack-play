ALTER TABLE `users` ADD `failed_login_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_failed_login_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locked_at` text;--> statement-breakpoint
/*
  Satu akun hanya boleh punya satu profil orang tua. Indeks ini sekaligus
  memenuhi syarat SQLite untuk foreign key komposit yang ditambahkan di
  migrasi 0007 — sebuah kolom tujuan FK komposit wajib punya indeks unik,
  dan aturan itu berlaku pada saat pernyataan FK dibuat, bukan saat dipakai.
  Ditulis manual di sini (bukan di 0007) karena `ALTER TABLE ... ADD INDEX`
  tidak dikenal SQLite: drizzle-kit menolak menambahkannya ke migrasi yang
  tidak sedang membangun ulang tabel `parents`.
*/
CREATE UNIQUE INDEX `idx_parents_user` ON `parents` (`user_id`);