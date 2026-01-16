import {
  BroadAreaSpecialization,
  Department,
  ExaminersRecommendation,
  Faculty,
  OutsideExpert,
  User
} from '../../../models/index.js';
import { Op } from 'sequelize';
import axios from 'axios';

// Simple cache implementation
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const cacheGet = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.value;
};

const cacheSet = (key, value, ttl = CACHE_TTL) => {
  cache.set(key, {
    value,
    expiry: Date.now() + ttl
  });
};

export const suggestSpecialization = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role', 'student', 'faculty']
    });

    let department;
    if (user.current_role?.role === 'student') {
      const student = await user.getStudent({ include: ['department'] });
      department = student.department;
    } else {
      const faculty = await user.getFaculty({ include: ['department'] });
      department = faculty.department;
    }

    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        message: 'text is required'
      });
    }

    const specializations = await BroadAreaSpecialization.findAll({
      where: {
        department_id: department.id,
        broad_area: {
          [Op.like]: `%${text}%`
        }
      }
    });

    const result = specializations.map(spec => ({
      ...spec.toJSON(),
      name: spec.broad_area
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error suggesting specialization:', error);
    return res.status(500).json({
      message: 'Failed to suggest specialization',
      error: error.message
    });
  }
};

export const suggestExaminer = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: ['current_role']
    });

    if (user.current_role?.role !== 'faculty') {
      return res.status(403).json({
        message: 'Only faculty can view examiners'
      });
    }

    const { text } = req.body;

    if (!text) {
      return res.status(200).json([]);
    }

    const examiners = await ExaminersRecommendation.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${text}%` } },
          { email: { [Op.like]: `%${text}%` } },
          { phone: { [Op.like]: `%${text}%` } }
        ]
      },
      attributes: { exclude: ['added_by'] }
    });

    return res.status(200).json(examiners);
  } catch (error) {
    console.error('Error suggesting examiner:', error);
    return res.status(500).json({
      message: 'Failed to suggest examiner',
      error: error.message
    });
  }
};

export const suggestFaculty = async (req, res) => {
  try {
    const { text, department_id } = req.body;

    if (!text) {
      return res.status(200).json([]);
    }

    const whereClause = {};
    if (department_id) {
      const department = await Department.findByPk(department_id);
      if (!department) {
        return res.status(404).json({ message: 'Department not found' });
      }
      whereClause.department_id = department_id;
    }

    const faculty = await Faculty.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          where: {
            [Op.or]: [
              { first_name: { [Op.like]: `%${text}%` } },
              { last_name: { [Op.like]: `%${text}%` } }
            ]
          }
        },
        {
          model: Department,
          as: 'department'
        }
      ]
    });

    const result = faculty.map(f => ({
      id: f.faculty_code,
      name: `${f.user.first_name} ${f.user.last_name}`.trim(),
      email: f.user.email,
      designation: f.designation,
      department: f.department?.department_name || 'N/A'
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error suggesting faculty:', error);
    return res.status(500).json({
      message: 'Failed to suggest faculty',
      error: error.message
    });
  }
};

export const suggestDepartment = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(200).json([]);
    }

    const departments = await Department.findAll({
      where: {
        department_name: { [Op.like]: `%${text}%` }
      }
    });

    const result = departments.map(dept => ({
      id: dept.id,
      name: dept.department_name
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error suggesting department:', error);
    return res.status(500).json({
      message: 'Failed to suggest department',
      error: error.message
    });
  }
};

export const suggestOutsideExpert = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(200).json([]);
    }

    const outsideExperts = await OutsideExpert.findAll({
      where: {
        [Op.or]: [
          { first_name: { [Op.like]: `%${text}%` } },
          { last_name: { [Op.like]: `%${text}%` } },
          { designation: { [Op.like]: `%${text}%` } },
          { email: { [Op.like]: `%${text}%` } },
          { phone: { [Op.like]: `%${text}%` } }
        ]
      }
    });

    const result = outsideExperts.map(expert => ({
      id: expert.id,
      name: `${expert.first_name} ${expert.last_name}`.trim(),
      email: expert.email,
      designation: expert.designation,
      department: expert.department || 'N/A',
      institution: expert.institution,
      phone: expert.phone
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error suggesting outside expert:', error);
    return res.status(500).json({
      message: 'Failed to suggest outside expert',
      error: error.message
    });
  }
};

export const suggestInstitute = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 3) {
      return res.status(200).json([]);
    }

    const institutes = await OutsideExpert.findAll({
      where: {
        institution: { [Op.like]: `%${text}%` }
      },
      attributes: ['institution'],
      group: ['institution']
    });

    return res.status(200).json(institutes);
  } catch (error) {
    console.error('Error suggesting institute:', error);
    return res.status(500).json({
      message: 'Failed to suggest institute',
      error: error.message
    });
  }
};

export const suggestCountry = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        message: 'text is required'
      });
    }

    // Check cache first
    let countriesList = cacheGet('all_countries');

    if (!countriesList) {
      // Fetch from API
      const response = await axios.get('https://restcountries.com/v3.1/all');
      countriesList = response.data.map(country => ({
        name: country.name.common,
        code: country.cca2
      }));

      // Cache the result
      cacheSet('all_countries', countriesList);
    }

    // Filter based on input text
    const filteredCountries = countriesList.filter(country =>
      country.name.toLowerCase().includes(text.toLowerCase())
    );

    return res.status(200).json(filteredCountries);
  } catch (error) {
    console.error('Error suggesting country:', error);
    return res.status(500).json({
      message: 'Failed to suggest country',
      error: error.message
    });
  }
};

export const suggestState = async (req, res) => {
  try {
    const { text, country_code } = req.body;

    if (!text || !country_code) {
      return res.status(400).json({
        message: 'text and country_code are required'
      });
    }

    if (text.length < 3) {
      return res.status(200).json([]);
    }

    const apiKey = 'd73532d63bmsh3810e432a029c30p12ba79jsn73893239d31d';
    const countryCode = country_code.toLowerCase();
    const searchText = text.toLowerCase();
    const cacheKey = `states_${countryCode}_${searchText}`;

    // Check cache first
    let states = cacheGet(cacheKey);

    if (!states) {
      // Fetch from API
      const response = await axios.get(
        `https://wft-geo-db.p.rapidapi.com/v1/geo/countries/${countryCode}/regions`,
        {
          params: { namePrefix: searchText },
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
          }
        }
      );

      states = response.data.data.map(state => ({
        name: state.name,
        code: state.isoCode
      }));

      // Cache the result
      cacheSet(cacheKey, states);
    }

    return res.status(200).json(states);
  } catch (error) {
    console.error('Error suggesting state:', error);
    return res.status(500).json({
      message: 'Failed to suggest state',
      error: error.message
    });
  }
};

export const suggestCity = async (req, res) => {
  try {
    const { text, country_code, state_code } = req.body;

    if (!text || !country_code || !state_code) {
      return res.status(400).json({
        message: 'text, country_code, and state_code are required'
      });
    }

    const apiKey = 'd73532d63bmsh3810e432a029c30p12ba79jsn73893239d31d';
    const countryCode = country_code.toLowerCase();
    const stateCode = state_code.toLowerCase();
    const searchText = text.toLowerCase();
    const cacheKey = `cities_${countryCode}_${stateCode}_${searchText}`;

    // Check cache first
    let cities = cacheGet(cacheKey);

    if (!cities) {
      // Fetch from API
      const response = await axios.get(
        `https://wft-geo-db.p.rapidapi.com/v1/geo/countries/${countryCode}/regions/${stateCode}/cities`,
        {
          params: { namePrefix: searchText },
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'wft-geo-db.p.rapidapi.com'
          }
        }
      );

      cities = response.data.data.map(city => ({
        name: city.name,
        id: city.id
      }));

      // Cache the result
      cacheSet(cacheKey, cities);
    }

    return res.status(200).json(cities);
  } catch (error) {
    console.error('Error suggesting city:', error);
    return res.status(500).json({
      message: 'Failed to suggest city',
      error: error.message
    });
  }
};

export const suggestDesignation = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.length < 3) {
      return res.status(200).json([]);
    }

    const designations = await Faculty.findAll({
      where: {
        designation: { [Op.like]: `%${text}%` }
      },
      attributes: ['designation'],
      group: ['designation']
    });

    const result = designations.map(d => ({
      name: d.designation,
      id: d.designation
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error suggesting designation:', error);
    return res.status(500).json({
      message: 'Failed to suggest designation',
      error: error.message
    });
  }
};
