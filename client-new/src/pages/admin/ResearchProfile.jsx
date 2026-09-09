import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import AddPublication from '../../components/publications/AddPublication';
import CustomModal from '../../components/forms/modal/CustomModal';
import Tabs from '../../components/tabs/Tabs';
import PageHeader from '../../components/pageHeader/PageHeader';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import { baseURL } from '../../api/urls';
import { generateAvatar } from '../../utils/profileImage';
import { formatDate } from '../../data/projectsData';
import { badgeClass } from '../../data/badges';
import {
    apiResearchProfile, apiUpdateResearchProfile, apiSyncPublications,
    apiAddFacultyPublication, apiUpdateFacultyPublication, apiDeleteFacultyPublication,
} from '../../api/researchProfile';
import { apiCurrentFaculty } from '../../api/projects';
import { toast } from 'react-toastify';
import { profileIdentity, isProfileAuthor, splitAuthors } from '../../utils/authorMatch';
import './ResearchProfile.css';

const TYPE_OPTIONS = [
    { value: 'sci', label: 'SCI/SCIE/SSCI/ABDC/AHCI Journal' },
    { value: 'non_sci', label: 'Papers in Scopus Journal' },
    { value: 'international', label: 'Papers in International Conferences' },
    { value: 'national', label: 'Papers in National Conferences' },
    { value: 'book', label: 'Book/Book Chapters' },
    { value: 'patents', label: 'Patents' },
    { value: 'uncategorised', label: 'Unclassified (needs a category)' },
];

const SOURCE_LABELS = { scopus: 'Scopus', orcid: 'ORCID', manual: 'Manual', student: 'Student' };

/**
 * The table a publication appears in is derived on the server from
 * publication_type plus type, so moving a row between tables means setting both.
 * This is the inverse of that mapping.
 *
 * Note `patents` is the table key while the stored publication_type is the
 * singular `patent`, which is what the API validates against.
 */
const CATEGORY_TO_FIELDS = {
    sci: { publication_type: 'journal', type: 'sci' },
    non_sci: { publication_type: 'journal', type: 'non-sci' },
    international: { publication_type: 'conference', type: 'international' },
    national: { publication_type: 'conference', type: 'national' },
    book: { publication_type: 'book', type: null },
    patents: { publication_type: 'patent', type: null },
};

const emptyIdentifiers = {
    orcid_id: '', scopus_id: '', google_scholar_id: '', joined_on: '', citations: '', h_index: '', expertise: '',
};

const ResearchProfile = ({ facultyCode: codeProp = null, embedded = false }) => {
    // No code in the URL and none passed in means "my own profile".
    const { facultyCode: routeCode } = useParams();
    const navigate = useNavigate();
    const [facultyCode, setFacultyCode] = useState(routeCode || codeProp || null);
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState(null);
    const [filterYears, setFilterYears] = useState([]);
    const [filterType, setFilterType] = useState('All');
    const [filterSource, setFilterSource] = useState('All');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(false);
    const [identifiers, setIdentifiers] = useState(emptyIdentifiers);
    const [showPubForm, setShowPubForm] = useState(false);
    const [editPub, setEditPub] = useState(null);
    // Ids ticked for bulk reclassification. Imported publications arrive with
    // only the category their source could prove, so moving a batch at once is
    // the difference between a short chore and twenty trips through the modal.
    const [selected, setSelected] = useState([]);
    const [bulkTarget, setBulkTarget] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showResearch, setShowResearch] = useState(false);
    // An admin has no faculty record, so "my own profile" does not exist for
    // them. Without this the page waited on a code that was never coming.
    const [resolving, setResolving] = useState(!routeCode && !codeProp);

    // Embedded on the dashboard, the page chrome is the host's job.
    const Shell = embedded ? React.Fragment : Layout;

    const load = useCallback(async () => {
        if (!facultyCode) return;
        const res = await apiResearchProfile(facultyCode);
        if (res) setData(res);
    }, [facultyCode]);

    useEffect(() => {
        if (routeCode) { setFacultyCode(routeCode); setResolving(false); return; }
        if (codeProp) { setFacultyCode(codeProp); setResolving(false); return; }
        apiCurrentFaculty()
            .then(f => { if (f) setFacultyCode(f.id); })
            .finally(() => setResolving(false));
    }, [routeCode, codeProp]);

    useEffect(() => { load(); }, [load]);

    if (resolving) return <Shell><div className="loading-state">Loading Profile...</div></Shell>;

    // No code in the URL and no faculty record of our own: pick whose to show.
    if (!facultyCode) {
        return (
            <Shell>
                <PageHeader
                    title="Faculty Profile"
                    subtitle="Your account is not linked to a faculty record, so pick whose profile to open."
                />
                <div className="card" style={{ maxWidth: '520px' }}>
                    <InputSuggestions
                        apiUrl={`${baseURL}/suggestions/faculty`}
                        label="Find a faculty member"
                        hint="Type a name, code or email..."
                        fields={['name', 'department']}
                        onSelect={(f) => f && f.id && navigate(`/faculty/${f.id}/profile`)}
                    />
                </div>
            </Shell>
        );
    }

    if (!data) return <Shell><div className="loading-state">Loading Profile...</div></Shell>;

    const {
        profile,
        can_edit: canEdit,
        can_sync: canSync,
        can_view_supervision: canViewSupervision = false,
        is_self: isSelf = false,
        counts = {},
    } = data;
    const tab = activeTab ?? 'faculty';
    const isOwnTab = tab === 'faculty';
    const groups = isOwnTab ? data.publications : (data.student_publications || {});

    const profileImage = profile.name
        ? (() => {
            const parts = profile.name.replace('Dr.', '').trim().split(' ');
            return generateAvatar(parts[0], parts[parts.length - 1] || '');
        })()
        : '';

    const matchesFilters = (pub) => {
        const year = pub.year ? String(pub.year) : '';
        if (filterYears.length && !filterYears.includes(year)) return false;
        if (filterSource !== 'All' && (pub.source || 'manual') !== filterSource) return false;
        if (search.trim()) {
            const haystack = `${pub.title || ''} ${pub.authors || ''} ${pub.name || ''}`.toLowerCase();
            if (!haystack.includes(search.trim().toLowerCase())) return false;
        }
        return true;
    };

    const filtered = {};
    Object.keys(groups || {}).forEach(key => {
        if (filterType !== 'All' && filterType !== key) return;
        filtered[key] = (groups[key] || []).filter(matchesFilters);
    });

    const allYears = [...new Set(Object.values(groups || {}).flat().map(p => p.year).filter(Boolean).map(String))].sort().reverse();
    const availableSources = [...new Set(Object.values(groups || {}).flat().map(p => p.source || 'manual'))];

    const formatAuthors = (authors) => {
        if (!authors) return '';
        const id = profileIdentity(profile.name);
        if (!id) return authors;
        return splitAuthors(authors).map((piece, i) =>
            isProfileAuthor(piece, id) ? <strong key={i}>{piece}</strong> : piece
        );
    };

    const startEdit = () => {
        setIdentifiers({
            orcid_id: profile.orcid_id || '',
            scopus_id: profile.scopus_id || '',
            google_scholar_id: profile.google_scholar_id || '',
            joined_on: profile.joined || '',
            citations: profile.citations ?? '',
            h_index: profile.h_index ?? '',
            expertise: Array.isArray(profile.expertise) ? profile.expertise.join(', ') : profile.expertise || '',
        });
        setEditing(true);
    };

    const saveIdentifiers = async () => {
        const res = await apiUpdateResearchProfile(facultyCode, identifiers);
        if (res.success) { setEditing(false); toast.success('Profile updated.'); load(); }
    };

    const runSync = async () => {
        setSyncing(true);
        try {
            const res = await apiSyncPublications(facultyCode);
            if (!res.success) {
                toast.error(res.response?.message || 'Sync failed.');
                setSyncing(false);
                return;
            }
            // Queued: the worker runs it off-request. Poll until last_sync or
            // the publication count moves, up to ~5 minutes, spinner stays on.
            const prevSync = profile.last_sync || null;
            const prevTotal = profile.total_publications ?? 0;
            const started = Date.now();
            let done = false;
            while (!done && Date.now() - started < 5 * 60 * 1000) {
                await new Promise(r => setTimeout(r, 5000));
                const cur = await apiResearchProfile(facultyCode);
                if (!cur) continue;
                setData(cur);
                const p = cur.profile || {};
                if ((p.last_sync || null) !== prevSync || (p.total_publications ?? 0) !== prevTotal) {
                    toast.success('Sync finished — profile updated.');
                    done = true;
                }
            }
            if (!done) {
                await load();
                toast.info('Sync is taking longer than expected — refresh in a bit.');
            }
        } catch (e) {
            toast.error('Sync failed: ' + (e.message || 'unknown'));
        } finally {
            setSyncing(false);
            load();
        }
    };

    const savePublication = async (body) => {
        const res = editPub
            ? await apiUpdateFacultyPublication(facultyCode, editPub.id, body)
            : await apiAddFacultyPublication(facultyCode, body);
        if (res.success) {
            setShowPubForm(false);
            setEditPub(null);
            toast.success(editPub ? 'Publication updated.' : 'Publication added.');
            load();
        }
    };

    const removePublication = async (pub) => {
        const res = await apiDeleteFacultyPublication(facultyCode, pub.id);
        if (res.success) { toast.success('Publication deleted.'); load(); }
    };

    const exportCSV = () => {
        const headers = ['Category', 'Authors', 'Year', 'Title', 'Name', 'Impact Factor', 'Publisher', 'Place', 'DOI', 'Source'];
        const rows = [];
        TYPE_OPTIONS.forEach(({ value, label }) => {
            (filtered[value] || []).forEach(p => rows.push([
                label, p.authors, p.year, p.title, p.name, p.impact_factor,
                p.publisher, p.country || p.city, p.doi_link, SOURCE_LABELS[p.source] || p.source,
            ]));
        });
        if (!rows.length) { toast.error('Nothing to export for the current filters.'); return; }
        const csv = [headers, ...rows]
            .map(row => row.map(cell => `"${cell ?? ''}"`).join(','))
            .join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `research_profile_${facultyCode}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const sourceBadge = (pub) => (
        <span className={badgeClass(pub.source || 'manual')}>{SOURCE_LABELS[pub.source] || 'Manual'}</span>
    );

    const toggleSelected = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleGroup = (key) => {
        const ids = (filtered[key] || []).map(p => p.id);
        const allChosen = ids.length > 0 && ids.every(id => selected.includes(id));
        setSelected(prev => allChosen
            ? prev.filter(id => !ids.includes(id))
            : [...new Set([...prev, ...ids])]);
    };

    /**
     * Reclassifies every ticked publication.
     *
     * One request per publication against the existing endpoint, which also
     * pins each row so the next sync leaves the new category alone. A failure on
     * one row does not abandon the rest; the count of what actually moved is
     * reported.
     */
    const applyBulkCategory = async () => {
        if (!bulkTarget || selected.length === 0) return;

        const fields = CATEGORY_TO_FIELDS[bulkTarget];
        if (!fields) return;

        setBulkBusy(true);
        let moved = 0;
        let failed = 0;

        for (const id of selected) {
            const res = await apiUpdateFacultyPublication(facultyCode, id, fields);
            if (res.success) moved++; else failed++;
        }

        setBulkBusy(false);
        setSelected([]);
        setBulkTarget('');

        if (moved) toast.success(`Moved ${moved} publication${moved === 1 ? '' : 's'}.`);
        if (failed) toast.error(`${failed} could not be moved.`);
        load();
    };

    const selectHeader = canEdit && isOwnTab ? <th className="rp-select-col"></th> : null;

    const selectCell = (pub) => (
        canEdit && isOwnTab && (
            <td className="rp-select-col">
                <input
                    type="checkbox"
                    checked={selected.includes(pub.id)}
                    onChange={() => toggleSelected(pub.id)}
                    aria-label={`Select ${pub.title || 'publication'}`}
                />
            </td>
        )
    );

    const rowActions = (pub) => (
        canEdit && isOwnTab && (
            <td className="rp-row-actions">
                <button onClick={() => { setEditPub(pub); setShowPubForm(true); }} title="Edit"><i className="fa fa-pencil"></i></button>
                <button onClick={() => removePublication(pub)} title="Delete"><i className="fa fa-trash"></i></button>
            </td>
        )
    );

    const actionHeader = canEdit && isOwnTab ? <th></th> : null;

    // A column's width comes from its heading, so the classes are picked off the
    // label rather than the position: the select checkbox shifts every index,
    // and the year/title columns sit in different places from table to table.
    const columnClass = (label) => {
        if (label.startsWith('YEAR OF')) return 'rp-col-year';
        if (label.startsWith('TITLE OF')) return 'rp-col-title';
        return undefined;
    };

    // "YEAR OF PUBLICATION" on one line holds the column open to the width of the
    // whole phrase. Broken after "OF", the column only has to fit "PUBLICATION",
    // and the space saved goes to the title.
    const headingText = (label) => {
        if (!label.startsWith('YEAR OF')) return label;
        const cut = label.lastIndexOf(' ');
        return (<>{label.slice(0, cut)}<br />{label.slice(cut + 1)}</>);
    };

    const table = (key, title, columns, renderRow) => (
        filtered[key] && filtered[key].length > 0 && (
            <div className="rp-table-section" key={key}>
                <h3>
                    {title}
                    {canEdit && isOwnTab && (
                        <button type="button" className="rp-select-all" onClick={() => toggleGroup(key)}>
                            Select all
                        </button>
                    )}
                </h3>
                <div className="data-table-wrap">
                    <table className="data-table">
                        <thead><tr>{selectHeader}<th className="rp-col-num"></th>{columns.map(c => <th key={c} className={columnClass(c)}>{headingText(c)}</th>)}<th>SOURCE</th>{actionHeader}</tr></thead>
                        <tbody>{filtered[key].map((pub, i) => <tr key={`${pub.source}-${pub.id}`}>{selectCell(pub)}<td className="rp-col-num">{i + 1}</td>{renderRow(pub)}<td>{sourceBadge(pub)}</td>{rowActions(pub)}</tr>)}</tbody>
                    </table>
                </div>
            </div>
        )
    );

    const doiCell = (pub) => (
        <td>{pub.doi_link ? <a href={pub.doi_link} target="_blank" rel="noopener noreferrer"><i className="fa fa-link"></i> DOI</a> : '—'}</td>
    );

    return (
        <Shell>
            <div className="rp-container">
                <div className="faculty-container">
                    <div className="faculty-header">
                        <div>
                            <h2>{profile.name}</h2>
                            <p className="faculty-sub">{profile.designation}, {profile.department}</p>
                        </div>
                        {/* Research lives on the same page but stays folded away:
                            most visits are about supervision. Kept beside the name
                            so it is seen without scrolling past the tables. */}
                        <button
                            type="button"
                            className={`faculty-research-toggle ${showResearch ? 'is-open' : ''}`.trim()}
                            aria-expanded={showResearch}
                            onClick={() => setShowResearch(v => !v)}
                        >
                            <i className="fa fa-flask"></i>
                            {showResearch ? 'Hide research profile' : 'Research profile'}
                        </button>
                    </div>

                    <div className="faculty-info-grid">
                        <div><strong>Email:</strong> {profile.email || "N/A"}</div>
                        {profile.phone !== undefined && (
                            <div><strong>Phone:</strong> {profile.phone || "N/A"}</div>
                        )}
                        <div><strong>Faculty Code:</strong> {profile.faculty_code}</div>
                        <div><strong>Supervised (Within TIET):</strong> {profile.supervised_campus ?? 0}</div>
                        <div><strong>Supervised (Outside TIET):</strong> {profile.supervised_outside ?? 0}</div>
                        {/* A viewer who may not see who the students are still sees how many. */}
                        {!canViewSupervision && (
                            <>
                                <div><strong>Supervising:</strong> {counts.supervised_count ?? 0}</div>
                                <div><strong>Doctoral Committees:</strong> {counts.doctoral_committee_count ?? 0}</div>
                            </>
                        )}
                        {profile.website && <div><strong>Website:</strong> {profile.website}</div>}
                        <div style={{ gridColumn: '1 / -1' }}>
                            <strong>Area of Expertise:</strong>{' '}
                            {Array.isArray(profile.expertise) && profile.expertise.length ? profile.expertise.join(', ') : '—'}
                        </div>
                    </div>

                    {canViewSupervision && (
                        <>
                            <div className="faculty-table-section">
                                <h3>Supervising Students</h3>
                                {!(data.supervised_students || []).length ? (
                                    <p className="empty-msg">No students currently being supervised.</p>
                                ) : (
                                    <div className="responsive-table">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>S.No</th><th>Name</th><th>Roll No</th><th>Email</th><th>Date of Admission</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                {(data.supervised_students || []).map((student, idx) => (
                                    <tr key={student.roll_no} onClick={() => navigate(`/students/${student.roll_no}`)} style={{ cursor: 'pointer' }}>
                                        <td className="col-tight">{idx + 1}</td>
                                        <td>{student.name}</td>
                                        <td className="col-tight">{student.roll_no}</td>
                                        <td>{student.email}</td>
                                        <td className="col-tight">{student.date_of_admission || "N/A"}</td>
                                    </tr>
                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="faculty-table-section">
                                <h3>Doctoral Committee Membership</h3>
                                {!(data.doctoral_committee_students || []).length ? (
                                    <p className="empty-msg">Not a member of any doctoral committee.</p>
                                ) : (
                                    <div className="responsive-table">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>S.No</th><th>Name</th><th>Roll No</th><th>Email</th><th>Department</th><th>Date of Admission</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                {(data.doctoral_committee_students || []).map((student, idx) => (
                                    <tr key={student.roll_no} onClick={() => navigate(`/students/${student.roll_no}`)} style={{ cursor: 'pointer' }}>
                                        <td className="col-tight">{idx + 1}</td>
                                        <td>{student.name}</td>
                                        <td className="col-tight">{student.roll_no}</td>
                                        <td>{student.email}</td>
                                        <td className="col-tight">{student.department || "N/A"}</td>
                                        <td className="col-tight">{student.date_of_admission || "N/A"}</td>
                                    </tr>
                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {showResearch && (
                <div className="rp-research">
                    <div className="rp-search-bar">
                        <i className="fa fa-search"></i>
                        <input
                            type="text"
                            placeholder="Search publications..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="rp-right-col">
                        <div className="rp-info-card">
                            <div className="rp-card-head-row">
                                <h4 className="rp-card-title border-red">Academic Identifiers</h4>
                                {canEdit && !editing && (
                                    <button className="rp-inline-edit" onClick={startEdit} title="Edit identifiers"><i className="fa fa-pencil"></i></button>
                                )}
                            </div>
                            {editing ? (
                                <div className="rp-id-form">
                                    <label>ORCID iD</label>
                                    <input value={identifiers.orcid_id} onChange={e => setIdentifiers({ ...identifiers, orcid_id: e.target.value })} placeholder="0000-0002-1825-0097" />
                                    <label>Scopus ID</label>
                                    <input value={identifiers.scopus_id} onChange={e => setIdentifiers({ ...identifiers, scopus_id: e.target.value })} />
                                    <label>Google Scholar ID</label>
                                    <input value={identifiers.google_scholar_id} onChange={e => setIdentifiers({ ...identifiers, google_scholar_id: e.target.value })} />
                                    <label>Joined On</label>
                                    <input type="date" value={identifiers.joined_on || ''} onChange={e => setIdentifiers({ ...identifiers, joined_on: e.target.value })} />
                                    <label>Citations</label>
                                    <input type="number" value={identifiers.citations} onChange={e => setIdentifiers({ ...identifiers, citations: e.target.value })} />
                                    <label>h-index</label>
                                    <input type="number" value={identifiers.h_index} onChange={e => setIdentifiers({ ...identifiers, h_index: e.target.value })} />
                                    <label>Area of Expertise (comma separated)</label>
                                    <input value={identifiers.expertise} onChange={e => setIdentifiers({ ...identifiers, expertise: e.target.value })} placeholder="e.g., Machine Learning, Data Mining, Cyber Security" />
                                    <div className="rp-id-form-actions">
                                        <button className="rp-btn-outline" onClick={() => setEditing(false)}>Cancel</button>
                                        <button className="rp-btn-primary" onClick={saveIdentifiers}>Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="rp-contact-list">
                                    <div className="rp-contact-item">
                                        <i className="fa fa-id-card border-icon"></i>
                                        <div><label>ORCID ID</label><p>{profile.orcid_id || '—'}</p></div>
                                    </div>
                                    <div className="rp-contact-item">
                                        <i className="fa fa-database border-icon"></i>
                                        <div><label>SCOPUS ID</label><p>{profile.scopus_id || '—'}</p></div>
                                    </div>
                                    <div className="rp-contact-item">
                                        <i className="fa fa-graduation-cap border-icon"></i>
                                        <div>
                                            <label>GOOGLE SCHOLAR ID</label>
                                            <p>{profile.google_scholar_id
                                                ? <a href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`} target="_blank" rel="noopener noreferrer">{profile.google_scholar_id}</a>
                                                : '—'}</p>
                                        </div>
                                    </div>
                                    <div className="rp-contact-item">
                                        <i className="fa fa-lightbulb border-icon"></i>
                                        <div><label>AREA OF EXPERTISE</label><p>{Array.isArray(profile.expertise) && profile.expertise.length ? profile.expertise.join(', ') : '—'}</p></div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="rp-sync-strip">
                            <span>
                                Source <strong>{profile.last_sync_source ? SOURCE_LABELS[profile.last_sync_source] : 'not synced'}</strong>
                                <span className="rp-sync-dot">·</span>
                                Last synced <strong>{formatDate(profile.last_sync, 'never')}</strong>
                            </span>
                            {canEdit && canSync && (
                                <button className="rp-sync-btn" onClick={runSync} disabled={syncing} title={syncing ? 'Syncing...' : 'Sync from ORCID/Scopus'}>
                                    <i className={`fa ${syncing ? 'fa-spinner fa-spin' : 'fa-refresh'}`}></i> {syncing ? 'Syncing…' : 'Sync'}
                                </button>
                            )}
                        </div>
                    </div>

                    <Tabs
                        value={tab}
                        onChange={setActiveTab}
                        items={[
                            { value: 'faculty', label: 'Faculty Publications' },
                            ...(canViewSupervision ? [{ value: 'phd', label: 'PhD Student Publications' }] : []),
                        ]}
                    />

                <div className="rp-tallies">
                    <span className="rp-tally"><strong>{profile.total_publications}</strong> total</span>
                    <span className="rp-tally is-green"><strong>{profile.synced}</strong> synced</span>
                    <span className="rp-tally is-yellow"><strong>{profile.self_reported}</strong> self-reported</span>
                </div>

                <div className="rp-filter-bar">
                    <div className="rp-filters">
                        <label>YEAR</label>
                        <div className="rp-year-filter">
                            <select
                                value="Select"
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val !== 'Select' && !filterYears.includes(val)) setFilterYears([...filterYears, val]);
                                }}
                                className="rp-year-input"
                            >
                                <option value="Select">Select year(s)</option>
                                {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            {filterYears.length > 0 && (
                                <div className="rp-year-tags">
                                    {filterYears.map(y => (
                                        <span key={y} className="rp-year-tag">
                                            {y} <button type="button" onClick={() => setFilterYears(filterYears.filter(v => v !== y))}>&times;</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label>TYPE</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="All">All</option>
                            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>

                        <label>SOURCE</label>
                        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}>
                            <option value="All">All</option>
                            {availableSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
                        </select>
                    </div>
                    <div className="rp-filter-actions">
                        {canEdit && isOwnTab && (
                            <button className="rp-add-btn" onClick={() => { setEditPub(null); setShowPubForm(true); }}>
                                <i className="fa fa-plus"></i> ADD PUBLICATION
                            </button>
                        )}
                        <button className="rp-export-btn" onClick={exportCSV}><i className="fa fa-download"></i> EXPORT CSV</button>
                    </div>
                </div>

                {/* Appears only once something is ticked, so it stays out of the
                    way until it is needed. */}
                {canEdit && isOwnTab && selected.length > 0 && (
                    <div className="rp-bulk-bar">
                        <span className="rp-bulk-count">
                            {selected.length} selected
                        </span>
                        <select
                            value={bulkTarget}
                            onChange={e => setBulkTarget(e.target.value)}
                            disabled={bulkBusy}
                        >
                            <option value="">Move to…</option>
                            {TYPE_OPTIONS
                                .filter(t => CATEGORY_TO_FIELDS[t.value])
                                .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <button
                            className="rp-bulk-apply"
                            onClick={applyBulkCategory}
                            disabled={!bulkTarget || bulkBusy}
                        >
                            {bulkBusy ? 'Moving…' : 'Apply'}
                        </button>
                        <button className="rp-bulk-clear" onClick={() => setSelected([])} disabled={bulkBusy}>
                            Clear
                        </button>
                    </div>
                )}

                <div className="rp-tables">
                    {/* Imported works whose category could not be established, chiefly ORCID
                        journal articles, since ORCID records no indexing. Shown so they are
                        visible and can be classified rather than silently filed as Scopus. */}
                    {/* No SOURCE column here: table() already appends one with the
                        source badge, so listing it again showed it twice. */}
                    {table('uncategorised', 'Unclassified (needs a category)',
                        ['AUTHOR(S)', 'YEAR OF PUBLICATION', 'TITLE OF PAPER', 'PUBLISHED IN', 'DOI'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td><td>{pub.title}</td>
                            <td>{pub.name || '—'}</td>{doiCell(pub)}
                        </>))}

                    {table('sci', 'SCI/SCIE/SSCI/ABDC/AHCI Journal',
                        ['AUTHOR(S)', 'YEAR OF PUBLICATION', 'TITLE OF PAPER', 'NAME OF THE JOURNAL', 'IMPACT FACTOR', 'DOI'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td><td>{pub.title}</td>
                            <td>{pub.name}</td><td>{pub.impact_factor ?? '—'}</td>{doiCell(pub)}
                        </>))}

                    {table('non_sci', 'Papers in Scopus Journal',
                        ['AUTHOR(S)', 'YEAR OF PUBLICATION', 'TITLE OF PAPER', 'NAME OF THE JOURNAL', 'IMPACT FACTOR', 'NAME OF PUBLISHER'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td><td>{pub.title}</td>
                            <td>{pub.name}</td><td>{pub.impact_factor ?? '—'}</td><td>{pub.publisher || '—'}</td>
                        </>))}

                    {table('international', 'Papers in International Conferences',
                        ['AUTHOR(S)', 'YEAR OF PUBLICATION', 'TITLE OF PAPER', 'NAME OF CONFERENCE', 'PLACE OF CONFERENCE', 'DOI'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td><td>{pub.title}</td>
                            <td>{pub.name}</td><td>{pub.country || '—'}</td>{doiCell(pub)}
                        </>))}

                    {table('national', 'Papers in National Conferences',
                        ['AUTHOR(S)', 'YEAR OF PUBLICATION', 'TITLE OF PAPER', 'NAME OF CONFERENCE', 'PLACE OF CONFERENCE', 'DOI'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td><td>{pub.title}</td>
                            <td>{pub.name}</td><td>{pub.city || '—'}</td>{doiCell(pub)}
                        </>))}

                    {table('book', 'Book/Book Chapters',
                        ['AUTHOR(S)', 'YEAR OF PUBLICATION', 'NAME OF BOOK', 'TITLE OF PAPER', 'NAME OF PUBLISHER'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td><td>{pub.name}</td>
                            <td>{pub.title}</td><td>{pub.publisher || '—'}</td>
                        </>))}

                    {table('patents', 'Patents',
                        ['AUTHOR(S)', 'YEAR OF AWARD', 'TITLE OF PATENT', 'INTERNATIONAL/NATIONAL'],
                        pub => (<>
                            <td>{formatAuthors(pub.authors)}</td><td>{pub.year || '—'}</td>
                            <td>{pub.title}</td><td>{pub.country || '—'}</td>
                        </>))}

                    {Object.values(filtered).every(list => !list || !list.length) && (
                        <div className="empty-state">
                            {isOwnTab
                                ? 'No publications recorded yet. Add one, or sync from ORCID or Scopus.'
                                : 'No publications from supervised students match these filters.'}
                        </div>
                    )}
                </div>
                </div>
                )}

                <CustomModal
                    isOpen={showPubForm}
                    onClose={() => { setShowPubForm(false); setEditPub(null); }}
                    maxWidth="900px"
                    minHeight="auto"
                >
                    <AddPublication
                        close={() => { setShowPubForm(false); setEditPub(null); }}
                        editData={editPub}
                        onSave={savePublication}
                    />
                </CustomModal>
            </div>
        </Shell>
    );
};

export default ResearchProfile;
