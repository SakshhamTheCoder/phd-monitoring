<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\Rupees;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/** The overview's rows and figures, phrased by the server. */
class ProjectsOverviewTest extends TestCase
{
    use DatabaseTransactions;

    public function test_rows_arrive_phrased_with_what_the_reader_may_do(): void
    {
        $pi = User::where('email', 'supervisor@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        $head = User::where('email', 'hod@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        $id = $this->actingAs($pi)->postJson('/api/projects', [
            'title' => 'Overview project', 'category' => 'International', 'status' => 'Pending',
            'amount' => 123456789, 'duration_years' => 2, 'duration_months' => 1,
        ])->assertCreated()->json('id');

        $row = collect($this->actingAs($pi)->getJson('/api/projects/overview')->assertOk()->json('rows'))->firstWhere('id', $id);
        $this->assertSame(['Overview project', ['text' => 'International', 'tone' => 'purple'], 'PI', '₹12.35 Cr', '2 Years 1 Month', true], [
            $row['title'], $row['category'], $row['role'], $row['amount'], $row['duration'], $row['can_edit'],
        ]);

        // The department reads it, and may not change it.
        $read = collect($this->actingAs($head)->getJson('/api/projects/overview')->json('rows'))->firstWhere('id', $id);
        $this->assertFalse($read['can_edit'] ?? true);
    }

    public function test_amounts_are_grouped_the_indian_way(): void
    {
        $this->assertSame(['999', '48,50,000', '12,34,56,789', '₹48.50 L', '₹99,999'], [
            Rupees::grouped(999), Rupees::grouped(4850000), Rupees::grouped(123456789), Rupees::short(4850000), Rupees::short(99999),
        ]);
    }
}
