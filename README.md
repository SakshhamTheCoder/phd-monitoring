# Doctoral, Research & Innovation Management Portal

A role-based web portal for managing the PhD lifecycle and research administration at Thapar Institute of Engineering and Technology (TIET), Patiala.

Live at [phdportal.thapar.edu](https://phdportal.thapar.edu). Meet the team on the portal's [Team page](https://phdportal.thapar.edu/team).

> **Source code is private.** This repository holds only the overview, screenshots and architecture notes. The code belongs to the institute project, and the portal handles real academic records.

## What it does

A doctoral programme runs on approvals. A synopsis, a thesis, an IRB constitution or a semester leave passes through many offices, and each one can approve, reject or return it. Before the portal, that ran on paper forms and spreadsheets: nobody could see where a form had stopped, and rejection reasons got lost in email.

The portal replaces that with one system:

- **Workflow forms.** A dozen-plus doctoral forms (progress reports, synopsis, thesis, IRB constitution, examiner lists, title revision, semester leave, supervisor change and others). Each form carries its own state, its transition history and its rejection reasons.
- **Configurable approval chains.** Who approves a form, and in what order, is stored as data. Departments with different hierarchies share one workflow engine.
- **Status tracking and notifications.** Every transition notifies the next approver and the submitter. A failed email never blocks a transition.
- **Student progress.** Course work, qualifying exams, committee, supervisor allotment, key dates and overall progress on one page per scholar.
- **Faculty research profiles and publications.** Publications are entered once and linked to faculty and scholar records. Publication data syncs from faculty Scopus profiles.
- **Research projects.** Internal and external projects with investigators, funding and recruitment.
- **Progress presentations.** Scheduling with Google Calendar invitations to the student, supervisor and committee.
- **Undergraduate research fellowship (URF).** Applications, review, reports and dashboards.
- **Admin tooling.** Departments, courses, faculty, bulk CSV import, attendance for clerks, feature flags and per-role menus.

## Roles

Doctoral student, supervisor, doctoral committee member, PhD Coordinator, Head of Department, Doctoral Research Advisor, Associate Dean (RDC), Dean (RDC), Director, administrator, clerk, and outside experts with a restricted, no-approval role. Access is checked on the server for every record and document. The browser never decides.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Vite, Tailwind CSS, React Hook Form |
| Backend | Laravel 11 on PHP 8.2, REST API, Laravel Sanctum token auth |
| Mobile | Flutter and Dart app on the same REST API. Screens are drawn from page and form descriptions the server sends. Session token in the platform keystore. |
| Database | MySQL with versioned migrations |
| Integrations | Google OAuth, Google Calendar API, Cloudflare Turnstile, SMTP mail, Scopus |
| Testing | PHPUnit feature and unit tests, Vitest |
| Delivery | GitHub Actions triggers a Jenkins pipeline that builds and deploys behind nginx; a queue worker runs under Supervisor |

More detail: [Architecture](docs/architecture.md).

## Status

In service at TIET since the first pilot in the Department of Chemical Engineering, now rolling out to other departments. The Flutter mobile app is built on the same API (separate private repository). In development: supervisor recommendation using semantic similarity and analytics dashboards.

## Team

Mentor: Dr. Tarunpreet Bhatia, Associate Dean of Strategic Initiatives and Associate Professor, CSED, TIET.

Built by Aadi Jain, Abhinav Jain, Akarsh Srivastava, Nandini Jain, Arnav Raj Singh, Ishwin, Manjot Kaur, Sakshham Bhagat and Saumil Makkar.

Sakshham Bhagat worked on the backend and app development, and maintains this page.

## Screenshots

Screenshots use demo data only.

_To be added._

## Contact

Open an issue on this repository, or find the team on the portal's Team page.
