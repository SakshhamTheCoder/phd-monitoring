<?php

use App\Support\PersonName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Points a research area at the outside expert table instead of carrying its
 * own copy of one.
 *
 * `area_of_specializations` held six `expert_*` columns describing the external
 * examiner the DoRDC adds to a doctoral committee when an IRB is approved. The
 * portal already has `outside_experts` for exactly that person, with a unique
 * email and the same fields, and the same expert often covers several areas.
 * Two of the six columns were never even written: the admin page's update and
 * CSV import both skipped designation and website, though its own template
 * shipped them.
 *
 * Experts whose email is blank cannot be moved, because `outside_experts.email`
 * is unique and the row has no other identity. Those areas end up with no
 * expert, which is what they effectively had.
 *
 * An email that already belongs to a portal account is skipped for a different
 * reason: that person is internal staff who was named as an examiner, so their
 * details are already held and copying them into the outside expert directory
 * would only invite someone to nominate them as an external reviewer.
 */
return new class extends Migration
{
    private const COPIED_COLUMNS = [
        'expert_name',
        'expert_email',
        'expert_phone',
        'expert_college',
        'expert_designation',
        'expert_website',
    ];

    public function up(): void
    {
        Schema::table('area_of_specializations', function (Blueprint $table) {
            $table->integer('outside_expert_id')->unsigned()->nullable()->after('name');
            $table->foreign('outside_expert_id')
                ->references('id')->on('outside_experts')->nullOnDelete();
        });

        $areas = DB::table('area_of_specializations')
            ->whereNotNull('expert_email')
            ->where('expert_email', '!=', '')
            ->get();

        foreach ($areas as $area) {
            // Someone who already has a portal account is not an outside
            // expert and their details are not at risk of being lost, so there
            // is nothing to copy. Production has a real faculty member named as
            // the examiner on one area; archiving him would have put him in the
            // outside expert directory, where he could then be nominated as an
            // external examiner for somebody's IRB.
            if (DB::table('users')->where('email', trim($area->expert_email))->exists()) {
                continue;
            }

            $expertId = $this->findOrCreateExpert($area);

            DB::table('area_of_specializations')
                ->where('id', $area->id)
                ->update(['outside_expert_id' => $expertId]);
        }

        Schema::table('area_of_specializations', function (Blueprint $table) {
            $table->dropColumn(self::COPIED_COLUMNS);
        });
    }

    public function down(): void
    {
        Schema::table('area_of_specializations', function (Blueprint $table) {
            foreach (self::COPIED_COLUMNS as $column) {
                $table->text($column)->nullable();
            }
        });

        $areas = DB::table('area_of_specializations')->whereNotNull('outside_expert_id')->get();

        foreach ($areas as $area) {
            $expert = DB::table('outside_experts')->where('id', $area->outside_expert_id)->first();
            if (!$expert) {
                continue;
            }

            DB::table('area_of_specializations')->where('id', $area->id)->update([
                'expert_name' => trim($expert->first_name . ' ' . $expert->last_name),
                'expert_email' => $expert->email,
                'expert_phone' => $expert->phone,
                'expert_college' => $expert->institution,
                'expert_designation' => $expert->designation,
                'expert_website' => $expert->website,
            ]);
        }

        Schema::table('area_of_specializations', function (Blueprint $table) {
            $table->dropForeign(['outside_expert_id']);
            $table->dropColumn('outside_expert_id');
        });
    }

    /**
     * `outside_experts` requires a name, designation, institution and
     * department, none of which the area columns guarantee. The department the
     * area belongs to is the closest true answer for the last one, and the rest
     * fall back to a marker an admin can search for and correct.
     */
    private function findOrCreateExpert(object $area): int
    {
        $email = trim($area->expert_email);

        $existing = DB::table('outside_experts')->where('email', $email)->value('id');
        if ($existing) {
            return $existing;
        }

        $name = PersonName::split($area->expert_name);
        $departmentName = DB::table('departments')->where('id', $area->department_id)->value('name');
        $phone = trim((string) $area->expert_phone);

        return DB::table('outside_experts')->insertGetId([
            'first_name' => $name['first'] !== '' ? $name['first'] : 'Unknown',
            'last_name' => $name['last'],
            'designation' => trim((string) $area->expert_designation) ?: 'Unknown',
            'institution' => trim((string) $area->expert_college) ?: 'Unknown',
            'department' => $departmentName ?: 'Unknown',
            'email' => $email,
            // The column is unique, so a number already in use has to be left
            // off rather than collide the whole migration.
            'phone' => $this->availablePhone($phone),
            'website' => $area->expert_website,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function availablePhone(string $phone): ?string
    {
        if ($phone === '' || DB::table('outside_experts')->where('phone', $phone)->exists()) {
            return null;
        }

        return $phone;
    }
};
