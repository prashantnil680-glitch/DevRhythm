const axios = require('axios');
const { client: redisClient } = require('../config/redis');

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';
const CACHE_TTL = 60 * 60;          // 1 hour for normal search cache
const VIP_BLACKLIST_TTL = 60 * 60;  // 1 hour for VIP slug blacklist

const slugifyTag = (tag) => {
  return tag.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
};

const extractSlug = (url) => {
  const match = url.match(/\/problems\/([^/?#]+)/);
  return match ? match[1] : null;
};

/**
 * Internal helper to make GraphQL requests to LeetCode.
 * @param {string} query - GraphQL query string
 * @param {object} variables - Query variables
 * @returns {Promise<object>} Response data
 */
const _graphqlRequest = async (query, variables) => {
  const response = await axios.post(LEETCODE_GRAPHQL_URL, { query, variables }, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
  if (response.data.errors) {
    throw new Error(`GraphQL error: ${response.data.errors[0].message}`);
  }
  return response.data;
};

/**
 * Check if a slug is known to be a VIP problem (cached in Redis).
 * If yes, throw error immediately without making a GraphQL request.
 */
const checkVipBlacklist = async (slug) => {
  if (!redisClient) return false;
  const key = `vip:slug:${slug}`;
  const exists = await redisClient.exists(key);
  return exists === 1;
};

const addToVipBlacklist = async (slug) => {
  if (!redisClient) return;
  const key = `vip:slug:${slug}`;
  await redisClient.setex(key, VIP_BLACKLIST_TTL, '1');
};

/**
 * Fetch problem details from LeetCode using the GraphQL API.
 * Blocks VIP problems by throwing an error if isPaidOnly === true.
 * Also caches VIP slugs to avoid repeated requests.
 */
const fetchProblemDetails = async (url) => {
  const slug = extractSlug(url);
  if (!slug) throw new Error('Invalid LeetCode URL');

  // Quick VIP blacklist check before making any request
  const isBlacklisted = await checkVipBlacklist(slug);
  if (isBlacklisted) {
    const vipError = new Error('VIP problems are not supported');
    vipError.code = 'VIP_QUESTION_NOT_ALLOWED';
    vipError.statusCode = 403;
    throw vipError;
  }

  const query = `
    query getProblemDetail($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        difficulty
        content
        isPaidOnly
        topicTags {
          name
        }
        codeSnippets {
          lang
          code
        }
      }
    }
  `;

  try {
    const response = await _graphqlRequest(query, { titleSlug: slug });
    const question = response?.data?.question;
    if (!question) {
      const error = new Error('Problem not found on LeetCode');
      error.statusCode = 404;
      throw error;
    }

    // Block VIP (paid-only) problems
    if (question.isPaidOnly === true) {
      await addToVipBlacklist(slug);
      const vipError = new Error('VIP problems are not supported');
      vipError.code = 'VIP_QUESTION_NOT_ALLOWED';
      vipError.statusCode = 403;
      throw vipError;
    }

    const codeSnippets = {};
    if (question.codeSnippets && Array.isArray(question.codeSnippets)) {
      for (const snippet of question.codeSnippets) {
        codeSnippets[snippet.lang] = snippet.code;
      }
    }

    return {
      title: question.title,
      difficulty: question.difficulty,
      tags: question.topicTags.map(t => t.name),
      link: url,
      description: question.content,
      codeSnippets,
    };
  } catch (error) {
    if (error.statusCode === 404) throw error;
    console.error('LeetCode fetch error:', error.message);
    throw new Error('Failed to fetch problem from LeetCode');
  }
};

/**
 * Search LeetCode problems by name or tag, with Redis caching.
 * Filters out VIP problems (isPaidOnly === true).
 */
const searchProblems = async (query, filterType = 'name') => {
  const cacheKey = `leetcode:search:${filterType}:${query.toLowerCase()}`;

  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis cache read error:', err.message);
    }
  }

  const filters = {};
  if (filterType === 'tag') {
    const tagSlug = slugifyTag(query);
    filters.tags = [tagSlug];
  } else {
    filters.searchKeywords = query;
  }

  const searchQuery = `
    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
      problemsetQuestionList: questionList(
        categorySlug: $categorySlug
        limit: $limit
        skip: $skip
        filters: $filters
      ) {
        total: totalNum
        questions: data {
          title
          titleSlug
          difficulty
          isPaidOnly
          topicTags {
            name
          }
        }
      }
    }
  `;

  const variables = {
    categorySlug: "",
    limit: 10,
    skip: 0,
    filters,
  };

  try {
    const response = await _graphqlRequest(searchQuery, variables);
    let questions = response.data?.problemsetQuestionList?.questions || [];
    // Filter out VIP (paid-only) problems
    questions = questions.filter(q => q.isPaidOnly !== true);

    // Optionally, add VIP slugs to blacklist for future direct fetches
    for (const q of questions) {
      if (q.isPaidOnly === true) {
        await addToVipBlacklist(q.titleSlug);
      }
    }

    const results = questions.map(q => ({
      title: q.title,
      slug: q.titleSlug,
      difficulty: q.difficulty,
      tags: q.topicTags.map(t => t.name),
      url: `https://leetcode.com/problems/${q.titleSlug}/`,
    }));

    if (redisClient && results.length > 0) {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
    }

    return results;
  } catch (error) {
    console.error('LeetCode search error:', error.message);
    throw new Error('Failed to search LeetCode');
  }
};

/**
 * Fetch today's LeetCode Problem of the Day.
 * Cached for 24 hours. VIP detection is not needed as daily problem is never VIP.
 */
const getDailyProblem = async (forceRefresh = false) => {
  const cacheKey = 'leetcode:daily';

  if (!forceRefresh && redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis cache read error for daily problem:', err.message);
    }
  }

  const query = `
    query questionOfToday {
      activeDailyCodingChallengeQuestion {
        date
        userStatus
        link
        question {
          title
          titleSlug
          difficulty
          content
          isPaidOnly
          topicTags {
            name
          }
          codeSnippets {
            lang
            code
          }
        }
      }
    }
  `;

  const response = await _graphqlRequest(query, {});
  const daily = response.data?.activeDailyCodingChallengeQuestion;
  if (!daily) {
    throw new Error('No daily problem found on LeetCode');
  }
  // Daily problem is never VIP, but we still check for safety
  if (daily.question.isPaidOnly === true) {
    throw new Error('Daily problem is VIP – not supported');
  }

  const result = {
    date: daily.date,
    title: daily.question.title,
    titleSlug: daily.question.titleSlug,
    difficulty: daily.question.difficulty,
    link: `https://leetcode.com${daily.link}`,
    tags: daily.question.topicTags.map(t => t.name),
    codeSnippets: daily.question.codeSnippets.reduce((acc, snippet) => {
      acc[snippet.lang] = snippet.code;
      return acc;
    }, {})
  };

  if (redisClient) {
    try {
      await redisClient.setex(cacheKey, 86400, JSON.stringify(result));
    } catch (err) {
      console.warn('Redis cache write error for daily problem:', err.message);
    }
  }

  return result;
};

module.exports = {
  fetchProblemDetails,
  searchProblems,
  getDailyProblem,
  _graphqlRequest,   // <-- EXPORTED for use in leetcodeSync.service.js
};