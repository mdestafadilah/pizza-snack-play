/*
  Wajib dijalankan lebih dulu — bukan sekadar kerapian.

  SQLite menyelesaikan foreign key komposit lewat indeks **unik** pada pasangan
  kolom tujuan yang persis sama. Indeks biasa, atau indeks unik pada pasangan
  kolom yang berbeda, tidak diterima. Di sini `__new_schedules` membawa dua FK
  komposit ke `students`, jadi kedua indeks berikut harus ada sebelum tabel itu
  dibuat:

    - `idx_students_id_parent`  → untuk (petugas_student_id, petugas_parent_id)
    - `idx_students_class_id`   → untuk (class_name, petugas_student_id)

  `idx_students_class_name` sengaja **bukan** pengganti `idx_students_class_id`:
  walau sama-sama diawali `class_name`, kolom keduanya berbeda (`name` vs `id`),
  sehingga tidak memenuhi syarat FK — dan SQLite tidak mengeluh saat
  `CREATE TABLE` melainkan baru saat `PRAGMA foreign_key_check`.

  `idx_parents_user` ada di migrasi 0006 karena drizzle-kit menolak
  `ALTER TABLE ... ADD INDEX` (tidak dikenal SQLite) dan hanya mau
  menambahkannya lewat pembangunan ulang tabel `parents`.
*/
CREATE UNIQUE INDEX `idx_students_id_parent` ON `students` (`id`,`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_students_class_id` ON `students` (`class_name`,`id`);--> statement-breakpoint
CREATE INDEX `idx_students_class_name` ON `students` (`class_name`,`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer,
	`schedule_date` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`class_name` text NOT NULL,
	`menu_id` integer,
	`is_holiday` integer DEFAULT 0 NOT NULL,
	`petugas_name` text,
	`petugas_student_id` integer,
	`petugas_parent_id` integer,
	`petugas_parent_name` text,
	`notes` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`locked_by` integer,
	`locked_at` text,
	`published_by` integer,
	`published_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`locked_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`class_name`,`petugas_student_id`) REFERENCES `students`(`class_name`,`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`petugas_student_id`,`petugas_parent_id`) REFERENCES `students`(`id`,`parent_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_schedules`("id", "week_id", "schedule_date", "day_of_week", "class_name", "menu_id", "is_holiday", "petugas_name", "petugas_student_id", "petugas_parent_id", "petugas_parent_name", "notes", "status", "locked_by", "locked_at", "published_by", "published_at", "created_at", "updated_at") SELECT "id", "week_id", "schedule_date", "day_of_week", "class_name", "menu_id", "is_holiday", "petugas_name", "petugas_student_id", "petugas_parent_id", "petugas_parent_name", "notes", "status", "locked_by", "locked_at", "published_by", "published_at", "created_at", "updated_at" FROM `schedules`;--> statement-breakpoint
DROP TABLE `schedules`;--> statement-breakpoint
ALTER TABLE `__new_schedules` RENAME TO `schedules`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_schedules_date_class` ON `schedules` (`schedule_date`,`class_name`);--> statement-breakpoint
CREATE INDEX `idx_schedules_week` ON `schedules` (`week_id`);--> statement-breakpoint
CREATE INDEX `idx_schedules_menu` ON `schedules` (`menu_id`);--> statement-breakpoint
CREATE INDEX `idx_schedules_class` ON `schedules` (`class_name`);--> statement-breakpoint
CREATE INDEX `idx_schedules_class_date` ON `schedules` (`class_name`,`schedule_date`);--> statement-breakpoint
CREATE INDEX `idx_schedules_status` ON `schedules` (`status`);
