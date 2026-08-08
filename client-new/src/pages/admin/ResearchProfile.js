import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import AddPublication from '../../components/publications/AddPublication';
import CustomModal from '../../components/forms/modal/CustomModal';
import { generateAvatar } from '../../utils/profileImage';
import { formatDate } from '../../data/projectsData';
import {
    apiResearchProfile, apiUpdateResearchProfile, apiSyncPublications,
    apiAddFacultyPublication, apiUpdateFacultyPublication, apiDeleteFacultyPublication,
} from '../../api/researchProfile';
import { apiCurrentFaculty } from '../../api/projects';
import { toast } from 'react-toastify';
import './ResearchProfile.css';

const TYPE_OPTIONS = [
    { value: 'sci', label: 'SCI/SCIE/SSCI/ABDC/AHCI Journal' },
    { value: 'non_sci', label: 'Papers in Scopus Journal' },
    { value: 'international', label: 'Papers in International Conferences' },
    { value: 'national', label: 'Papers in National Conferences' },
    { value: 'book', label: 'Book/Book Chapters' },
    { value: 'patents', label: 'Patents' },
];

const SOURCE_LABELS = { scopus: 'Scopus', orcid: 'ORCID', manual: 'Manual', student: 'Student' };

const emptyIdentifiers = {
    orcid_id: '', scopus_id: '', google_scholar_id: '', joined_on: '', citations: '', h_index: '',
};

const ResearchProfile = () => {
    // No code in the URL means "my own profile".
    const { facultyCode: routeCode } = useParams();
    const [facultyCode, setFacultyCode] = useState(routeCode || null);
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('faculty');
    const [filterYears, setFilterYears] = useState([]);
    const [filterType, setFilterType] = useState('All');
    const [filterSource, setFilterSource] = useState('All');
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState(false);
    const [identifiers, setIdentifiers] = useState(emptyIdentifiers);
    const [showPubForm, setShowPubForm] = useState(false);
    const [editPub, setEditPub] = useState(null);

    const load = useCallback(async () => {
        if (!facultyCode) return;
        const res = await apiResearchProfile(facultyCode);
        if (res) setData(res);
    }, [facultyCode]);

    useEffect(() => {
        if (routeCode) { setFacultyCode(routeCode); return; }
        apiCurrentFaculty().then(f => f && setFacultyCode(f.id));
    }, [routeCode]);

    useEffect(() => { load(); }, [load]);

    if (!data) return <Layout><div className="loading-state">Loading Profile...</div></Layout>;

    const { profile, can_edit: canEdit, can_sync: canSync } = data;
    const isOwnTab = activeTab === 'faculty';
    const groups = isOwnTab ? data.publications : data.student_publications;

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
        if (!profile.name) return authors;
        const parts = String(authors).split(new RegExp(`(${profile.name})`, 'gi'));
        return parts.map((part, i) =>
            part.toLowerCase() === profile.name.toLowerCase() ? <strong key={i}>{part}</strong> : part
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
        });
        setEditing(true);
    };

    const saveIdentifiers = async () => {
        const res = await apiUpdateResearchProfile(facultyCode, identifiers);
        if (res.success) { setEditing(false); toast.success('Profile updated.'); load(); }
    };

    const runSync = async () => {
        const res = await apiSyncPublications(facultyCode);
        if (res.success) toast.success(res.response?.message || 'Sync started.');
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
        <span className={`rp-source-badge ${pub.source || 'manual'}`}>{SOURCE_LABELS[pub.source] || 'Manual'}</span>
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

    const table = (key, title, columns, renderRow) => (
        filtered[key] && filtered[key].length > 0 && (
            <div className="rp-table-section" key={key}>
                <h3>{title}</h3>
                <div className="rp-table-wrapper">
                    <table>
                        <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}<th>SOURCE</th>{actionHeader}</tr></thead>
                        <tbody>{filtered[key].map(pub => <tr key={`${pub.source}-${pub.id}`}>{renderRow(pub)}<td>{sourceBadge(pub)}</td>{rowActions(pub)}</tr>)}</tbody>
                    </table>
                </div>
            </div>
        )
    );

    const doiCell = (pub) => (
        <td>{pub.doi_link ? <a href={pub.doi_link} target="_blank" rel="noopener noreferrer"><i className="fa fa-link"></i> DOI</a> : '—'}</td>
    );

    return (
        <Layout>
            <div className="rp-container">
                <div className="rp-top-nav">
                    <div className="rp-nav-left">
                        <h1 className="page-title">Research Profile</h1>
                    </div>
                    <div className="rp-search-bar">
                        <i className="fa fa-search"></i>
                        <input
                            type="text"
                            placeholder="Search publications..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rp-banner-grid">
                    <div className="rp-user-card">
                        <div className="rp-avatar-wrapper">
                            <img src={profileImage} alt="Profile" className="rp-avatar" />
                            <div className="rp-status-badge"></div>
                        </div>
                        <h2>{profile.name}</h2>
                        <h3 className="rp-designation">{profile.designation}</h3>
                        <p className="rp-department">{profile.department}</p>
                        <div className="rp-user-stats">
                            <div className="rp-stat-row"><span>Joined</span><strong>{profile.joined ? formatDate(profile.joined) : '—'}</strong></div>
                            <div className="rp-stat-row"><span>Publications</span><strong>{profile.total_publications}</strong></div>
                            <div className="rp-stat-row"><span>Citations</span><strong>{profile.citations ?? '—'}</strong></div>
                            <div className="rp-stat-row"><span>h-index</span><strong>{profile.h_index ?? '—'}</strong></div>
                        </div>
                    </div>

                    <div className="rp-middle-col">
                        <div className="rp-info-card">
                            <h4 className="rp-card-title border-red">Contact Information</h4>
                            <div className="rp-contact-list">
                                <div className="rp-contact-item">
                                    <i className="fa fa-envelope border-icon"></i>
                                    <div><label>INSTITUTIONAL EMAIL</label><p>{profile.email || '—'}</p></div>
                                </div>
                                <div className="rp-contact-item">
                                    <i className="fa fa-phone border-icon"></i>
                                    <div><label>PHONE</label><p>{profile.phone || '—'}</p></div>
                                </div>
                                <div className="rp-contact-item">
                                    <i className="fa fa-globe border-icon"></i>
                                    <div><label>WEBSITE</label><p>{profile.website || '—'}</p></div>
                                </div>
                            </div>
                        </div>

                        <div className="rp-stats-cards">
                            <div className="rp-mini-stat"><label>TOTAL</label><span className="stat-num black">{profile.total_publications}</span></div>
                            <div className="rp-mini-stat stat-green"><label>SYNCED</label><span className="stat-num green">{profile.synced}</span></div>
                            <div className="rp-mini-stat stat-yellow"><label>SELF-REPORTED</label><span className="stat-num yellow">{profile.self_reported}</span></div>
                        </div>
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
                                </div>
                            )}
                        </div>

                        <div className="rp-sync-card">
                            <div className="rp-sync-info">
                                <h4>External Sync Status</h4>
                                <p>Source: <strong>{profile.last_sync_source ? SOURCE_LABELS[profile.last_sync_source] : 'Not synced'}</strong></p>
                                <p>Last synced: <strong>{profile.last_sync ? formatDate(profile.last_sync) : 'Never'}</strong></p>
                            </div>
                            {canEdit && canSync && (
                                <button className="rp-sync-btn" onClick={runSync}><i className="fa fa-refresh"></i> Sync Publications</button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="tabs">
                    <button className={`tab ${activeTab === 'phd' ? 'active' : ''}`} onClick={() => setActiveTab('phd')}>PhD Student Publications</button>
                    <button className={`tab ${isOwnTab ? 'active' : ''}`} onClick={() => setActiveTab('faculty')}>Faculty Publications</button>
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

                <div className="rp-tables">
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
        </Layout>
    );
};

export default ResearchProfile;
