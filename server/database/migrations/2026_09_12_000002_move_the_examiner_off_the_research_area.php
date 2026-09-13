<?php

use App\Support\PersonName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Removes the standing examiner a research area could carry.
 *
 * An area named one external examiner in six `expert_*` columns, and every
 * scholar in that area inherited them onto their doctoral committee when the
 * DoRDC approved the IRB. Nobody chose that person for that scholar; the area
 * did, and an account was created for them along the way. It sat oddly beside
 * the expert the DoRDC actually picks, who is nominated by the HoD, chosen by a
 * person, and deliberately given no portal login.
 *
 * It was never adopted. Production carried three: one named "To be Expert", one
 * named "ABC", and one pointing at an undergraduate address. Both committee rows
 * it produced name internal TIET faculty as the external member, which is the
 * opposite of what the seat is for.
 *
 * The examiners themselves are kept. Anyone who is not already a portal account
 * is copied into `outside_experts`, where experts belong, so no contact details
 * are lost. Someone who does have an account has lost nothing and is skipped:
 * copying them would put internal staff in the outside expert directory, where
 * they could be nominated as an external reviewer.
 *
 * An area is a department and a name again, which is what the institute's
 * matrix sheet carries and all it has ever needed to carry.
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
        $areas = DB::table('area_of_specializations')
            ->whereNotNull('expert_email')
            ->where('expert_email', '!=', '')
            ->get();

        foreach ($areas as $area) {
            $email = trim($area->expert_email);

            $alreadyKnown = DB::table('users')->where('email', $email)->exists()
                || DB::table('outside_experts')->where('email', $email)->exists();

            if (!$alreadyKnown) {
                $this->copyToOutsideExperts($area, $email);
            }
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

        // Which examiner belonged to which area is not recoverable: the columns
        // are gone and the copies in `outside_experts` say nothing about areas.
    }

    /**
     * `outside_experts` requires a name, designation, institution and
     * department, none of which the area columns guarantee. The department the
     * area belongs to is the closest true answer for the last one, and the rest
     * fall back to a marker an admin can search for and correct.
     */
    private function copyToOutsideExperts(object $area, string $email): void
    {
        $name = PersonName::split($area->expert_name);
        $departmentName = DB::table('departments')->where('id', $area->department_id)->value('name');
        $phone = trim((string) $area->expert_phone);

        DB::table('outside_experts')->insert([
            'first_name' => $name['first'] !== '' ? $name['first'] : 'Unknown',
            'last_name' => $name['last'],
            'designation' => trim((string) $area->expert_designation) ?: 'Unknown',
            'institution' => trim((string) $area->expert_college) ?: 'Unknown',
            'department' => $departmentName ?: 'Unknown',
            'email' => $email,
            // The column is unique, so a number already in use has to be left
            // off rather than collide the whole migration.
            'phone' => ($phone !== '' && !DB::table('outside_experts')->where('phone', $phone)->exists())
                ? $phone
                : null,
            'website' => $area->expert_website,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
};
