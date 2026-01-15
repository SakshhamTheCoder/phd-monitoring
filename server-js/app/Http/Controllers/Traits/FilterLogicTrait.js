import { Op } from 'sequelize';
import { sequelize } from '../../../../models/index.js';

/**
 * FilterLogicTrait utility functions for dynamic filtering
 * Equivalent to Laravel's FilterLogicTrait
 */

/**
 * Apply nested relation filters with has conditions
 * @param {Object} queryOptions - Sequelize query options
 * @param {Array} filters - Array of filter objects
 * @param {string} combinator - 'and' or 'or'
 * @returns {Object} - Modified query options
 */
export const applyHasNestedRelationFilters = (queryOptions, filters, combinator = 'and') => {
  if (!queryOptions.where) {
    queryOptions.where = {};
  }

  const conditions = [];

  for (const filter of filters) {
    const { relation, field, operator = '=', value } = filter;

    if (!relation || !field || value === null) continue;

    let condition;
    switch (operator.toLowerCase()) {
      case 'like':
        condition = { [field]: { [Op.like]: `%${value}%` } };
        break;
      case 'in':
        condition = { [field]: { [Op.in]: value.split(',') } };
        break;
      case 'null':
        condition = { [field]: { [Op.is]: null } };
        break;
      case 'notnull':
        condition = { [field]: { [Op.not]: null } };
        break;
      default:
        condition = { [field]: { [Op.eq]: value } };
    }

    const relationKey = `$${relation}.${field}$`;
    conditions.push({
      [relationKey]: condition[field]
    });
  }

  if (conditions.length > 0) {
    if (combinator === 'or') {
      queryOptions.where[Op.or] = conditions;
    } else {
      queryOptions.where[Op.and] = conditions;
    }
  }

  return queryOptions;
};

/**
 * Apply dynamic filters to a Sequelize query
 * @param {Object} queryOptions - Sequelize query options object
 * @param {Object} filters - Filter configuration object
 * @returns {Object} - Modified query options
 */
export const applyDynamicFilters = (queryOptions, filters) => {
  const combine = (filters.combine || 'and').toLowerCase();
  const filterList = filters.conditions || [];
  const mandatoryFilter = filters.mandatory_filter || null;

  console.log('Applying dynamic filters', {
    combine,
    filters: filterList,
    mandatory_filter: mandatoryFilter
  });

  if (!queryOptions.where) {
    queryOptions.where = {};
  }

  const conditions = [];

  // Apply mandatory filter first
  if (mandatoryFilter && Array.isArray(mandatoryFilter)) {
    for (const filter of mandatoryFilter) {
      if (filter.key && filter.value !== undefined) {
        const relationPath = filter.key.split('.');
        const column = relationPath.pop();
        const relation = relationPath.join('.');
        const op = filter.op || '=';
        let value = filter.value;

        if (op === 'LIKE') {
          value = `%${value}%`;
        }

        const opMap = {
          '=': Op.eq,
          '!=': Op.ne,
          '>': Op.gt,
          '>=': Op.gte,
          '<': Op.lt,
          '<=': Op.lte,
          'LIKE': Op.like,
          'IN': Op.in,
          'NOT IN': Op.notIn
        };

        const condition = { [column]: { [opMap[op] || Op.eq]: value } };

        if (relation) {
          conditions.push({ ['$' + relation + '.' + column + '$']: condition[column] });
        } else {
          conditions.push(condition);
        }
      }
    }
  }

  // Apply other dynamic filters
  const dynamicConditions = [];
  for (const filter of filterList) {
    const relationPath = filter.key.split('.');
    const column = relationPath.pop();
    const relation = relationPath.join('.');
    const op = filter.op || '=';
    let value = filter.value;

    if (value === undefined || value === null) continue;

    if (op === 'LIKE') {
      value = `%${value}%`;
    }

    const opMap = {
      '=': Op.eq,
      '!=': Op.ne,
      '>': Op.gt,
      '>=': Op.gte,
      '<': Op.lt,
      '<=': Op.lte,
      'LIKE': Op.like,
      'IN': Op.in,
      'NOT IN': Op.notIn
    };

    const condition = { [column]: { [opMap[op] || Op.eq]: value } };

    if (relation) {
      dynamicConditions.push({ ['$' + relation + '.' + column + '$']: condition[column] });
    } else {
      dynamicConditions.push(condition);
    }
  }

  if (dynamicConditions.length > 0) {
    if (combine === 'or') {
      conditions.push({ [Op.or]: dynamicConditions });
    } else {
      conditions.push(...dynamicConditions);
    }
  }

  if (conditions.length > 0) {
    if (queryOptions.where[Op.and]) {
      queryOptions.where[Op.and].push(...conditions);
    } else {
      queryOptions.where[Op.and] = conditions;
    }
  }

  console.log('Final query options', JSON.stringify(queryOptions, null, 2));

  return queryOptions;
};

/**
 * Get available filters from database
 * @param {string} pageSlug - Optional page slug to filter by
 * @returns {Promise<Array>} - Array of filter objects
 */
export const getAvailableFilters = async (pageSlug = null) => {
  try {
    let query = 'SELECT * FROM filters';
    const params = [];

    if (pageSlug) {
      // Check if applicable_pages JSON contains the pageSlug
      query += ' WHERE JSON_CONTAINS(applicable_pages, ?)';
      params.push(JSON.stringify(pageSlug));
    }

    const [results] = await sequelize.query(query, {
      replacements: params
    });

    return results.map(filter => ({
      ...filter,
      options: typeof filter.options === 'string' ? JSON.parse(filter.options) : filter.options,
      applicable_pages: typeof filter.applicable_pages === 'string'
        ? JSON.parse(filter.applicable_pages)
        : filter.applicable_pages
    }));
  } catch (error) {
    console.error('Error getting available filters:', error);
    return [];
  }
};

/**
 * Apply nested relation filter (simpler version)
 * @param {Object} queryOptions - Query options
 * @param {string} relationPath - Relation path (e.g., 'student.user')
 * @param {string} field - Field name
 * @param {*} value - Filter value
 * @param {boolean} exact - Whether to use exact match
 * @returns {Object} - Modified query options
 */
export const applyHasNestedRelationFilter = (queryOptions, relationPath, field, value, exact = false) => {
  if (!queryOptions.where) {
    queryOptions.where = {};
  }

  const condition = exact
    ? { [field]: value }
    : { [field]: { [Op.like]: `%${value}%` } };

  const key = '$' + relationPath + '.' + field + '$';
  queryOptions.where[key] = condition[field];

  return queryOptions;
};

export default {
  applyHasNestedRelationFilters,
  applyDynamicFilters,
  getAvailableFilters,
  applyHasNestedRelationFilter
};
