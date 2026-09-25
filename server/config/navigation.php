<?php

/*
 * Who may reach each area of the portal, the sidebar in the order it is drawn,
 * and the quick-access tiles on the office home page. One list, read by
 * App\Support\Navigation, which answers GET /me for the web and the app alike.
 *
 * `area` names who may reach a page; `feature` hides it while a module is
 * switched off; `capability` (any one of a list) hides it from a role that may
 * reach it only sometimes. Icons are Font Awesome names without the prefix.
 */

// The review chain above a supervisor, spelled out once.
$reviewChain = ['hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director'];
$everyoneButClerk = array_merge(['student', 'ug_student', 'faculty', 'doctoral', 'external', 'admin'], $reviewChain);

return [
    'areas' => [
        'home' => $everyoneButClerk,
        'notifications' => $everyoneButClerk,

        'projects' => array_merge(['faculty', 'admin'], $reviewChain),
        'presentations' => array_merge(['student', 'faculty', 'doctoral', 'admin'], $reviewChain),

        // Everything hung off a scholar: their profile, their forms, their history.
        'scholars' => array_merge(['faculty', 'doctoral', 'external', 'admin'], $reviewChain),

        'facultyDirectory' => $everyoneButClerk,

        'departments' => ['dordc', 'dra', 'director', 'admin'],
        'supervisorApprovals' => ['dordc', 'admin'],

        // Mentors reach URF too, but only while they mentor something, which is
        // why the sidebar pairs this with a capability.
        'urf' => array_merge(['faculty', 'admin'], $reviewChain),

        'attendance' => ['clerk', 'student', 'hod', 'admin'],

        'courses' => ['student', 'hod', 'phd_coordinator', 'admin'],
        'courseManagement' => ['hod', 'phd_coordinator', 'admin'],

        // HoD and coordinators manage their own department's areas only; the
        // server scopes them.
        'areasOfSpecialization' => ['hod', 'phd_coordinator', 'admin'],

        'publications' => ['student', 'ug_student'],
        'openings' => ['student'],

        'admin' => ['admin'],
    ],

    'nav' => [
        // A UG student's home is their profile, so it is named for what it shows.
        ['path' => '/home', 'icon' => 'user', 'label' => 'Profile', 'roles' => ['ug_student']],
        ['path' => '/home', 'icon' => 'home', 'label' => 'Home', 'area' => 'home', 'except' => ['ug_student']],
        ['path' => '/projects', 'icon' => 'briefcase', 'label' => 'Projects', 'area' => 'projects', 'feature' => 'project_management'],
        ['path' => '/forms', 'icon' => 'file-text', 'label' => 'Forms', 'area' => 'home'],
        ['path' => '/presentation', 'icon' => 'tasks', 'label' => 'Progress Monitoring', 'area' => 'presentations'],
        ['path' => '/publications', 'icon' => 'book', 'label' => 'Publications', 'area' => 'publications'],
        // The office owns the page and a mentor reaches it while they mentor.
        ['path' => '/urf', 'icon' => 'flask', 'label' => 'URF', 'area' => 'urf', 'capability' => ['can_manage_urf', 'can_read_urf_mentees']],
        ['path' => '/openings', 'icon' => 'bullhorn', 'label' => 'Openings', 'area' => 'openings', 'feature' => 'job_openings'],
        ['path' => '/courses', 'icon' => 'graduation-cap', 'label' => 'Courses', 'area' => 'courses'],
        ['path' => '/students', 'icon' => 'users', 'label' => 'Students', 'area' => 'scholars'],
        ['path' => '/faculty', 'icon' => 'id-badge', 'label' => 'Faculty', 'area' => 'facultyDirectory'],
        ['path' => '/clerks', 'icon' => 'id-card-o', 'label' => 'Clerks', 'area' => 'admin'],
        ['path' => '/departments', 'icon' => 'building', 'label' => 'Departments', 'area' => 'departments'],
        ['path' => '/supervisor-doctoral-approvals', 'icon' => 'user-plus', 'label' => 'Supervisor Approvals', 'area' => 'supervisorApprovals'],
        ['path' => '/attendance', 'icon' => 'calendar-check-o', 'label' => 'Attendance', 'area' => 'attendance'],
        ['path' => '/configuration', 'icon' => 'sliders', 'label' => 'Configuration', 'area' => 'admin'],
        ['path' => '/logs', 'icon' => 'history', 'label' => 'Logs', 'area' => 'admin'],
        ['path' => '/users', 'icon' => 'cogs', 'label' => 'Manage Users', 'area' => 'admin'],
        ['path' => '/notifications', 'icon' => 'bell', 'label' => 'Notifications', 'area' => 'notifications'],
        ['path' => '/areasOfSpecialization', 'icon' => 'list', 'label' => 'Areas of Specialization', 'area' => 'areasOfSpecialization'],
        ['path' => '/outside-experts', 'icon' => 'user-o', 'label' => 'Outside Experts', 'area' => 'admin'],
    ],

    // The office home's quick links: the part of the sidebar worth a tile, with
    // the tiles' own labels. A tile follows its sidebar entry (who may reach it,
    // its module, its capability, its icon) unless it says otherwise.
    'tiles' => [
        ['path' => '/students', 'label' => 'Students'],
        ['path' => '/faculty', 'label' => 'Faculty'],
        ['path' => '/departments', 'label' => 'Departments'],
        ['path' => '/forms', 'label' => 'Forms'],
        ['path' => '/presentation', 'label' => 'Presentations'],
        ['path' => '/courses', 'label' => 'Courses'],
        ['path' => '/projects', 'label' => 'Projects'],
        ['path' => '/urf', 'label' => 'URF'],
        ['path' => '/publications', 'label' => 'Publications'],
        ['path' => '/attendance', 'label' => 'Mark attendance'],
        ['path' => '/supervisor-doctoral-approvals', 'label' => 'Supervisor approvals'],
        ['path' => '/clerks', 'label' => 'Clerks'],
        ['path' => '/configuration', 'label' => 'Configuration'],
        ['path' => '/users', 'label' => 'Manage users'],
        ['path' => '/areasOfSpecialization', 'label' => 'Areas of specialization'],
        ['path' => '/outside-experts', 'label' => 'Outside experts'],
        ['path' => '/logs', 'label' => 'Activity logs'],
        // Not in the sidebar: reached from a scholar's profile.
        ['path' => '/forms/manage', 'label' => 'Manage forms', 'area' => 'admin', 'icon' => 'pencil-square-o'],
    ],
];
