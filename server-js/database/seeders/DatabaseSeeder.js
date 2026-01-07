// Ported from Laravel's database/seeders/DatabaseSeeder.php
export default async function seedDatabase() {
    // Call all seeders
    await import('./FiltersTableSeeder.js').then((m) => m.default());
}

