/**
 * Extract meaningful tech/domain keywords from combined resume + JD text.
 * Returns an array of unique keyword strings (max ~30).
 */

// Curated tech + domain term list to match against
const KNOWN_TERMS = [
  // Languages
  'Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','Kotlin','Swift',
  'Ruby','PHP','Scala','R','MATLAB','SQL','Bash','Shell',
  // Frontend
  'React','Vue','Angular','Next.js','Svelte','HTML','CSS','Tailwind','Redux','GraphQL',
  // Backend
  'Node.js','Django','FastAPI','Flask','Spring Boot','Express','REST','gRPC','WebSocket',
  // Data / ML
  'Machine Learning','Deep Learning','NLP','Computer Vision','PyTorch','TensorFlow',
  'scikit-learn','pandas','NumPy','Jupyter','Data Science','LLM','Transformers',
  'Reinforcement Learning','Feature Engineering','Model Training','Fine-tuning',
  // Cloud / Infra
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','GitHub Actions',
  'Jenkins','Nginx','Linux','Microservices','Serverless','Redis','Kafka',
  // Databases
  'PostgreSQL','MySQL','MongoDB','SQLite','Elasticsearch','DynamoDB','Snowflake','BigQuery',
  // CS Topics
  'Data Structures','Algorithms','System Design','Operating Systems','Networking',
  'Databases','Object-Oriented Design','Distributed Systems','Concurrency','Security',
  'Cryptography','Design Patterns','SOLID','Web Development','API Design',
  // Soft / domain
  'Agile','Scrum','Product Management','Communication','Leadership','Problem Solving',
  'A/B Testing','Analytics','SEO','DevOps','SRE','Observability','Monitoring',
];

const STOPWORDS = new Set([
  'the','and','for','with','from','that','this','have','been','will','are',
  'was','were','not','but','they','you','your','our','their','also','more',
  'some','about','than','into','over','such','like','each','when','where',
  'who','what','how','its','all','any','can','may','shall','must','should',
  'would','could','both','very','just','only','then','these','those','other',
  'after','before','during','within','without','between','through','across',
  'using','used','work','working','good','great','team','strong','ability',
  'experience','years','year','skills','skill','knowledge','understanding',
  'seeking','looking','required','preferred','plus','ideal','excellent',
  'responsible','responsibilities','including','development','engineer','senior',
  'junior','lead','manager','position','role','company','join','opportunity',
]);

export function extractKeywords(resumeText, jdText) {
  const combined = `${resumeText} ${jdText}`;
  const lower = combined.toLowerCase();
  const found = new Set();

  // 1. Match known terms (case-insensitive, whole-word)
  for (const term of KNOWN_TERMS) {
    const pattern = new RegExp(`\\b${escapeRegex(term.toLowerCase())}\\b`);
    if (pattern.test(lower)) {
      found.add(term);
    }
  }

  // 2. Also pull capitalised 1-2 word phrases not in stopwords (catches unlisted tools)
  const capMatches = combined.matchAll(/\b([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/g);
  for (const m of capMatches) {
    const word = m[1].trim();
    if (
      word.length > 2 &&
      !STOPWORDS.has(word.toLowerCase()) &&
      found.size < 35
    ) {
      found.add(word);
    }
  }

  return [...found].slice(0, 30);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
