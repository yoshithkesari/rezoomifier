import { ExtractedKeyword } from '../types';

/**
 * Multi-word domain phrases matched PRIOR to single-word splitting (Skill 2 & FR-3.4)
 */
export const MULTI_WORD_PHRASES: string[] = [
  'machine learning',
  'deep learning',
  'system design',
  'rest api',
  'restful apis',
  'restful api',
  'unit testing',
  'integration testing',
  'end-to-end testing',
  'data structures',
  'cloud computing',
  'project management',
  'product management',
  'problem solving',
  'cross-functional',
  'version control',
  'agile methodology',
  'react native',
  'tailwind css',
  'distributed systems',
  'continuous integration',
  'continuous deployment',
  'data visualization',
  'state management',
  'web accessibility',
  'responsive design',
  'design systems',
  'performance optimization',
  'microservices architecture',
  'natural language processing',
  'computer vision',
  'api design',
  'database design',
  'type safety',
  'automated testing',
];

/**
 * Standard English stop-words + HR / job-posting filler words (Skill 2 & FR-3.3)
 */
const STOP_WORDS = new Set<string>([
  // Standard English stop-words
  'a', 'about', 'above', 'across', 'after', 'again', 'against', 'all', 'almost', 'alone',
  'along', 'already', 'also', 'although', 'always', 'am', 'among', 'an', 'and', 'another',
  'any', 'anybody', 'anyone', 'anything', 'anywhere', 'are', 'area', 'areas', 'around', 'as',
  'ask', 'asked', 'asking', 'asks', 'at', 'away', 'b', 'back', 'be', 'became', 'because',
  'become', 'becomes', 'been', 'before', 'began', 'behind', 'being', 'beings', 'below',
  'between', 'big', 'both', 'but', 'by', 'c', 'came', 'can', 'cannot', 'case', 'cases',
  'certain', 'clear', 'clearly', 'come', 'could', 'd', 'did', 'differ', 'different', 'do',
  'does', 'done', 'down', 'during', 'e', 'each', 'early', 'either', 'end', 'ended', 'ending',
  'ends', 'enough', 'even', 'evenly', 'ever', 'every', 'everybody', 'everyone', 'everything',
  'everywhere', 'f', 'face', 'faces', 'fact', 'facts', 'far', 'felt', 'few', 'find', 'finds',
  'first', 'for', 'four', 'from', 'full', 'fully', 'further', 'furthered', 'furthering',
  'furthers', 'g', 'gave', 'general', 'generally', 'get', 'gets', 'give', 'given', 'gives',
  'go', 'going', 'good', 'goods', 'got', 'great', 'greater', 'greatest', 'group', 'grouped',
  'grouping', 'groups', 'h', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'herself',
  'high', 'higher', 'highest', 'him', 'himself', 'his', 'how', 'however', 'i', 'if', 'important',
  'in', 'interest', 'interested', 'interesting', 'interests', 'into', 'is', 'it', 'its',
  'itself', 'j', 'just', 'k', 'keep', 'keeps', 'kind', 'knew', 'know', 'known', 'knows', 'l',
  'large', 'largely', 'last', 'later', 'latest', 'least', 'less', 'let', 'lets', 'like',
  'likely', 'long', 'longer', 'longest', 'm', 'made', 'make', 'making', 'man', 'many', 'may',
  'me', 'member', 'members', 'men', 'might', 'more', 'most', 'mostly', 'mr', 'mrs', 'much',
  'must', 'my', 'myself', 'n', 'necessary', 'need', 'needed', 'needing', 'needs', 'never',
  'new', 'newer', 'newest', 'next', 'no', 'nobody', 'non', 'noone', 'not', 'nothing', 'now',
  'nowhere', 'number', 'numbers', 'o', 'of', 'off', 'often', 'old', 'older', 'oldest', 'on',
  'once', 'one', 'only', 'open', 'opened', 'opening', 'opens', 'or', 'order', 'ordered',
  'ordering', 'orders', 'other', 'others', 'our', 'out', 'over', 'own', 'p', 'part', 'parted',
  'parting', 'parts', 'per', 'perhaps', 'place', 'places', 'point', 'pointed', 'pointing',
  'points', 'possible', 'present', 'presented', 'presenting', 'presents', 'problem', 'problems',
  'put', 'puts', 'q', 'quite', 'r', 'rather', 'really', 'right', 'room', 'rooms', 's', 'said',
  'same', 'saw', 'say', 'says', 'second', 'seconds', 'see', 'seem', 'seemed', 'seeming',
  'seems', 'sees', 'several', 'shall', 'she', 'should', 'show', 'showed', 'showing', 'shows',
  'side', 'sides', 'since', 'small', 'smaller', 'smallest', 'so', 'some', 'somebody', 'someone',
  'something', 'somewhere', 'state', 'states', 'still', 'such', 'sure', 't', 'take', 'taken',
  'than', 'that', 'the', 'their', 'them', 'then', 'there', 'therefore', 'these', 'they',
  'thing', 'things', 'think', 'thinks', 'this', 'those', 'though', 'thought', 'thoughts',
  'three', 'through', 'thus', 'to', 'today', 'together', 'too', 'took', 'toward', 'turn',
  'turned', 'turning', 'turns', 'two', 'u', 'under', 'until', 'up', 'upon', 'us', 'use',
  'used', 'uses', 'v', 'very', 'via', 'w', 'want', 'wanted', 'wanting', 'wants', 'was', 'way',
  'ways', 'we', 'well', 'wells', 'went', 'were', 'what', 'when', 'where', 'whether', 'which',
  'while', 'who', 'whole', 'whom', 'whose', 'why', 'will', 'with', 'within', 'without',
  'would', 'x', 'y', 'year', 'years', 'yet', 'you', 'young', 'younger', 'youngest', 'your',
  'yours', 'z',

  // Generic HR & Job Posting Filler (Skill 2 & FR-3.3)
  'role', 'roles', 'team', 'teams', 'work', 'working', 'worked', 'works', 'ability', 'strong',
  'skills', 'skill', 'using', 'build', 'building', 'built', 'looking', 'join', 'joining',
  'preferred', 'plus', 'bonus', 'responsibilities', 'responsibility', 'requirements',
  'requirement', 'required', 'require', 'requires', 'experience', 'experienced', 'experiences',
  'qualifications', 'qualification', 'qualified', 'candidate', 'candidates', 'ideal',
  'company', 'organization', 'environment', 'opportunity', 'opportunities', 'position', 'job',
  'apply', 'applying', 'application', 'equal', 'employer', 'employment', 'benefits', 'benefit',
  'salary', 'compensation', 'competitive', 'hybrid', 'remote', 'onsite', 'location', 'office',
  'degree', 'bachelor', 'bachelors', 'master', 'masters', 'phd', 'equivalent', 'related',
  'field', 'fields', 'knowledge', 'understanding', 'familiarity', 'familiar', 'proficiency',
  'proficient', 'proven', 'track', 'record', 'excellent', 'solid', 'deep', 'hands-on', 'hands',
  'level', 'senior', 'junior', 'mid', 'lead', 'staff', 'principal', 'intern', 'internship',
  'engineer', 'engineering', 'developer', 'developers', 'software', 'specialist', 'manager',
  'including', 'include', 'includes', 'included', 'etc', 'day', 'days', 'daily', 'help',
  'helping', 'ensure', 'ensuring', 'deliver', 'delivering', 'delivery', 'develop', 'developing',
  'development', 'collaborate', 'collaborating', 'closely', 'passion', 'passionate', 'motivated',
  'driven', 'fast-paced', 'paced', 'player', 'culture', 'impact', 'world', 'global', 'scale',
  'million', 'millions', 'users', 'customers', 'customer', 'client', 'clients', 'partner',
  'partners', 'stakeholders', 'stakeholder', 'business', 'solutions', 'solution', 'services',
  'service', 'products', 'product', 'platform', 'platforms', 'systems', 'system', 'tools',
  'tool', 'technologies', 'technology', 'technical', 'modern', 'clean', 'maintainable',
  'scalable', 'reliable', 'high-quality', 'quality', 'best', 'practices', 'practice', 'write',
  'writing', 'written', 'verbal', 'communication', 'communicate', 'design', 'designing',
  'implement', 'implementing', 'implementation', 'maintain', 'maintaining', 'support',
  'supporting', 'drive', 'driving', 'own', 'ownership', 'end', 'across', 'multiple', 'various',
  'minimum', 'least', 'nice-to-have', 'full-time', 'time', 'status', 'gender', 'race',
  'veteran', 'disability', 'diversity', 'inclusive', 'paid', 'health', 'dental', 'vision',
  'insurance', 'equity', 'pto', 'vacation',
  'hiring', 'craft', 'fast', 'resilient', 'workflows', 'architecture', 'end-to-end',
  'ship', 'polished', 'user', 'interfaces', 'architect', 'low-latency', 'backend', 'frontend',
  'full-stack', 'fullstack', 'backed', 'champion', 'polish', 'complex', 'browser',
  'applications', 'scale', 'automated', 'release', 'pipelines', 'pipeline', 'maintain',
  'rock-solid', 'reliability', 'suites', 'suite', 'squads', 'cycles', 'applying',
  'fundamentals', 'performance', 'bottlenecks', 'core', 'endpoints', 'endpoint',
]);

/**
 * High-signal single-word hard & soft skills given tie-breaker priority over incidental prose words
 */
const KNOWN_SKILL_TOKENS = new Set<string>([
  'typescript', 'javascript', 'python', 'java', 'golang', 'rust', 'ruby', 'php', 'swift',
  'kotlin', 'scala', 'c++', 'c#', 'f#', '.net', 'asp.net', 'sql', 'nosql', 'graphql',
  'html', 'html5', 'css', 'css3', 'sass', 'react', 'next.js', 'node.js', 'vue.js', 'angular',
  'svelte', 'redux', 'vite', 'webpack', 'esbuild', 'jest', 'vitest', 'cypress', 'playwright',
  'selenium', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'sqlite', 'dynamodb',
  'elasticsearch', 'kafka', 'rabbitmq', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  'aws', 'azure', 'gcp', 'linux', 'git', 'github', 'gitlab', 'ci/cd', 'ui/ux', 'tcp/ip',
  'microservices', 'serverless', 'caching', 'observability', 'security', 'oauth', 'jwt',
  'grpc', 'websockets', 'accessibility', 'wcag', 'agile', 'scrum', 'kanban', 'leadership',
  'mentoring', 'collaboration', 'analytics', 'figma', 'dexie', 'indexeddb',
]);

/**
 * Regex matching preserved technical tokens with +, #, ., or /
 * e.g., c++, c#, f#, .net, asp.net, node.js, next.js, vue.js, react.js, d3.js, dexie.js, ci/cd, ui/ux, tcp/ip, a/b
 */
const SPECIAL_TECH_TOKEN_REGEX =
  /(?:^|(?<=[\s,;:()[\]{}"'`]))(\.net|asp\.net|c\+\+|g\+\+|c#|f#|[a-z0-9]+(?:\.(?:js|ts|py|io|css|net|sql|ai))+|ci\/cd|ui\/ux|tcp\/ip|http\/[23]|a\/b|pl\/sql|pub\/sub|ssr\/ssg|i\/o|oauth2\.0)(?=$|[\s,;:!?()[\]{}"'`]|(?:\.(?:\s|$)))/gi;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes text while preserving technical characters (+, #, ., /, -)
 */
export function normalizeTextForMatching(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical aliases so e.g. 'nodejs' matches 'node.js', 'nextjs' matches 'next.js', 'restful api' matches 'rest api'
 */
const KEYWORD_ALIASES: Record<string, string[]> = {
  'node.js': ['nodejs'],
  'next.js': ['nextjs'],
  'vue.js': ['vuejs'],
  'react.js': ['react', 'reactjs'],
  'react': ['react.js', 'reactjs'],
  'express.js': ['expressjs'],
  'nest.js': ['nestjs'],
  'd3.js': ['d3', 'd3js'],
  'dexie.js': ['dexie'],
  'rest api': ['rest apis', 'restful api', 'restful apis'],
  'restful apis': ['rest api', 'rest apis', 'restful api'],
  'postgresql': ['postgres'],
  'postgres': ['postgresql'],
  'kubernetes': ['k8s'],
  'k8s': ['kubernetes'],
  'golang': ['go'],
  'ci/cd': ['cicd', 'ci cd'],
  'ui/ux': ['ui ux'],
  'tailwind css': ['tailwindcss'],
  'tailwindcss': ['tailwind css', 'tailwind'],
};

/**
 * Checks whether normalized resume text contains a target keyword or any of its canonical aliases,
 * safely handling non-word technical characters like c++, c#, .net, node.js, ci/cd.
 */
export function resumeContainsKeyword(normalizedResume: string, keyword: string): boolean {
  const candidates = [keyword, ...(KEYWORD_ALIASES[keyword] ?? [])];

  return candidates.some((candidate) => {
    const escaped = escapeRegExp(candidate.toLowerCase());
    // Use custom token boundaries so '+', '#', '.', '/' tokens match accurately
    const pattern = new RegExp(
      `(?:^|[^a-z0-9+#./-])${escaped}(?:s)?(?:$|[^a-z0-9+#/-])`,
      'i'
    );
    return pattern.test(normalizedResume);
  });
}

/**
 * Extracts ranked target keywords from a Job Description (top 25-30 terms, capped at maxKeywords = 28).
 */
export function extractJDKeywords(jobDescription: string, maxKeywords = 28): ExtractedKeyword[] {
  if (!jobDescription.trim()) return [];

  let working = normalizeTextForMatching(jobDescription);
  const counts = new Map<string, { count: number; isPhrase: boolean }>();

  // 1. Extract multi-word domain phrases prior to single-word splitting
  const sortedPhrases = [...MULTI_WORD_PHRASES].sort((a, b) => b.length - a.length);
  for (const phrase of sortedPhrases) {
    const regex = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(phrase)}(?:$|[^a-z0-9])`, 'gi');
    const matches = working.match(regex);
    if (matches && matches.length > 0) {
      const canonical = phrase === 'restful api' ? 'rest api' : phrase;
      const prev = counts.get(canonical);
      counts.set(canonical, {
        count: (prev?.count ?? 0) + matches.length,
        isPhrase: true,
      });
      // Mask matched phrases so constituent words are not double-counted
      working = working.replace(regex, ' ');
    }
  }

  // 2. Preserve technical tokens containing +, #, ., or / before general punctuation stripping
  const specialMatches = working.match(SPECIAL_TECH_TOKEN_REGEX);
  if (specialMatches) {
    for (const rawToken of specialMatches) {
      const token = rawToken.trim().toLowerCase();
      if (!token) continue;
      const prev = counts.get(token);
      counts.set(token, {
        count: (prev?.count ?? 0) + 1,
        isPhrase: false,
      });
    }
    working = working.replace(SPECIAL_TECH_TOKEN_REGEX, ' ');
  }

  // 3. Strip remaining punctuation noise and tokenize single words
  const cleaned = working
    .replace(/[^a-z0-9+#/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned) {
    const rawTokens = cleaned.split(' ');
    for (const rawTok of rawTokens) {
      const tok = rawTok.replace(/^[-+/]+|[-+/]+$/g, '');
      if (tok.length < 2) continue;
      if (/^\d+[a-z]*$/.test(tok)) continue; // filter pure numbers / '3x' / '5+'
      if (STOP_WORDS.has(tok)) continue;

      // Normalize trivial trailing plural ONLY when singular already exists or common tech noun
      const canonical =
        tok === 'apis'
          ? 'api'
          : tok === 'microservices'
            ? 'microservices'
            : tok === 'pipelines'
              ? 'pipelines'
              : tok;

      if (STOP_WORDS.has(canonical)) continue;

      const prev = counts.get(canonical);
      counts.set(canonical, {
        count: (prev?.count ?? 0) + 1,
        isPhrase: prev?.isPhrase ?? false,
      });
    }
  }

  // 4. Rank by frequency (phrases get slight tie-break priority) and cap at top 25-30 terms
  return Array.from(counts.entries())
    .map(([term, meta]) => ({
      term,
      count: meta.count,
      isPhrase: meta.isPhrase,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const aPriority = (a.isPhrase ? 2 : 0) + (KNOWN_SKILL_TOKENS.has(a.term) ? 1 : 0);
      const bPriority = (b.isPhrase ? 2 : 0) + (KNOWN_SKILL_TOKENS.has(b.term) ? 1 : 0);
      if (bPriority !== aPriority) return bPriority - aPriority;
      return a.term.localeCompare(b.term);
    })
    .slice(0, maxKeywords);
}
