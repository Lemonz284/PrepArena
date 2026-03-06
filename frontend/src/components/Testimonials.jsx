import './Testimonials.css';

const TESTIMONIALS = [
  {
    name: 'Aarav Sharma',
    role: 'Software Engineer at Google',
    avatar: 'AS',
    color: '#4285F4',
    quote:
      '"PrepArena completely changed how I approached technical interviews. The AI feedback was brutally honest — in the best way. I knew exactly what to fix before my Google onsite."',
  },
  {
    name: 'Priya Mehta',
    role: 'SDE-2 at Amazon',
    avatar: 'PM',
    color: '#FF9900',
    quote:
      '"I failed my first Amazon loop and came back to PrepArena for three months. The system design sessions and behavioral prep together made a huge difference. Got the offer on my second try."',
  },
  {
    name: 'Lucas Torres',
    role: 'Staff Engineer at Meta',
    avatar: 'LT',
    color: '#1877F2',
    quote:
      '"The company-specific question banks are incredible. I knew exactly what types of questions Meta asks and how to structure my answers. PrepArena is worth every minute you put in."',
  },
];

const COMPANIES = [
  { name: 'Google', color: '#4285F4' },
  { name: 'Meta', color: '#1877F2' },
  { name: 'Amazon', color: '#FF9900' },
  { name: 'Microsoft', color: '#737373' },
  { name: 'Netflix', color: '#E50914' },
  { name: 'OpenAI', color: '#10A37F' },
  { name: 'Stripe', color: '#635BFF' },
  { name: 'Airbnb', color: '#FF5A5F' },
];

export default function Testimonials() {
  return (
    <>
      {/* Company banner */}
      <section className="companies">
        <div className="companies-inner">
          <p className="companies-label">Our users have landed roles at</p>
          <div className="companies-list">
            {COMPANIES.map((c) => (
              <span key={c.name} className="company-name" style={{ color: c.color }}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="testimonials-inner">
          <div className="section-label">Success stories</div>
          <h2 className="section-title">Hear from people who got hired</h2>

          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, idx) => (
              <div className="testimonial-card" key={idx}>
                <p className="testimonial-quote">{t.quote}</p>
                <div className="testimonial-author">
                  <div
                    className="author-avatar"
                    style={{ background: t.color }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <div className="author-name">{t.name}</div>
                    <div className="author-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
