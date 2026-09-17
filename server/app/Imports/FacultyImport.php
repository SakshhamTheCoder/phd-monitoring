<?php
namespace App\Imports;

use App\Models\User;
use App\Models\Faculty;

use Illuminate\Support\Facades\Hash;

class FacultyImport 
{
    public function model(array $row)
    {
        // Ensure proper indices from Excel columns
        $name = $row[2];
        $phone = $row[3]; 
        $email = $row[1];
        $faculty_code = $row[1]; 

       
        $user = User::create([
            'first_name' => $name,
            'email' => $email,
            'password' => Hash::make('default_password'),
            'password_set_at' => now(),
        ]);

        return new Faculty([
            'user_id' => $user->id,
            'faculty_code' => $faculty_code,
        ]);
    }
}
