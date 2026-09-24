import React, { useEffect, useMemo, useRef, useState } from 'react';
import AddPublication from '../../publications/AddPublication';
import CustomModal from '../../forms/modal/CustomModal';
import CustomButton from '../../forms/fields/CustomButton';
import Tabs from '../../tabs/Tabs';
import StatusNotice from '../../common/StatusNotice';
import Panel from '../../panel/Panel';
import { isNetworkError, NETWORK_ERROR_MESSAGE } from '../../../api/base';
import { EMPTY_VALUE, formatDate } from '../../../utils/timeParse';
import { badgeClass } from '../../../data/badges';
import {
    apiResearchProfile, apiSyncPublications,
    apiAddFacultyPublication, apiUpdateFacultyPublication, apiDeleteFacultyPublication,
} from '../../../api/researchProfile';
import { toast } from 'react-toastify';
import { profileIdentity, isProfileAuthor, splitAuthors } from '../../../utils/authorMatch';
import '../ResearchProfile.css';

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

/**
 * A faculty member's publications, on their research profile: synced from
 * ORCID or Scopus or added by hand, filtered, reclassified in bulk, exported,
 * and beside them the publications of the scholars they supervise. Its data
 * is the profile view's (props); a change reads the view again (onChanged).
 */
const ResearchPublicationsBlock = ({ props, onChanged }) => {
    const {
        faculty_code: facultyCode,
        profile,
        can_edit: canEdit,
        can_sync: canSync,
        can_view_supervision: canViewSupervision,
    } = props;
    // A sync polls after it is queued, and stops once the page is left.
    const mounted = useRef(true);
    useEffect(() => () => { mounted.current = false; }, []);
    const [activeTab, setActiveTab] = useState(null);
    const [filterYears, setFilterYears] = useState([]);
    const [filterType, setFilterType] = useState('All');
    const [filterSource, setFilterSource] = useState('All');
    const [search, setSearch] = useState('');
    const [showPubForm, setShowPubForm] = useState(false);
    const [editPub, setEditPub] = useState(null);
    // Ids ticked for bulk reclassification. Imported publications arrive with
    // only the category their source could prove, so moving a batch at once is
    // the difference between a short chore and twenty trips through the modal.
    const [selected, setSelected] = useState([]);
    const [bulkTarget, setBulkTarget] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const tab = activeTab ?? 'faculty';
    const isOwnTab = tab === 'faculty';
    const groups = isOwnTab ? props.publications : (props.student_publications || {});
    const profileName = profile.name;

    // Memoised, so a search keystroke refilters once instead of rebuilding
    // every derived list on each render.
    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        const matchesFilters = (pub) => {
            const year = pub.year ? String(pub.year) : '';
            if (filterYears.length && !filterYears.includes(year)) return false;
            if (filterSource !== 'All' && (pub.source || 'manual') !== filterSource) return false;
            if (needle) {
                const haystack = `${pub.title || ''} ${pub.authors || ''} ${pub.name || ''}`.toLowerCase();
                if (!haystack.includes(needle)) return false;
            }
            return true;
        };
        const result = {};
        Object.keys(groups || {}).forEach(key => {
            if (filterType !== 'All' && filterType !== key) return;
            result[key] = (groups[key] || []).filter(matchesFilters);
        });
        return result;
    }, [groups, filterType, filterYears, filterSource, search]);

    const allYears = useMemo(
        () => [...new Set(Object.values(groups || {}).flat().map(p => p.year).filter(Boolean).map(String))].sort().reverse(),
        [groups]
    );
    const availableSources = useMemo(
        () => [...new Set(Object.values(groups || {}).flat().map(p => p.source || 'manual'))],
        [groups]
    );
    const authorIdentity = useMemo(() => profileIdentity(profileName), [profileName]);
    const selectedIds = useMemo(() => new Set(selected), [selected]);

    const formatAuthors = (authors) => {
        if (!authors) return '';
        const id = authorIdentity;
        if (!id) return authors;
        return splitAuthors(authors).map((piece, i) =>
            isProfileAuthor(piece, id) ? <strong key={i}>{piece}</strong> : piece
        );
    };

    const runSync = async () => {
        const isShown = () => mounted.current;
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
                if (!isShown()) return;
                const cur = await apiResearchProfile(facultyCode);
                if (!isShown()) return;
                if (!cur) continue;
                onChanged();
                const p = cur.profile || {};
                if ((p.last_sync || null) !== prevSync || (p.total_publications ?? 0) !== prevTotal) {
                    toast.success('Sync finished. Profile updated.');
                    done = true;
                }
            }
            if (!done) {
                onChanged();
                toast.info('Sync is taking longer than expected. Refresh in a bit.');
            }
        } catch (e) {
            toast.error(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : 'Sync failed: ' + (e.message || 'unknown'));
        } finally {
            setSyncing(false);
            if (isShown()) onChanged();
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
            onChanged();
        }
    };

    const removePublication = async (pub) => {
        // One click used to delete for good. The scholar's Publications page
        // asks first, and so does this now.
        if (!window.confirm(`Delete "${pub.title || 'this publication'}"? This cannot be undone.`)) return;
        const res = await apiDeleteFacultyPublication(facultyCode, pub.id);
        if (res.success) { toast.success('Publication deleted.'); onChanged(); }
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
            // A quote inside a title would otherwise end the cell early.
            .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
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

    // Changing what is shown drops the ticks, so Apply cannot move rows the
    // filters now hide.
    const refilter = (setter) => (value) => { setSelected([]); setter(value); };
    const filtersActive = filterYears.length > 0 || filterType !== 'All' || filterSource !== 'All' || search.trim() !== '';

    const toggleSelected = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleGroup = (key) => {
        const ids = (filtered[key] || []).map(p => p.id);
        const allChosen = ids.length > 0 && ids.every(id => selectedIds.has(id));
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
        onChanged();
    };

    const selectHeader = canEdit && isOwnTab ? <th className="rp-select-col"><span className="sr-only">Select</span></th> : null;

    const selectCell = (pub) => (
        canEdit && isOwnTab && (
            <td className="rp-select-col">
                <input
                    type="checkbox"
                    checked={selectedIds.has(pub.id)}
                    onChange={() => toggleSelected(pub.id)}
                    aria-label={`Select ${pub.title || 'publication'}`}
                />
            </td>
        )
    );

    const rowActions = (pub) => (
        canEdit && isOwnTab && (
            <td className="rp-row-actions">
                <button type="button" className="icon-action" onClick={() => { setEditPub(pub); setShowPubForm(true); }} title="Edit" aria-label="Edit"><i className="fa fa-pencil" aria-hidden="true"></i></button>
                <button type="button" className="icon-action" onClick={() => removePublication(pub)} title="Delete" aria-label="Delete"><i className="fa fa-trash" aria-hidden="true"></i></button>
            </td>
        )
    );

    const actionHeader = canEdit && isOwnTab ? <th><span className="sr-only">Actions</span></th> : null;

    // A column's width comes from its heading, so the classes are picked off the
    // label rather than the position: the select checkbox shifts every index,
    // and the year/title columns sit in different places from table to table.
    const columnClass = (label) => {
        if (label.startsWith('Year of')) return 'rp-col-year';
        if (label.startsWith('Title of')) return 'rp-col-title';
        return undefined;
    };

    // "Year of publication" on one line holds the column open to the width of the
    // whole phrase. Broken after "of", the column only has to fit "publication",
    // and the space saved goes to the title.
    const headingText = (label) => {
        if (!label.startsWith('Year of')) return label;
        const cut = label.lastIndexOf(' ');
        return (<>{label.slice(0, cut)}<br />{label.slice(cut + 1)}</>);
    };

    const table = (key, title, columns, renderRow) => (
        filtered[key] && filtered[key].length > 0 && (
            <Panel
                flush
                key={key}
                title={title}
                className="rp-table-panel"
                actions={canEdit && isOwnTab && (
                    <CustomButton text="Select all" variant="quiet" size="sm" onClick={() => toggleGroup(key)} />
                )}
            >
                <div className="data-table-wrap">
                    <table className="data-table">
                        <thead><tr>{selectHeader}<th className="rp-col-num"><span className="sr-only">Number</span></th>{columns.map(c => <th key={c} className={columnClass(c)}>{headingText(c)}</th>)}<th>Source</th>{actionHeader}</tr></thead>
                        <tbody>{filtered[key].map((pub, i) => <tr key={`${pub.source}-${pub.id}`}>{selectCell(pub)}<td className="rp-col-num">{i + 1}</td>{renderRow(pub)}<td>{sourceBadge(pub)}</td>{rowActions(pub)}</tr>)}</tbody>
                    </table>
                </div>
            </Panel>
        )
    );

    const doiCell = (pub) => (
        <td>{pub.doi_link ? <a href={pub.doi_link} target="_blank" rel="noopener noreferrer"><i className="fa fa-link" aria-hidden="true"></i> DOI</a> : EMPTY_VALUE}</td>
    );

    return (
        <>
            <Panel
                id={props.anchor}
                title="Publications"
                actions={
                    <>
                        {canEdit && isOwnTab && (
                            <button type="button" className="custom-button custom-button--secondary" onClick={() => { setEditPub(null); setShowPubForm(true); }}>
                                <i className="fa fa-plus" aria-hidden="true"></i> Add publication
                            </button>
                        )}
                        <button type="button" className="custom-button custom-button--quiet" onClick={exportCSV}>
                            <i className="fa fa-download" aria-hidden="true"></i> Export CSV
                        </button>
                    </>
                }
            >
                <div className="rp-sync-strip">
                    <span>
                        Source <strong>{profile.last_sync_source ? SOURCE_LABELS[profile.last_sync_source] : 'not synced'}</strong>
                        <span className="rp-sync-dot" aria-hidden="true">·</span>
                        Last synced <strong>{formatDate(profile.last_sync, 'never')}</strong>
                    </span>
                    {canEdit && canSync && (
                        <button type="button" className="custom-button custom-button--secondary custom-button--sm" onClick={runSync} disabled={syncing} title="Sync from ORCID/Scopus">
                            <i className={`fa ${syncing ? 'fa-spinner fa-spin' : 'fa-refresh'}`} aria-hidden="true"></i> {syncing ? 'Syncing…' : 'Sync'}
                        </button>
                    )}
                    {canEdit && !canSync && (
                        <span className="rp-sync-hint">Add an ORCID or Scopus ID to sync automatically.</span>
                    )}
                </div>

                <Tabs
                    value={tab}
                    onChange={refilter(setActiveTab)}
                    items={[
                        { value: 'faculty', label: 'Faculty publications' },
                        ...(canViewSupervision ? [{ value: 'phd', label: 'PhD student publications' }] : []),
                    ]}
                />

                <div className="rp-tallies">
                    <span className="rp-tally"><strong>{profile.total_publications}</strong> total</span>
                    <span className="rp-tally is-green"><strong>{profile.synced}</strong> synced</span>
                    <span className="rp-tally is-yellow"><strong>{profile.self_reported}</strong> self-reported</span>
                </div>

                <div className="rp-filter-bar">
                    <div className="rp-filter">
                        <label htmlFor="research-profile-year">Year</label>
                        <select
                            id="research-profile-year"
                            value="Select"
                            onChange={e => {
                                const val = e.target.value;
                                if (val !== 'Select' && !filterYears.includes(val)) refilter(setFilterYears)([...filterYears, val]);
                            }}
                        >
                            <option value="Select">All years</option>
                            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div className="rp-filter">
                        <label htmlFor="research-profile-type">Type</label>
                        <select id="research-profile-type" value={filterType} onChange={e => refilter(setFilterType)(e.target.value)}>
                            <option value="All">All</option>
                            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>

                    <div className="rp-filter">
                        <label htmlFor="research-profile-source">Source</label>
                        <select id="research-profile-source" value={filterSource} onChange={e => refilter(setFilterSource)(e.target.value)}>
                            <option value="All">All</option>
                            {availableSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s] || s}</option>)}
                        </select>
                    </div>

                    <div className="rp-filter rp-filter--search">
                        <label htmlFor="research-profile-search">Search</label>
                        <div className="rp-search-bar">
                            <i className="fa fa-search" aria-hidden="true"></i>
                            <input
                                id="research-profile-search"
                                type="text"
                                placeholder="Search publications..."
                                value={search}
                                onChange={e => refilter(setSearch)(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Chosen years sit under the bar rather than inside it, so adding
                    one cannot change the height of the controls beside it. */}
                {filterYears.length > 0 && (
                    <div className="rp-year-tags">
                        {filterYears.map(y => (
                            <span key={y} className="badge badge--accent">
                                {y}
                                <button type="button" className="rp-year-remove" aria-label={`Remove ${y}`} onClick={() => refilter(setFilterYears)(filterYears.filter(v => v !== y))}>&times;</button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Appears only once something is ticked, so it stays out of the
                    way until it is needed. */}
                {canEdit && isOwnTab && selected.length > 0 && (
                    <div className="rp-bulk-bar">
                        <span className="rp-bulk-count">
                            {selected.length} selected
                        </span>
                        <select
                            aria-label="Move selected publications to"
                            value={bulkTarget}
                            onChange={e => setBulkTarget(e.target.value)}
                            disabled={bulkBusy}
                        >
                            <option value="">Move to…</option>
                            {TYPE_OPTIONS
                                .filter(t => CATEGORY_TO_FIELDS[t.value])
                                .map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <CustomButton
                            text="Apply"
                            variant="secondary"
                            size="sm"
                            onClick={applyBulkCategory}
                            busy={bulkBusy}
                            disabled={!bulkTarget}
                        />
                        <CustomButton text="Clear" variant="quiet" size="sm" onClick={() => setSelected([])} disabled={bulkBusy} />
                    </div>
                )}
            </Panel>

            {/* Imported works whose category could not be established, chiefly ORCID
                journal articles, since ORCID records no indexing. Shown so they are
                visible and can be classified rather than silently filed as Scopus. */}
            {/* No Source column here: table() already appends one with the
                source badge, so listing it again showed it twice. */}
            {table('uncategorised', 'Unclassified (needs a category)',
                ['Author(s)', 'Year of publication', 'Title of paper', 'Published in', 'DOI'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td><td>{pub.title}</td>
                    <td>{pub.name || EMPTY_VALUE}</td>{doiCell(pub)}
                </>))}

            {table('sci', 'SCI/SCIE/SSCI/ABDC/AHCI Journal',
                ['Author(s)', 'Year of publication', 'Title of paper', 'Name of the journal', 'Impact factor', 'DOI'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td><td>{pub.title}</td>
                    <td>{pub.name}</td><td>{pub.impact_factor ?? EMPTY_VALUE}</td>{doiCell(pub)}
                </>))}

            {table('non_sci', 'Papers in Scopus Journal',
                ['Author(s)', 'Year of publication', 'Title of paper', 'Name of the journal', 'Impact factor', 'Name of publisher'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td><td>{pub.title}</td>
                    <td>{pub.name}</td><td>{pub.impact_factor ?? EMPTY_VALUE}</td><td>{pub.publisher || EMPTY_VALUE}</td>
                </>))}

            {table('international', 'Papers in International Conferences',
                ['Author(s)', 'Year of publication', 'Title of paper', 'Name of conference', 'Place of conference', 'DOI'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td><td>{pub.title}</td>
                    <td>{pub.name}</td><td>{pub.country || EMPTY_VALUE}</td>{doiCell(pub)}
                </>))}

            {table('national', 'Papers in National Conferences',
                ['Author(s)', 'Year of publication', 'Title of paper', 'Name of conference', 'Place of conference', 'DOI'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td><td>{pub.title}</td>
                    <td>{pub.name}</td><td>{pub.city || EMPTY_VALUE}</td>{doiCell(pub)}
                </>))}

            {table('book', 'Book/Book Chapters',
                ['Author(s)', 'Year of publication', 'Name of book', 'Title of paper', 'Name of publisher'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td><td>{pub.name}</td>
                    <td>{pub.title}</td><td>{pub.publisher || EMPTY_VALUE}</td>
                </>))}

            {table('patents', 'Patents',
                ['Author(s)', 'Year of award', 'Title of patent', 'International/national'],
                pub => (<>
                    <td>{formatAuthors(pub.authors)}</td><td>{pub.year || EMPTY_VALUE}</td>
                    <td>{pub.title}</td><td>{pub.country || EMPTY_VALUE}</td>
                </>))}

            {Object.values(filtered).every(list => !list || !list.length) && (
                <StatusNotice tone="empty">
                        {filtersActive
                            ? (isOwnTab
                                ? 'No publications match these filters. Clear a filter to see more.'
                                : 'No publications from supervised students match these filters.')
                            : isOwnTab
                                ? (canEdit
                                    ? 'No publications recorded yet. Add one, or sync from ORCID or Scopus.'
                                    : 'No publications recorded yet.')
                                : 'No publications from supervised students yet.'}
                </StatusNotice>
            )}

            <CustomModal
                isOpen={showPubForm}
                onClose={() => { setShowPubForm(false); setEditPub(null); }}
                maxWidth="900px"
                minHeight="auto"
                closeOnOutsideClick={false}
            >
                <AddPublication
                    close={() => { setShowPubForm(false); setEditPub(null); }}
                    editData={editPub}
                    onSave={savePublication}
                />
            </CustomModal>
        </>
    );
};

export default ResearchPublicationsBlock;
