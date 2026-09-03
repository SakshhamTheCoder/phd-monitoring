<?php

namespace App\Services;

use App\Models\Faculty;

class FacultyRecommendationService
{
    private const SYNONYMS = [
        'ml' => 'machine learning', 'ai' => 'artificial intelligence', 'cv' => 'computer vision',
        'nlp' => 'natural language processing', 'dl' => 'deep learning', 'dm' => 'data mining',
        'rl' => 'reinforcement learning', 'iot' => 'internet of things', 'wcn' => 'wireless communication',
        'vlsi' => 'vlsi', 'cad' => 'computer aided design', 'cn' => 'computer networks',
        'os' => 'operating systems', 'hci' => 'human computer interaction', 'ir' => 'information retrieval',
        'se' => 'software engineering',
    ];
    private const TYPO_MAP = ['inetlligence'=>'intelligence','intellignce'=>'intelligence','cybersec'=>'cybersecurity','cyber sec'=>'cybersecurity','defense'=>'defence'];
    private const STOPWORDS = ['and','or','of','the','in','for','on','with','to','a','an','by','from','using','based','via','&','-'];
    private const DOMAINS = [
        ['artificial','intelligence','machine','learning','deep','neural','data','mining','pattern','vision','language','processing','recognition','science','analytics'], // ai/ml
        ['cyber','security','network','defence','cryptography','blockchain','hacking','infosec','netsec'], // security
        ['wireless','communication','vlsi','embedded','iot','cloud','fog','edge'], // comm
        ['software','engineering','operating','system','distributed','database'], // systems
    ];

    public function recommend(array $queryAreas, ?int $departmentId = null, int $limit = 8): array
    {
        // Resolve numeric specialization ids in one query (N+1 → whereIn)
        $trimmed = array_map(fn($a) => trim((string)$a), $queryAreas);
        $numericIds = array_values(array_filter(array_map(fn($a) => $a !== '' && ctype_digit($a) ? (int)$a : null, $trimmed)));
        if ($numericIds) {
            $map = \App\Models\AreaOfSpecialization::whereIn('id', $numericIds)->pluck('broad_area', 'id');
            $trimmed = array_map(function ($a) use ($map) {
                $t = trim((string)$a);
                return $t !== '' && ctype_digit($t) && isset($map[(int)$t]) ? $map[(int)$t] : $a;
            }, $trimmed);
        }
        $queryAreas = array_values(array_filter(array_map('trim', $trimmed)));
        if (!$queryAreas) return [];
        $queryTokens = $this->tokens(implode(' ', $queryAreas));
        if (!$queryTokens) return [];

        // Use cursor() to avoid loading all 500+ rows into memory at once; still scores all
        // but streams. Returns only top 8 after scoring.
        $baseQuery = Faculty::with(['user','department'])->when($departmentId, fn($q) => $q->where('department_id', $departmentId));
        $faculties = collect($baseQuery->cursor());
        if ($faculties->filter(fn($f) => !empty($f->expertise))->count() < 3 && $departmentId) {
            $fallback = Faculty::with(['user','department'])->where('department_id','!=',$departmentId)->cursor();
            $faculties = $faculties->merge(collect($fallback));
        }

        $docs = [];
        foreach ($faculties as $f) {
            $text = is_array($f->expertise) ? implode(' ', $f->expertise) : (string)($f->expertise ?? '');
            if (!$text) $text = $f->department->name ?? '';
            $docs[$f->faculty_code] = $this->tokens($text);
        }
        $docs['_query'] = $queryTokens;

        $df = []; foreach ($docs as $tokens) foreach (array_unique($tokens) as $t) $df[$t] = ($df[$t] ?? 0) + 1;
        $N = count($docs); $idf = []; foreach ($df as $term => $freq) $idf[$term] = log($N / $freq);

        $vectors = [];
        foreach ($docs as $key => $tokens) {
            $tf = array_count_values($tokens); $len = count($tokens) ?: 1; $vec = [];
            foreach ($tf as $term => $cnt) $vec[$term] = ($cnt / $len) * ($idf[$term] ?? 0);
            $vectors[$key] = $vec;
        }

        $qVec = $vectors['_query']; $qNorm = sqrt(array_sum(array_map(fn($v) => $v*$v, $qVec))) ?: 1;
        $scored = [];
        foreach ($faculties as $f) {
            $vec = $vectors[$f->faculty_code] ?? []; if (!$vec) continue;
            $norm = sqrt(array_sum(array_map(fn($v) => $v*$v, $vec))) ?: 1;
            $dot = 0; foreach ($qVec as $term => $w) {
                if (isset($vec[$term])) $dot += $w * $vec[$term];
                else foreach ($vec as $ft => $fw) if ($this->isFuzzyMatch($term, $ft)) { $dot += $w * $fw * 0.7; break; }
            }
            $score = $dot / ($qNorm * $norm);
            // domain boost: same meaning area (ai↔ml, cyber↔network defence) via shared domain keywords
            foreach (self::DOMAINS as $domain) {
                $qHas = (bool) array_intersect($queryTokens, $domain);
                $fHas = (bool) array_intersect(array_keys($vec), $domain);
                if ($qHas && $fHas) { $score += 0.35; break; }
            }
            if ($score < 0.01) {
                $inter = count(array_intersect($queryTokens, array_keys($vec)));
                $union = count(array_unique(array_merge($queryTokens, array_keys($vec))));
                $score = $union ? $inter / $union * 0.5 : 0;
            }
            $scored[] = [
                'faculty_code' => $f->faculty_code, 'name' => $f->user?->name() ?? '—',
                'email' => $f->user?->email ?? '—', 'department' => $f->department->name ?? '—',
                'designation' => $f->designation, 'expertise' => $f->expertise ?? [],
                'score' => round($score, 3), 'percent' => (int) round(min(0.99, $score) * 100),
            ];
        }
        usort($scored, fn($a,$b) => $b['score'] <=> $a['score']);
        return array_values(array_filter(array_slice($scored, 0, $limit), fn($r) => $r['score'] > 0.01));
    }

    private function tokens(string $text): array
    {
        $text = strtolower($text);
        foreach (self::SYNONYMS as $abbr => $exp) $text = preg_replace('/\b'.preg_quote($abbr,'/').'\b/', $exp, $text);
        foreach (self::TYPO_MAP as $typo => $correct) $text = str_replace($typo, $correct, $text);
        $text = str_replace(['/', '-', '_', ','], ' ', $text);
        // cybersecurity must expand before plural strip else rtrim('s') mangles it → cybersecurit
        $text = str_replace('cybersecurity', 'cyber security', $text);
        $tokens = preg_split('/[^a-z0-9]+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        $tokens = array_filter($tokens, fn($t) => !in_array($t, self::STOPWORDS, true) && strlen($t) > 1);
        $tokens = array_map(fn($t) => rtrim($t, 's'), $tokens);
        return array_values(array_filter($tokens, fn($t) => strlen($t) > 1));
    }
    private function isFuzzyMatch(string $a, string $b): bool
    {
        if ($a === $b) return true;
        if (abs(strlen($a) - strlen($b)) > 2) return false;
        return levenshtein($a, $b) <= 2;
    }
}
