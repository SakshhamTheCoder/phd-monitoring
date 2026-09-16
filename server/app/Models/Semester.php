<?php
namespace App\Models;

use App\Http\Controllers\Traits\HasSemesterCodeValidation;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;


class Semester extends Model
{
    use HasFactory, HasSemesterCodeValidation;

    protected $fillable = [
        'semester_name',
        'start_date',
        'end_date',
        'year',
        'semester',
        'ppt_file',
        'notification',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'year' => 'integer',
        'notification' => 'boolean',
    ];

    /**
     * The term we are in now, worked out from the date rather than looked up.
     *
     * An academic year runs July to June and is written as the two years it
     * spans: July 2025 to June 2026 is 2526, odd until December and even from
     * January. Reading it from the calendar means it is never wrong because
     * nobody remembered to add a row.
     */
    public static function currentTerm(?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now();
        $odd = $now->month >= 7;
        $from = $odd ? $now->year : $now->year - 1;

        return [
            'code' => sprintf('%02d%02d%s', $from % 100, ($from + 1) % 100, $odd ? 'ODD' : 'EVEN'),
            'year' => $from,
            'semester' => $odd ? 1 : 2,
        ];
    }

    /**
     * Create or update a semester using a semester code.
     */
    public static function createOrUpdateFromCode(string $semesterCode, ?string $startDate = null, ?string $endDate = null): ?self
    {
        $validator = new self();
        $result = $validator->validateSemesterCode($semesterCode);

        if (!$result['valid']) {
            return null;
        }

        $semester = self::where('semester_name', $semesterCode)->first();

        if ($semester) {
            // Just update start and end dates if given
            $semester->fill([
                'start_date' => $startDate ?? $semester->start_date,
                'end_date' => $endDate ?? $semester->end_date,
            ]);
            $semester->save();
        } else {
            // New semester
            $semester = self::create([
                'semester_name' => $semesterCode,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'year' => $result['year'],
                'semester' => $result['semester'],
            ]);
        }

        return $semester;
    }

    // Relationships and accessors
    public function studentsOnSemesterOff()
    {
        return Student::whereHas('semester_offs', function ($query) {
            $query->whereHas('semesterOffForm', function ($q) {
                $q->where('semester_id', $this->id);
            });
        });
    }
    
    public function scheduledPresentations()
    {
        return Presentation::where('semester_id', $this->id);
    }

    public function unscheduledStudents()
    {
        return Student::whereDoesntHave('presentations', function ($query) {
            $query->where('semester_id', $this->id);
        });
    }
    public function presentations()
    {
        return $this->hasMany(Presentation::class);
    }
    public function presentationsLeave()
    {
        return $this->hasMany(Presentation::class)->where('leave', true);
    }
    public function presentationsMissed()
    {
        return $this->hasMany(Presentation::class)->where('missed', true);
    }
}
