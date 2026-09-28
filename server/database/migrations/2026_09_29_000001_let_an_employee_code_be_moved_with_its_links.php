<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * An employee code can be corrected without losing what points at it.
 *
 * faculty.faculty_code is the join key nineteen columns reference, and every
 * one of those foreign keys was declared with an ON DELETE rule and nothing
 * for updates, so InnoDB defaulted to refusing the update. The institute's
 * sheet renumbers some staff (1000823 becomes 6600823), and the import could
 * only keep the old number and say so.
 *
 * Each key is rebuilt with its own delete rule untouched plus ON UPDATE
 * CASCADE, so the database moves the children itself. The columns that hold a
 * code without a foreign key are moved by App\Support\FacultyCode.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->rebuildForeignKeys('CASCADE');
    }

    public function down(): void
    {
        $this->rebuildForeignKeys('RESTRICT');
    }

    private function rebuildForeignKeys(string $onUpdate): void
    {
        foreach ($this->keysPointingAtFacultyCode() as $key) {
            $columns = implode(', ', array_map(fn ($column) => "`{$column}`", $key['columns']));
            $referenced = implode(', ', array_map(fn ($column) => "`{$column}`", $key['referenced']));

            DB::statement("ALTER TABLE `{$key['table']}` DROP FOREIGN KEY `{$key['name']}`");
            DB::statement(
                "ALTER TABLE `{$key['table']}` ADD CONSTRAINT `{$key['name']}` "
                . "FOREIGN KEY ({$columns}) REFERENCES `faculty` ({$referenced}) "
                . "ON DELETE {$key['on_delete']} ON UPDATE {$onUpdate}"
            );
        }
    }

    /**
     * Read from the database rather than kept as a list here, so a key added
     * later is not silently left behind.
     */
    private function keysPointingAtFacultyCode(): array
    {
        $rows = DB::select(
            "SELECT k.CONSTRAINT_NAME AS name, k.TABLE_NAME AS `table`, k.COLUMN_NAME AS `column`,
                    k.REFERENCED_COLUMN_NAME AS referenced, r.DELETE_RULE AS on_delete
             FROM information_schema.KEY_COLUMN_USAGE k
             JOIN information_schema.REFERENTIAL_CONSTRAINTS r
               ON r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
              AND r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
             WHERE k.TABLE_SCHEMA = DATABASE()
               AND k.REFERENCED_TABLE_NAME = 'faculty'
               AND k.REFERENCED_COLUMN_NAME = 'faculty_code'
             ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION"
        );

        $keys = [];
        foreach ($rows as $row) {
            $id = $row->table . '.' . $row->name;
            $keys[$id] ??= [
                'name' => $row->name,
                'table' => $row->table,
                'on_delete' => $row->on_delete === 'NO ACTION' ? 'RESTRICT' : $row->on_delete,
                'columns' => [],
                'referenced' => [],
            ];
            $keys[$id]['columns'][] = $row->column;
            $keys[$id]['referenced'][] = $row->referenced;
        }

        return array_values($keys);
    }
};
