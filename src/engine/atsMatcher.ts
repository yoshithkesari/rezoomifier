import { ATSAnalysisResult, HeuristicCheck } from '../types';
import {
  extractJDKeywords,
  normalizeTextForMatching,
  resumeContainsKeyword,
} from './jdTokenizer';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\+\d{1,3}[\s.-]?\d{4,12}\b/;

const EXPERIENCE_HEADER_REGEX =
  /(?:^|\n)\s*(?:#+\s*)?(?:work\s+experience|professional\s+experience|experience|employment|work\s+history|internships?)\b/i;
const EDUCATION_HEADER_REGEX =
  /(?:^|\n)\s*(?:#+\s*)?(?:education|academic\s+background|academics?|qualifications)\b/i;

const BULLET_LINE_REGEX = /^\s*(?:[•▪◦‣–—*-]|\d+\.)\s+\S+/gm;

const IMPACT_METRIC_REGEX =
  /(?:\$\d+(?:,\d{3})*(?:\.\d+)?\s*[kmbKMB]?\+?|\b\d+(?:\.\d+)?%|\b\d+(?:\.\d+)?x\b|\b\d{1,3}(?:,\d{3})+\+?|\b\d+\+?\s*(?:ms|sec|seconds|mins|minutes|hours|days|users|clients|customers|requests|rps|qps|endpoints|pipelines|microservices|services|engineers|developers|projects|downloads|queries|tb|gb|mb)\b)/gi;

/**
 * Runs deterministic ATS keyword coverage scoring + 5 structural/formatting heuristics
 * directly against the user's live editable resume text & HTML.
 */
export function analyzeATS(
  rawResumeText: string,
  jobDescription: string,
  editableHtml = ''
): ATSAnalysisResult {
  const start = performance.now();

  const normalizedResume = normalizeTextForMatching(rawResumeText);

  const jdKeywords = extractJDKeywords(jobDescription, 28);
  const matchedKeywords = jdKeywords.filter((kw) =>
    resumeContainsKeyword(normalizedResume, kw.term)
  );
  const missingKeywords = jdKeywords.filter(
    (kw) => !resumeContainsKeyword(normalizedResume, kw.term)
  );

  const totalKeywords = jdKeywords.length;
  const coverageScore =
    totalKeywords > 0 ? Math.round((matchedKeywords.length / totalKeywords) * 100) : 0;

  // Heuristic 1: Contact information presence (valid email + phone pattern)
  const hasEmail = EMAIL_REGEX.test(rawResumeText);
  const hasPhone = PHONE_REGEX.test(rawResumeText);
  const contactPassed = hasEmail && hasPhone;

  // Heuristic 2: Standard Experience section header
  const experiencePassed = EXPERIENCE_HEADER_REGEX.test(rawResumeText);

  // Heuristic 3: Standard Education section header
  const educationPassed = EDUCATION_HEADER_REGEX.test(rawResumeText);

  // Heuristic 4: Bullet point structure (>= 3 action bullets via text markers OR <li> items in .docx/.pdf HTML)
  const textBullets = (rawResumeText.match(BULLET_LINE_REGEX) ?? []).length;
  const htmlListItems = (editableHtml.match(/<li\b/gi) ?? []).length;
  const bulletCount = Math.max(textBullets, htmlListItems);
  const bulletsPassed = bulletCount >= 3;

  // Heuristic 5: Quantified impact metrics (>= 2 numbers, percentages, or multipliers like 40%, 2x, $1M)
  const rawMetricMatches = rawResumeText.match(IMPACT_METRIC_REGEX) ?? [];
  const validMetrics = Array.from(
    new Set(
      rawMetricMatches
        .map((m) => m.trim())
        .filter((m) => !/^(?:19|20)\d{2}$/.test(m))
    )
  );
  const metricCount = validMetrics.length;
  const metricsPassed = metricCount >= 2;

  const heuristics: HeuristicCheck[] = [
    {
      id: 'contact',
      label: 'Contact Info (Email & Phone)',
      detail: contactPassed
        ? 'Valid email & phone detected'
        : !hasEmail && !hasPhone
          ? 'Add email address and phone number'
          : !hasEmail
            ? 'Missing valid email address'
            : 'Missing phone number pattern',
      passed: contactPassed,
    },
    {
      id: 'experience',
      label: 'Standard Experience Header',
      detail: experiencePassed
        ? 'ATS-standard Experience section present'
        : 'Add a standard "Experience" section',
      passed: experiencePassed,
    },
    {
      id: 'education',
      label: 'Standard Education Header',
      detail: educationPassed
        ? 'ATS-standard Education section present'
        : 'Add a standard "Education" section',
      passed: educationPassed,
    },
    {
      id: 'bullets',
      label: 'Action Bullet Structure',
      detail: `${bulletCount} / 3+ action bullets found`,
      passed: bulletsPassed,
    },
    {
      id: 'metrics',
      label: 'Quantified Impact Metrics',
      detail:
        metricCount > 0
          ? `${metricCount} / 2+ metrics (${validMetrics.slice(0, 3).join(', ')})`
          : '0 / 2+ metrics (add %, 2x, $1M, etc.)',
      passed: metricsPassed,
    },
  ];

  const computeTimeMs = Math.max(1, Math.round((performance.now() - start) * 10) / 10);

  return {
    coverageScore,
    totalKeywords,
    matchedKeywords,
    missingKeywords,
    heuristics,
    bulletCount,
    metricCount,
    computeTimeMs,
  };
}
