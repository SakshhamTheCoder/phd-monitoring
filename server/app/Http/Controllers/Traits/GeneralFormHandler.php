<?php

namespace App\Http\Controllers\Traits;

trait GeneralFormHandler
{
    // The form's own chain and its stored fields come off the row via
    // fullForm(), so this needs nothing but the model and the id. It used to
    // take a $steps array and a $callback and read neither.
    private function handleStudentForm($user, $form_id, $modelClass)
    {
        try {
            $student = $user->student;
            if (!$student) {
                return response()->json(['message' => 'Student not found'], 404);
            }


            $formInstance = $modelClass::where('id', $form_id)->where('student_id', $student->roll_no)->first();

            if ($formInstance) {
                if ($formInstance->student->id == $student->id) {
                    return response()->json($formInstance->fullForm($user));
                } else {
                    return $this->refuse();
                }
            } else {
                return response()->json(['message' => 'No form found'], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    private function handleCoordinatorForm($user, $form_id, $modelClass)
    {
        try {

            $formInstance = $modelClass::find($form_id);
            if ($formInstance) {
                $student = $formInstance->student;
                if ($student->department->checkCoordinates($user->faculty->faculty_code)) {
                    $index = array_search('phd_coordinator', $formInstance->steps);
                    if ($index !== false && $index <= $formInstance->maximum_step)
                        return response()->json($formInstance->fullForm($user));
                    else
                        return response()->json(['message' => 'The form is not yet assigned to you for review or action.'], 404);
                } else {
                    return $this->refuse();
                }
            } else {
                return response()->json(['message' => 'No form found'], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    private function handleHodForm($user, $form_id, $modelClass)
    {
        try {
            $formInstance = $modelClass::find($form_id);
            if ($formInstance) {
                $student = $formInstance->student;
                if ($student->department->hod->faculty_code == $user->faculty->faculty_code) {
                    $index = array_search('hod', $formInstance->steps);
                    if ($index !== false && $index <= $formInstance->maximum_step)
                        return response()->json($formInstance->fullForm($user));
                    else
                        return response()->json(['message' => 'The form is not yet assigned to you for review or action.'], 404);
                } else {
                    return $this->refuse();
                }
            } else {
                return response()->json(['message' => 'No form found'], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    private function handleAdminForm($user, $form_id, $modelClass, $isAdmin = false)
    {
        try {
            $formInstance = $modelClass::find($form_id);
            if ($formInstance) {
                $index = array_search($user->current_role->role, $formInstance->steps);
                if ($isAdmin) {
                    return response()->json($formInstance->fullForm($user));
                }
                if ($index !== false && $index <= $formInstance->maximum_step)
                    return response()->json($formInstance->fullForm($user));
                else
                    return response()->json(['message' => 'The form is not yet assigned to you for review or action.'], 404);
            } else {
                return response()->json(['message' => 'No form found'], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    private function handleFacultyForm($user, $form_id, $modelClass)
    {
        try {
            $formInstance = $modelClass::find($form_id);
            if ($formInstance) {
                $student = $formInstance->student;
                if ($student->checkSupervises($user->faculty->faculty_code)) {
                    $index = array_search('faculty', $formInstance->steps);
                    if ($index !== false && $index <= $formInstance->maximum_step)
                        return response()->json($formInstance->fullForm($user));
                    else
                        return response()->json(['message' => 'The form is not yet assigned to you for review or action.'], 404);
                } else {
                    return $this->refuse();
                }
            } else {
                return response()->json(['message' => 'No form found'], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    private function handleDoctoralForm($user, $form_id, $modelClass)
    {
        try {
            $formInstance = $modelClass::find($form_id);
            if ($formInstance) {
                $student = $formInstance->student;
                if ($student->checkDoctoralCommittee($user->faculty->faculty_code)) {
                    $index = array_search('doctoral', $formInstance->steps);
                    if (!$index)
                        $index = array_search('external', $formInstance->steps);
                    if ($index !== false && $index <= $formInstance->maximum_step) {
                        $form = $formInstance->fullForm($user);
                        // Presentation and Synopsis route a committee member here
                        // while they hold 'faculty'. The page draws the chain up to
                        // the reader's role, so reporting 'faculty' hid the very
                        // panel they had been sent to answer.
                        if (!in_array($user->current_role->role, ['doctoral', 'external'], true)) {
                            $form['role'] = 'doctoral';
                        }
                        return response()->json($form);
                    }
                    else
                        return response()->json(['message' => 'The form is not yet assigned to you for review or action.'], 404);
                } else {
                    return $this->refuse();
                }
            } else {
                return response()->json(['message' => 'No form found'], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }

    /**
     * The ADORDC reads any form and answers none: they hold no step in any
     * chain, so no submit() routes to them and every panel the client draws is
     * locked. There is nothing to gate on, so there is no index check here.
     *
     * The department scoping this used to apply is off for now, kept below so it
     * can be put back:
     *
     *   $adordc = $formInstance->student->department->adordc;
     *   if (!$adordc || $adordc->faculty_code !== $user->faculty->faculty_code) {
     *       return $this->refuse();
     *   }
     */
    private function handleAdordcForm($user, $form_id, $modelClass)
    {
        try {
            $formInstance = $modelClass::find($form_id);

            if (!$formInstance) {
                return response()->json(['message' => 'No form found'], 404);
            }

            return response()->json($formInstance->fullForm($user));
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }
    }
}
