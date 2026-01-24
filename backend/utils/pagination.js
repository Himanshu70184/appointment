/**
 * Pagination utility for MongoDB queries
 */

/**
 * Calculate pagination parameters
 */
const getPaginationParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

/**
 * Build pagination metadata
 */
const buildPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null
  };
};

/**
 * Paginate a Mongoose query
 * @param {Model} model - Mongoose model
 * @param {Object} query - Query filters
 * @param {Object} options - Pagination options
 * @returns {Promise} - Paginated results
 */
const paginate = async (model, query = {}, options = {}) => {
  const {
    page = 1,
    limit = 10,
    sort = { createdAt: -1 },
    populate = null,
    select = null
  } = options;

  const skip = (page - 1) * limit;

  // Build query
  let dbQuery = model.find(query);
  
  if (select) {
    dbQuery = dbQuery.select(select);
  }
  
  if (populate) {
    dbQuery = dbQuery.populate(populate);
  }
  
  // Execute query with pagination
  const [results, total] = await Promise.all([
    dbQuery.sort(sort).skip(skip).limit(limit),
    model.countDocuments(query)
  ]);

  const pagination = buildPaginationMeta(total, page, limit);

  return {
    results,
    pagination
  };
};

/**
 * Paginate aggregation results
 */
const paginateAggregate = async (model, pipeline = [], options = {}) => {
  const {
    page = 1,
    limit = 10
  } = options;

  const skip = (page - 1) * limit;

  // Count total documents
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await model.aggregate(countPipeline);
  const total = countResult[0]?.total || 0;

  // Get paginated results
  const resultsPipeline = [
    ...pipeline,
    { $skip: skip },
    { $limit: limit }
  ];
  const results = await model.aggregate(resultsPipeline);

  const pagination = buildPaginationMeta(total, page, limit);

  return {
    results,
    pagination
  };
};

/**
 * Parse and validate sort parameter from query string
 * Format: ?sort=field:asc or ?sort=field:desc or ?sort=-field (for desc)
 */
const parseSortParam = (sortParam) => {
  if (!sortParam) {
    return { createdAt: -1 }; // Default sort
  }

  const sortObj = {};
  const fields = sortParam.split(',');

  fields.forEach(field => {
    if (field.startsWith('-')) {
      sortObj[field.substring(1)] = -1;
    } else if (field.includes(':')) {
      const [fieldName, order] = field.split(':');
      sortObj[fieldName] = order === 'desc' ? -1 : 1;
    } else {
      sortObj[field] = 1;
    }
  });

  return sortObj;
};

/**
 * Build filter query from request
 */
const buildFilterQuery = (filters = {}) => {
  const query = {};

  Object.keys(filters).forEach(key => {
    const value = filters[key];

    if (value === undefined || value === null || value === '') {
      return;
    }

    // Handle array values (e.g., ?status=active,pending)
    if (typeof value === 'string' && value.includes(',')) {
      query[key] = { $in: value.split(',') };
      return;
    }

    // Handle range queries (e.g., ?price_min=100&price_max=500)
    if (key.endsWith('_min')) {
      const fieldName = key.replace('_min', '');
      query[fieldName] = query[fieldName] || {};
      query[fieldName].$gte = value;
      return;
    }

    if (key.endsWith('_max')) {
      const fieldName = key.replace('_max', '');
      query[fieldName] = query[fieldName] || {};
      query[fieldName].$lte = value;
      return;
    }

    // Handle search queries (partial match)
    if (key.endsWith('_search')) {
      const fieldName = key.replace('_search', '');
      query[fieldName] = { $regex: value, $options: 'i' };
      return;
    }

    // Handle exact match
    query[key] = value;
  });

  return query;
};

module.exports = {
  getPaginationParams,
  buildPaginationMeta,
  paginate,
  paginateAggregate,
  parseSortParam,
  buildFilterQuery
};
