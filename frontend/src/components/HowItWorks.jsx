import './HowItWorks.css';

const STEPS = [
  {
    number: '01',
    title: 'Pick your focus area',
    description: 'Choose from algorithms, system design, ML, behavioural, and more. Every session is tailored to your target role.',
  },
  {
    number: '02',
    title: 'Practice with the AI',
    description: 'Our AI runs you through questions in real time, adapts to your answers, and gives instant feedback after each response.',
  },
  {
    number: '03',
    title: 'Get actionable feedback',
    description: 'Receive a detailed breakdown after every session. Know exactly what to improve, with a personalised roadmap.',
  },
];

export default function HowItWorks() {
  return (
    <section className="hiw">
      <div className="hiw-inner">
        <div className="section-label">How it works</div>
        <h2 className="section-title">Three steps to interview confidence</h2>
        <p className="section-subtitle">
          A structured path from first practice session to job offer.
        </p>

        <div className="hiw-steps">
          {STEPS.map((step, idx) => (
            <div className="hiw-step" key={idx}>
              <div className="step-number">{step.number}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-desc">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
