<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FacultyPublication extends Model
{
    use HasFactory;
    protected $table = 'faculty_publications';
    protected $fillable = [
        'faculty_code', 'title', 'authors', 'doi_link', 'year', 'name', 'publisher',
        'volume', 'page_no', 'issn', 'country', 'state', 'city', 'impact_factor',
        'publication_type', 'type', 'source', 'external_id', 'verified',
    ];
    protected $casts = [
        'verified' => 'boolean',
        'impact_factor' => 'float',
    ];
    protected $hidden = ['created_at', 'updated_at'];

    public function faculty()
    {
        return $this->belongsTo(Faculty::class, 'faculty_code', 'faculty_code');
    }
}
