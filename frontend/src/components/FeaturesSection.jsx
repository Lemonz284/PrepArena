import './FeaturesSection.css';

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI Mock Interviews',
    description:
      'Our AI interviewer conducts full coding and system design sessions in the style of a FAANG interview — with audio and a live collaborative editor.',
    tag: 'Most Popular',
  },
  {
    icon: '📝',
    title: '200+ Curated Problems',
    description:
      'Work through hand-picked problems from real FAANG interviews, organized by topic, difficulty, and company so you study what matters.',
    tag: null,
  },
  {
    icon: '📈',
    title: 'Performance Analytics',
    description:
      'Track your progress over time. See your weak spots at a glance and receive a personalized study plan that adapts as you improve.',
    tag: null,
  },
  {
    icon: '💬',
    title: 'Behavioral Prep',
    description:
      'Practice STAR-method answers to common behavioral questions. Get feedback on clarity, structure, and impact of your stories.',
    tag: null,
  },
  {
    icon: '🏗️',
    title: 'System Design Sessions',
    description:
      'Deep-dive into scalable architecture design with guided walkthroughs covering everything from load balancers to distributed databases.',
    tag: null,
  },
  {
    icon: '🎓',
    title: 'Company-Specific Prep',
    description:
      'Target Google, Meta, Amazon, Microsoft, and more. Get tailored question sets and strategy guides for each company\'s interview style.',
    tag: 'New',
  },
];

export default function FeaturesSection() {
  return (
    <section className="features">
      <div className="features-inner">
        <div className="section-label">Features</div>
        <h2 className="section-title">Everything you need to get hired</h2>
        <p className="section-subtitle">
          From your first practice session to negotiating your offer, PrepArena
          has you covered at every stage of the process.
        </p>

        <div className="features-grid">
          {FEATURES.map((f, idx) => (
            <div className="feature-card" key={idx}>
              {f.tag && <span className="feature-tag">{f.tag}</span>}
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
