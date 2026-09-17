<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            // Roles first: everything that checks a permission reads this table,
            // and migrations only create two of the thirteen rows.
            RolesSeeder::class,
            FiltersTableSeeder::class,
        ]);
    }
}
