<?php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Faculty;
use App\Models\Project;
use App\Models\PositionApplication;

class ProjectsDemoSeeder extends Seeder {
    public function run(): void {
        $faculty = Faculty::first();
        if (!$faculty) {
            $this->command->warn('No faculty found; skipping ProjectsDemoSeeder.');
            return;
        }
        $piCode = $faculty->faculty_code;

        $demos = [
            [
                'title' => 'Neural Architecture Search for Edge Computing',
                'category' => 'Research', 'funding_agency' => 'SERB, Govt. of India',
                'amount' => 4850000, 'tiet_share' => 3200000, 'role' => 'PI', 'status' => 'Active',
                'start_date' => '2023-10-01', 'end_date' => '2026-10-01', 'duration_years' => 3, 'duration_months' => 0,
                'description' => 'Differentiable NAS for edge-deployable deep learning models.',
                'focus_area' => 'AI/ML & IoT', 'grant_type' => 'CRG (Core Research Grant)',
                'co_pis' => [
                    ['type' => 'internal', 'name' => 'Dr. Amit Sharma', 'department' => 'Computer Science & Engineering', 'designation' => 'Professor'],
                    ['type' => 'external', 'name' => 'Dr. Robert Chen', 'institute' => 'MIT CSAIL', 'designation' => 'Senior Researcher'],
                ],
                'objectives' => [
                    ['title' => 'Lightweight NAS Framework', 'description' => 'NAS tailored for heterogeneous edge devices.'],
                    ['title' => 'Multi-Objective Optimization', 'description' => 'Balance latency, energy, and accuracy.'],
                ],
                'budget' => [
                    'year1' => ['Manpower' => 500000, 'Travel' => 150000, 'Equipment' => 800000, 'Contingency' => 100000, 'Overhead' => 50000],
                    'year2' => ['Manpower' => 600000, 'Travel' => 200000, 'Equipment' => 300000, 'Contingency' => 150000, 'Overhead' => 50000],
                    'year3' => ['Manpower' => 600000, 'Travel' => 250000, 'Equipment' => 0, 'Contingency' => 100000, 'Overhead' => 50000],
                ],
                'equipment_details' => [['item' => 'GPU Workstation (NVIDIA A100)', 'amount' => 650000]],
                'milestones' => [
                    ['name' => 'Literature Review', 'deliverable' => 'Review Paper', 'due_date' => '2024-03-15', 'status' => 'Completed'],
                    ['name' => 'Algorithm Design', 'deliverable' => 'NAS Implementation', 'due_date' => '2024-09-30', 'status' => 'Completed'],
                    ['name' => 'Prototype Development', 'deliverable' => 'Edge Prototype', 'due_date' => '2025-06-30', 'status' => 'In Progress'],
                    ['name' => 'Publication', 'deliverable' => 'SCI Paper', 'due_date' => '2026-06-30', 'status' => 'Not Started'],
                ],
                'positions' => [
                    [
                        'type' => 'JRF', 'title' => 'Junior Research Fellow — NAS Project', 'openings' => 1,
                        'stipend' => '₹31,000/month', 'deadline' => '2026-12-15',
                        'eligibility' => 'M.Tech / M.E. in CS or ECE', 'skills' => 'Python, PyTorch, NAS', 'min_cgpa' => '7.5',
                        'description' => 'Work on differentiable NAS for edge-deployable models; run large-scale experiments and co-author publications.',
                        'applications' => [
                            ['name' => 'Rahul Verma', 'email' => 'rahul.verma@example.com', 'phone' => '+91-98765-43210', 'degree' => 'M.Tech CS', 'institute' => 'IIT Delhi', 'cgpa' => '9.2', 'research' => 'Neural Architecture Search', 'skills' => ['Python', 'PyTorch', 'NAS'], 'status' => 'Shortlisted', 'applied_date' => '2026-07-10'],
                            ['name' => 'Priya Mehta', 'email' => 'priya.mehta@example.com', 'phone' => '+91-99887-66554', 'degree' => 'M.Tech ECE', 'institute' => 'NIT Trichy', 'cgpa' => '8.8', 'research' => 'Edge AI', 'skills' => ['TensorFlow', 'Edge Computing'], 'status' => 'Applied', 'applied_date' => '2026-07-12'],
                        ],
                    ],
                ],
            ],
            [
                'title' => 'Optimizing Urban Logistics using Multi-Agent RL',
                'category' => 'Consultancy', 'funding_agency' => 'LogiTech Solutions Inc.',
                'amount' => 4550000, 'tiet_share' => 4550000, 'role' => 'Co-PI', 'status' => 'Completed',
                'start_date' => '2022-01-15', 'end_date' => '2023-12-31', 'duration_years' => 2, 'duration_months' => 0,
                'description' => 'Industry consultancy to optimize last-mile delivery routing using MARL.',
                'focus_area' => 'AI/ML & Operations Research', 'grant_type' => 'Consultancy',
                'co_pis' => [], 'objectives' => [['title' => 'Route Optimization', 'description' => 'MARL-based dynamic routing.']],
                'budget' => ['year1' => ['Manpower' => 800000, 'Equipment' => 500000], 'year2' => ['Manpower' => 900000, 'Equipment' => 200000]],
                'equipment_details' => [],
                'milestones' => [['name' => 'Final Report', 'deliverable' => 'Completion Report', 'due_date' => '2023-12-15', 'status' => 'Completed']],
                'positions' => [
                    ['type' => 'Research Intern', 'title' => 'ML Intern — Logistics', 'openings' => 2, 'stipend' => '₹15,000/month', 'deadline' => '2023-07-30', 'eligibility' => 'B.E./B.Tech CS/EE', 'skills' => 'Python, ML', 'min_cgpa' => '7.0', 'description' => 'Support MARL routing engine development (closed).'],
                ],
            ],
            [
                'title' => 'Global Green Hydrogen Research Initiative Phase II',
                'category' => 'International', 'funding_agency' => 'UNESCO - Clean Tech',
                'amount' => 24000000, 'tiet_share' => 8000000, 'role' => 'Technical Advisor', 'status' => 'Active',
                'start_date' => '2024-01-01', 'end_date' => '2027-01-01', 'duration_years' => 3, 'duration_months' => 0,
                'description' => 'International collaboration on green hydrogen via advanced PEM electrolysis.',
                'focus_area' => 'Renewable Energy', 'grant_type' => 'International Collaboration',
                'co_pis' => [], 'objectives' => [['title' => 'Advanced Electrolysis', 'description' => 'Next-gen PEM cells at 90%+ efficiency.']],
                'budget' => ['year1' => ['Manpower' => 2000000, 'Equipment' => 3000000], 'year2' => ['Manpower' => 2500000, 'Equipment' => 2000000]],
                'equipment_details' => [['item' => 'PEM Electrolysis Stack', 'amount' => 2500000]],
                'milestones' => [['name' => 'Cell Design', 'deliverable' => 'PEM Prototype', 'due_date' => '2025-06-01', 'status' => 'In Progress']],
                'positions' => [
                    ['type' => 'JRF', 'title' => 'Junior Research Fellow — Green Hydrogen', 'openings' => 2, 'stipend' => '₹37,000/month', 'deadline' => '2026-09-30', 'eligibility' => 'M.Tech / M.Sc (Energy, Chemical, Materials)', 'skills' => 'Electrochemistry, PEM, MATLAB', 'min_cgpa' => '7.5', 'description' => 'Design and test next-generation PEM electrolysis cells; collaborate with ETH Zurich.'],
                ],
            ],
        ];

        foreach ($demos as $d) {
            $milestones = $d['milestones'] ?? [];  unset($d['milestones']);
            $positions = $d['positions'] ?? [];    unset($d['positions']);
            $project = Project::updateOrCreate(
                ['title' => $d['title']],
                array_merge($d, ['pi_faculty_code' => $piCode])
            );
            $project->milestones()->delete();
            foreach ($milestones as $m) $project->milestones()->create($m);
            $project->positions()->delete();  // FK cascade removes old applications
            foreach ($positions as $pos) {
                $apps = $pos['applications'] ?? [];  unset($pos['applications']);
                $position = $project->positions()->create($pos);
                foreach ($apps as $a) {
                    PositionApplication::create(array_merge($a, [
                        'position_id' => $position->id,
                        'project_id' => $project->id,
                    ]));
                }
            }
        }
        $this->command->info('Seeded ' . count($demos) . ' demo projects (owned by faculty ' . $piCode . ').');
    }
}
