import React from 'react';
import PublicPageBar from '../../components/publicPageBar/PublicPageBar';
import './Team.css';

const mentor = {
  name: 'Dr. Tarunpreet Bhatia',
  title: 'Associate Dean of Strategic Initiatives',
  secondTitle: 'Associate Professor, CSED',
  image: '/images/tarun.jpg',
  linkedin: 'https://www.linkedin.com/in/tarunpreet-bhatia30/',
  email: 'tarunpreet@thapar.edu',
};

// The batch reads under the name. It replaced the two batch sections, which
// split the team into two grids and made the second look like an afterthought.
// The order is unchanged: the older batch first. Each person carries their own
// string rather than sharing a constant, because the branch differs.

const team = [
  {
    name: 'Aadi Jain',
    role: 'UI and UX designer',
    batch: 'B.E. COE (2021-2025)',
    image: '/images/aadi.png',
    github: 'https://github.com/nandinnijainn',
    linkedin: 'https://www.linkedin.com/in/aadi-jain-3732b4247/',
    email: 'ajain6_be21@thapar.edu',
  },
  {
    name: 'Abhinav Jain',
    role: 'Mobile app developer',
    batch: 'B.E. COE (2022-2026)',
    image: '/images/abhinav.jpeg',
    github: 'https://github.com/AbhinavJain1234',
    linkedin: 'https://www.linkedin.com/in/abhinavjain30/',
    email: 'abhinav4subs@gmail.com',
  },
  {
    name: 'Akarsh Srivastava',
    role: 'Backend developer',
    batch: 'B.E. COE (2022-2026)',
    image: '/images/akarsh.jpeg',
    github: 'https://github.com/akarsh911',
    linkedin: 'https://www.linkedin.com/in/aksrv09/',
    email: 'asrivastava2_be22@thapar.edu',
  },
  {
    name: 'Nandini Jain',
    role: 'Frontend developer',
    batch: 'B.E. COE (2022-2026)',
    image: '/images/nandini.jpeg',
    github: 'https://github.com/nandinnijainn',
    linkedin: 'https://www.linkedin.com/in/nandini-jain-446271267/',
    email: 'nandini1904jain@gmail.com',
  },
  {
    name: 'Arnav Raj Singh',
    role: 'Backend developer',
    batch: 'B.E. ECE (2023-2027)',
    image: '/images/arnav.png',
    github: 'https://github.com/arnavrajsingh19',
    linkedin: 'https://www.linkedin.com/in/arnavrajsingh18',
    email: 'asingh32_be23@thapar.edu',
  },
  {
    name: 'Manjot Kaur',
    role: 'Frontend developer and UI/UX',
    batch: 'B.E. COE (2023-2027)',
    image: '/images/manjot.jpeg',
    github: 'https://github.com/kaurmanjot20',
    linkedin: 'https://www.linkedin.com/in/kaurmanjot20',
    email: 'mkaur_be23@thapar.edu',
  },
  {
    name: 'Sakshham Bhagat',
    role: 'Backend and app developer',
    batch: 'B.E. COE (2023-2027)',
    image: '/images/sakshham.png',
    github: 'https://github.com/SakshhamTheCoder',
    linkedin: 'https://www.linkedin.com/in/sakshhamthecoder',
    email: 'sbhagat_be23@thapar.edu',
  },
  {
    name: 'Saumil Makkar',
    role: 'Backend developer',
    batch: 'B.E. COE (2023-2027)',
    image: '/images/saumil.png',
    github: 'https://github.com/SaumilMakkar',
    linkedin: 'https://www.linkedin.com/in/saumil-makkar-3731a0285',
    email: 'smakkar_be23@thapar.edu',
  },
];

const PersonCard = ({ name, title, secondTitle, batch, image, github, linkedin, email, isMentor }) => {
  const [imgError, setImgError] = React.useState(false);
  const cleanTitle = title ? title.trim() : '';

  const getInitials = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`person-card ${isMentor ? 'mentor-card' : ''}`}>
      <div className='person-avatar-wrap'>
        {imgError || !image ? (
          <div className='person-avatar-fallback'>{getInitials(name)}</div>
        ) : (
          <img 
            src={image} 
            alt={name} 
            className='person-avatar' 
            onError={() => setImgError(true)} 
          />
        )}
      </div>
      <div className='person-content'>
        <h3>{name}</h3>
        {batch && <p className='person-batch'>{batch}</p>}
        <p className='person-title'>{cleanTitle}</p>
        {secondTitle && <p className='person-title person-title--second'>{secondTitle}</p>}
        <div className='person-social'>
          {github && (
            <a href={github} target='_blank' rel='noopener noreferrer' title="GitHub" aria-label={`${name} on GitHub`}>
              <i className="fa fa-github" aria-hidden="true"></i>
            </a>
          )}
          {linkedin && (
            <a href={linkedin} target='_blank' rel='noopener noreferrer' title="LinkedIn" aria-label={`${name} on LinkedIn`}>
              <i className="fa fa-linkedin-square" aria-hidden="true"></i>
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} title="Email" aria-label={`Email ${name}`}>
              <i className="fa fa-envelope" aria-hidden="true"></i>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const Team = () => (
    <div className='team-page-wrapper'>
      <PublicPageBar title="Meet the portal team" />
      
      <div className='team-container'>
        <div className='team-layout'>
          <div className='team-mentor'>
            <h2 className='team-subheading'>Mentor</h2>
            <PersonCard {...mentor} isMentor={true} />
          </div>

          <div className='team-members'>
            <h2 className='team-subheading'>Development team</h2>
            <div className='team-grid'>
              {team.map((person) => (
                <PersonCard key={person.name} {...person} title={person.role} />
              ))}
            </div>
          </div>
        </div>

        <p className='team-contact'>
          For queries, you can reach us at{' '}
          <a href='mailto:tarunpreet@thapar.edu'>tarunpreet@thapar.edu</a>
          {' '}or{' '}
          <a href='mailto:sbhagat_be23@thapar.edu'>sbhagat_be23@thapar.edu</a>
        </p>
      </div>
    </div>
);

export default Team;
