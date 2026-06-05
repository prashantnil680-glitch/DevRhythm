/**
 * src/utils/autoImports.js
 *
 * Provides standard library imports and helpers to be prepended to user code,
 * mimicking LeetCode's pre‑injected environment.
 * Currently supports Python and C++.
 */

/**
 * Returns a string of standard Python imports and utility definitions.
 * These imports are automatically available to the user without manual typing.
 * @returns {string}
 */
function getPythonImports() {
  return `
from typing import List, Optional, Dict, Set, Tuple, Union, Callable, Any
from collections import defaultdict, deque, Counter, OrderedDict
from itertools import accumulate, product, combinations, permutations, chain
from functools import reduce, lru_cache, cache, partial
import heapq
import bisect
import math
import string
import random
import re
import datetime
import statistics
import sys
import os
import json

def sorted_list(iterable=None):
    """Return a sorted list (helper for sorted sets via bisect)."""
    return sorted(iterable) if iterable else []

`.trim();
}

/**
 * Returns a string of standard C++ includes and using namespace std.
 * Injected before the user's code to reduce boilerplate.
 * @returns {string}
 */
function getCppIncludes() {
  return `
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <numeric>
#include <unordered_map>
#include <unordered_set>
#include <map>
#include <set>
#include <queue>
#include <stack>
#include <deque>
#include <cmath>
#include <climits>
#include <cstring>
#include <functional>
#include <utility>
#include <tuple>
#include <initializer_list>
#include <memory>
#include <cstdlib>
#include <ctime>
#include <cassert>
using namespace std;
`.trim();
}

module.exports = { getPythonImports, getCppIncludes };