import React, { useEffect, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import './ResearchProfile.css';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { generateAvatar } from '../../utils/profileImage';

const ResearchProfile = () => {
    const [profileData, setProfileData] = useState(null);
    const [activeTab, setActiveTab] = useState('faculty');

    const [filterYears, setFilterYears] = useState([]);

    const [filterType, setFilterType] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await customFetch(baseURL + '/admin/research-profile', 'GET');
                if (res && res.success) {
                    setProfileData(res.response);
                }
            } catch (error) {
                console.error("Error fetching research profile", error);
            }
        };
        fetchProfile();
    }, []);

    if (!profileData) return <Layout><div className="loading-state">Loading Profile...</div></Layout>;

    const { profile, publications } = profileData;

    // Generate dynamic avatar based on the profile name
    let profileImage = '';
    if (profile && profile.name) {
        const parts = profile.name.replace('Dr.', '').trim().split(' ');
        profileImage = generateAvatar(parts[0], parts[parts.length - 1] || '');
    }

    let availableStatuses = [];
    if (publications) {
        const allPubs = Object.values(publications).flat();
        availableStatuses = [...new Set(allPubs.map(p => p.status).filter(Boolean))];
    }

    const availableTypes = [
        { value: 'sci', label: 'SCI/SCIE/SSCI/ABDC/AHCI Journal' },
        { value: 'non_sci', label: 'Papers in Scopus Journal' },
        { value: 'international', label: 'Papers in International Conferences' },
        { value: 'national', label: 'Papers in National Conferences' },
        { value: 'book', label: 'Book/Book Chapters' },
        { value: 'patents', label: 'Patents' },
    ];

    const filteredPublications = {};
    if (publications) {
        Object.keys(publications).forEach(key => {
            if (filterType !== 'All' && filterType !== key) return;

            filteredPublications[key] = publications[key].filter(pub => {
                const matchYear = filterYears.length === 0 || filterYears.includes(pub.year.toString());
                const matchStatus = filterStatus === 'All' || pub.status == filterStatus;
                return matchYear && matchStatus;
            });
        });
    }

    const removeYearTag = (yearToRemove) => {
        setFilterYears(filterYears.filter(y => y !== yearToRemove));
    };

    const allYearsList = Array.from({ length: 2030 - 1900 + 1 }, (_, i) => 2030 - i);

    const formatAuthors = (authorsString, profileName) => {
        if (!authorsString) return '';
        if (!profileName) return authorsString;

        const regex = new RegExp(`(${profileName})`, 'gi');
        const parts = authorsString.split(regex);

        return parts.map((part, index) =>
            part.toLowerCase() === profileName.toLowerCase() ? <strong key={index}>{part}</strong> : part
        );
    };

    return (
        <Layout>
            <div className="rp-container">
                {/* Top Nav Line */}
                <div className="rp-top-nav">
                    <div className="rp-nav-left">
                        <h1 className="rp-page-title">Research Profile</h1>
                    </div>
                    <div className="rp-search-bar">
                        <i className="fa fa-search"></i>
                        <input type="text" placeholder="Search publications..." />
                    </div>
                </div>

                {/* Profile Banner */}
                <div className="rp-banner-grid">
                    {/* User Card */}
                    <div className="rp-user-card">
                        <div className="rp-avatar-wrapper">
                            <img src={profileImage} alt="Profile" className="rp-avatar" />
                            <div className="rp-status-badge"></div>
                        </div>
                        <h2>{profile.name}</h2>
                        <h3 className="rp-designation">{profile.designation}</h3>
                        <p className="rp-department">{profile.department}</p>
                        <div className="rp-user-stats">
                            <div className="rp-stat-row"><span>Joined</span><strong>{profile.joined}</strong></div>
                            <div className="rp-stat-row"><span>Publications</span><strong>{profile.total_publications}</strong></div>
                            <div className="rp-stat-row"><span>Citations</span><strong>{profile.citations}</strong></div>
                        </div>
                    </div>

                    {/* Middle Column (Contact + Numbers) */}
                    <div className="rp-middle-col">
                        <div className="rp-info-card">
                            <h4 className="rp-card-title border-red">Contact Information</h4>
                            <div className="rp-contact-list">
                                <div className="rp-contact-item">
                                    <i className="fa fa-envelope border-icon"></i>
                                    <div>
                                        <label>INSTITUTIONAL EMAIL</label>
                                        <p>{profile.email}</p>
                                    </div>
                                </div>
                                <div className="rp-contact-item">
                                    <i className="fa fa-phone border-icon"></i>
                                    <div>
                                        <label>OFFICE PHONE</label>
                                        <p>{profile.phone}</p>
                                    </div>
                                </div>
                                <div className="rp-contact-item">
                                    <i className="fa fa-linkedin border-icon"></i>
                                    <div>
                                        <label>LINKEDIN</label>
                                        <p>{profile.linkedin}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rp-stats-cards">
                            <div className="rp-mini-stat">
                                <label>TOTAL</label>
                                <span className="stat-num black">{profile.total_publications}</span>
                            </div>
                            <div className="rp-mini-stat stat-green">
                                <label>APPROVED</label>
                                <span className="stat-num green">{profile.approved}</span>
                            </div>
                            <div className="rp-mini-stat stat-yellow">
                                <label>PENDING</label>
                                <span className="stat-num yellow">{profile.pending}</span>
                            </div>
                            <div className="rp-mini-stat stat-red">
                                <label>REJECTED</label>
                                <span className="stat-num red">{profile.rejected}</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Identifiers + Sync) */}
                    <div className="rp-right-col">
                        <div className="rp-info-card">
                            <h4 className="rp-card-title border-red">Academic Identifiers</h4>
                            <div className="rp-contact-list">
                                <div className="rp-contact-item">
                                    <i className="fa fa-id-card border-icon"></i>
                                    <div>
                                        <label>ORCID ID</label>
                                        <p>{profile.orcid_id}</p>
                                    </div>
                                </div>
                                <div className="rp-contact-item">
                                    <i className="fa fa-database border-icon"></i>
                                    <div>
                                        <label>SCOPUS ID</label>
                                        <p>{profile.scopus_id}</p>
                                    </div>
                                </div>
                                <div className="rp-contact-item">
                                    <i className="fa fa-graduation-cap border-icon"></i>
                                    <div>
                                        <label>GOOGLE SCHOLAR ID</label>
                                        <p>{profile.google_scholar_id}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rp-sync-card">
                            <div className="rp-sync-info">
                                <h4>External Sync Status</h4>
                                <p>Source: <strong>Scopus</strong></p>
                                <p>Last synced: <strong>{profile.last_sync}</strong></p>
                            </div>
                            <button className="rp-sync-btn"><i className="fa fa-refresh"></i> Sync Publications</button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="rp-tabs">
                    <button className={activeTab === 'phd' ? 'active' : ''} onClick={() => setActiveTab('phd')}>PhD Student Publications</button>
                    <button className={activeTab === 'faculty' ? 'active' : ''} onClick={() => setActiveTab('faculty')}>Faculty Publications</button>
                </div>

                {/* Filters */}
                <div className="rp-filter-bar">
                    <div className="rp-filters">
                        <label>YEAR</label>
                        <div className="rp-year-filter">
                            <select
                                value="Select"
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val !== 'Select' && !filterYears.includes(val)) {
                                        setFilterYears([...filterYears, val]);
                                    }
                                }}
                                className="rp-year-input"
                            >
                                <option value="Select">Select year(s)</option>
                                {allYearsList.map(y => <option key={y} value={y.toString()}>{y}</option>)}
                            </select>

                            {filterYears.length > 0 && (
                                <div className="rp-year-tags">
                                    {filterYears.map(y => (
                                        <span key={y} className="rp-year-tag">
                                            {y} <button type="button" onClick={() => removeYearTag(y)}>&times;</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label>TYPE</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="All">All</option>
                            {availableTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>

                        <label>STATUS</label>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="All">All</option>
                            {availableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <button className="rp-export-btn"><i className="fa fa-download"></i> EXPORT CSV</button>
                </div>

                {/* Tables */}
                <div className="rp-tables">
                    {/* 1. SCI/SCIE/SSCI/ABDC/AHCI Journal */}
                    {filteredPublications?.sci && filteredPublications.sci.length > 0 && (
                        <div className="rp-table-section">
                            <h3>SCI/SCIE/SSCI/ABDC/AHCI Journal</h3>
                            <div className="rp-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>AUTHOR(S)</th>
                                            <th>YEAR OF PUBLICATION</th>
                                            <th>TITLE OF PAPER</th>
                                            <th>NAME OF THE JOURNAL</th>
                                            <th>IMPACT FACTOR</th>
                                            <th>DOI</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.sci.map((pub) => (
                                            <tr key={pub.id}>
                                                <td>{formatAuthors(pub.authors, profile.name)}</td>
                                                <td>{pub.year}</td>
                                                <td>{pub.title}</td>
                                                <td>{pub.name}</td>
                                                <td>{pub.impact_factor}</td>
                                                <td><a href={pub.doi_link} target="_blank" rel="noopener noreferrer"><i className="fa fa-link"></i> DOI</a></td>
                                                <td><span className={`status-badge ${pub.status?.toLowerCase().replace(' ', '-')}`}>{pub.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 2. Papers in Scopus Journal */}
                    {filteredPublications?.non_sci && filteredPublications.non_sci.length > 0 && (
                        <div className="rp-table-section">
                            <h3>Papers in Scopus Journal</h3>
                            <div className="rp-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>AUTHOR(S)</th>
                                            <th>YEAR OF PUBLICATION</th>
                                            <th>TITLE OF PAPER</th>
                                            <th>NAME OF THE JOURNAL</th>
                                            <th>IMPACT FACTOR</th>
                                            <th>NAME OF PUBLISHER</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.non_sci.map((pub) => (
                                            <tr key={pub.id}>
                                                <td>{formatAuthors(pub.authors, profile.name)}</td>
                                                <td>{pub.year}</td>
                                                <td>{pub.title}</td>
                                                <td>{pub.name}</td>
                                                <td>{pub.impact_factor}</td>
                                                <td>{pub.publisher}</td>
                                                <td><span className={`status-badge ${pub.status?.toLowerCase().replace(' ', '-')}`}>{pub.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 3. Papers in International Conferences */}
                    {filteredPublications?.international && filteredPublications.international.length > 0 && (
                        <div className="rp-table-section">
                            <h3>Papers in International Conferences</h3>
                            <div className="rp-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>AUTHOR(S)</th>
                                            <th>YEAR OF PUBLICATION</th>
                                            <th>TITLE OF PAPER</th>
                                            <th>NAME OF CONFERENCE</th>
                                            <th>PLACE OF CONFERENCE</th>
                                            <th>DOI</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.international.map((pub) => (
                                            <tr key={pub.id}>
                                                <td>{formatAuthors(pub.authors, profile.name)}</td>
                                                <td>{pub.year}</td>
                                                <td>{pub.title}</td>
                                                <td>{pub.name}</td>
                                                <td>{pub.country}</td>
                                                <td><a href={pub.doi_link} target="_blank" rel="noopener noreferrer"><i className="fa fa-link"></i> DOI</a></td>
                                                <td><span className={`status-badge ${pub.status?.toLowerCase().replace(' ', '-')}`}>{pub.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 4. Papers in National Conferences */}
                    {filteredPublications?.national && filteredPublications.national.length > 0 && (
                        <div className="rp-table-section">
                            <h3>Papers in National Conferences</h3>
                            <div className="rp-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>AUTHOR(S)</th>
                                            <th>YEAR OF PUBLICATION</th>
                                            <th>TITLE OF PAPER</th>
                                            <th>NAME OF CONFERENCE</th>
                                            <th>PLACE OF CONFERENCE</th>
                                            <th>DOI</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.national.map((pub) => (
                                            <tr key={pub.id}>
                                                <td>{formatAuthors(pub.authors, profile.name)}</td>
                                                <td>{pub.year}</td>
                                                <td>{pub.title}</td>
                                                <td>{pub.name}</td>
                                                <td>{pub.city}</td>
                                                <td><a href={pub.doi_link} target="_blank" rel="noopener noreferrer"><i className="fa fa-link"></i> DOI</a></td>
                                                <td><span className={`status-badge ${pub.status?.toLowerCase().replace(' ', '-')}`}>{pub.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 5. Book/Book Chapters */}
                    {filteredPublications?.book && filteredPublications.book.length > 0 && (
                        <div className="rp-table-section">
                            <h3>Book/Book Chapters</h3>
                            <div className="rp-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>AUTHOR(S)</th>
                                            <th>YEAR OF PUBLICATION</th>
                                            <th>NAME OF BOOK</th>
                                            <th>TITLE OF PAPER</th>
                                            <th>NAME OF PUBLISHER</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.book.map((pub) => (
                                            <tr key={pub.id}>
                                                <td>{formatAuthors(pub.authors, profile.name)}</td>
                                                <td>{pub.year}</td>
                                                <td>{pub.name}</td>
                                                <td>{pub.title}</td>
                                                <td>{pub.publisher}</td>
                                                <td><span className={`status-badge ${pub.status?.toLowerCase().replace(' ', '-')}`}>{pub.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 6. Patents */}
                    {filteredPublications?.patents && filteredPublications.patents.length > 0 && (
                        <div className="rp-table-section">
                            <h3>Patents</h3>
                            <div className="rp-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>AUTHOR(S)</th>
                                            <th>YEAR OF AWARD</th>
                                            <th>TITLE OF PATENT</th>
                                            <th>INTERNATIONAL/NATIONAL</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.patents.map((pub) => (
                                            <tr key={pub.id}>
                                                <td>{formatAuthors(pub.authors, profile.name)}</td>
                                                <td>{pub.year}</td>
                                                <td>{pub.title}</td>
                                                <td>{pub.country}</td>
                                                <td><span className={`status-badge ${pub.status?.toLowerCase().replace(' ', '-')}`}>{pub.status}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default ResearchProfile;
