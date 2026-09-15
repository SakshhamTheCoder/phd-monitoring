<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Publication extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'student_id',
        'form_id',
        'form_type',
        'title',
        'authors',
        'doi_link',
        'first_page',
        'year',
        'name',
        'status',
        'country',
        'state',
        'city',
        'publisher',
        'volume',
        'page_no',
        'issn',
        'publication_type',
        'type',
        'impact_factor',
    ];
    protected $table = 'publications';
    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'impact_factor' => 'float',
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'created_at',
        'updated_at',
    ];

    /**
     * Get the student associated with the publication.
     */
    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'roll_no');
    }

    /**
     * The column a user's publications and patents are filed under, and its
     * value: a scholar's roll number, or a URF fellow's project. The value is
     * null when the user has neither yet.
     */
    public static function ownerOf(User $user, $applicationId = null): array
    {
        if ($user->current_role?->role === 'ug_student') {
            // Each URF project keeps its own library: the project asked for, if
            // the student is on it, otherwise their latest.
            $application = $applicationId
                ? UrfApplication::forMember($user)->find($applicationId)
                : UrfApplication::forUser($user);

            return ['urf_application_id', $application?->id];
        }

        return ['student_id', $user->student?->roll_no];
    }

    /**
     * One owner's publications and patents, grouped as the publications page
     * lists them: the unlinked library by default, or the copies linked to one
     * form when a form is named.
     */
    public static function groupedFor(string $column, $id, ?int $formId = null, ?string $formType = null): array
    {
        $scope = fn ($query) => $formId === null
            ? $query->whereNull('form_id')
            : $query->where('form_id', $formId)->where('form_type', $formType);
        $publications = $scope(static::where($column, $id));
        $conference = fn ($type) => $publications->clone()->where('publication_type', 'conference')->where('type', $type)->get();

        return [
            'sci' => $publications->clone()->where('publication_type', 'journal')->where('type', 'sci')->get(),
            'non_sci' => $publications->clone()->where('publication_type', 'journal')->where('type', 'non-sci')->get(),
            'national' => $conference('national'),
            'international' => $conference('international'),
            'book' => $publications->clone()->where('publication_type', 'book')->get(),
            'patents' => $scope(Patent::where($column, $id))->get(),
        ];
    }
}
