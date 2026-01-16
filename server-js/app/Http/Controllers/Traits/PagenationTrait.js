/**
 * PagenationTrait utility functions for pagination
 * Equivalent to Laravel's PagenationTrait
 */

/**
 * Apply pagination to a query or data array
 * @param {Object|Array} query - Sequelize query or array of data
 * @param {number} page - Current page number
 * @param {number} perPage - Items per page (default: 50)
 * @returns {Object|Array} - Paginated results
 */
export const applyPagination = (query, page, perPage = 50) => {
  const offset = (page - 1) * perPage;

  // If it's an array
  if (Array.isArray(query)) {
    return query.slice(offset, offset + perPage);
  }

  // If it's a Sequelize query (has a 'findAll' or similar method)
  if (query && typeof query === 'object' && typeof query.findAll === 'function') {
    // This is a Sequelize model
    return query.findAll({
      limit: perPage,
      offset: offset
    });
  }

  // If it's already a Sequelize query object with options
  if (query && typeof query === 'object') {
    query.limit = perPage;
    query.offset = offset;
    return query;
  }

  throw new Error('Unsupported query type provided to applyPagination()');
};

/**
 * Get pagination metadata
 * @param {number} total - Total number of items
 * @param {number} page - Current page
 * @param {number} perPage - Items per page
 * @returns {Object} - Pagination metadata
 */
export const getPaginationMeta = (total, page, perPage) => {
  return {
    total,
    current_page: page,
    per_page: perPage,
    last_page: Math.ceil(total / perPage),
    from: (page - 1) * perPage + 1,
    to: Math.min(page * perPage, total)
  };
};

export default {
  applyPagination,
  getPaginationMeta
};
