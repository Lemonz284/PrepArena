import './HowItWorks.css';

const STEPS = [
  {
    number: '01',
    icon: '🎯',
    title: 'Pick your focus area',
    description:
      'Choose from algorithms & data structures, system design, machine learning, behavioral, and more. Tailor every session to your target role.',
  },
  {
    number: '02',
    icon: '🤖',
    title: 'Practice with AI or peers',
    description:
      'Our AI Interviewer runs you through FAANG-style questions in real time. Get a full mock interview experience — with audio, shared code editor, and instant feedback.',
  },
  {
    number: '03',
    icon: '📊',
    title: 'Get actionable feedback',
    description:
      'Receive a detailed breakdown of your performance after every session. Know exactly what to work on, with a personalized improvement roadmap.',
  },
];

export default function HowItWorks() {
  return (
    <section className="hiw">
      <div className="hiw-inner">
        <div className="section-label">How it works</div>
        <h2 className="section-title">
          Three steps to interview confidence
        </h2>
        <p className="section-subtitle">
          Stop guessing what to study. PrepArena gives you a structured path
          from first practice session to job offer.
        </p>

        <div className="hiw-steps">
          {STEPS.map((step, idx) => (
            <div className="hiw-step" key={idx}>
              <div className="step-number">{step.number}</div>
              <div className="step-icon">{step.icon}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
