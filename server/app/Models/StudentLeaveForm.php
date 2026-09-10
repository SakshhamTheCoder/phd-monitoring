<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\ModelCommonFormFields;

class StudentLeaveForm extends Model
{
    use HasFactory, ModelCommonFormFields;

    protected $table = 'student_leave_forms';
    protected $fillable;

    protected $casts = [
        'from_date' => 'date',
        'to_date' => 'date',
        'history' => 'array',
        'steps' => 'array',
    ];

    public function __construct(array $attributes = [])
    {
        $commonFieldKeys = array_keys($this->getCommonFields() ?? []);
        $this->fillable = array_merge([
            'leave_type',
            'from_date',
            'to_date',
            'day_part',
            'reason',
            'supporting_document',
        ], $commonFieldKeys);

        parent::__construct($attributes);
    }

    /**
     * Get the full form data including common fields.
     */
    public function fullForm($user)
    {
        $commonJSON = $this->fullCommonForm($user);
        return array_merge($commonJSON, [
            'leave_type' => $this->leave_type,
            'from_date' => $this->from_date,
            'to_date' => $this->to_date,
            'day_part' => $this->day_part,
            'reason' => $this->reason,
            'supporting_document' => $this->supporting_document,
        ]);
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /** A half-day still excuses the whole day; it only changes what it costs. */
    public function isHalfDay(): bool
    {
        return in_array($this->day_part, ['first_half', 'second_half'], true);
    }
}
