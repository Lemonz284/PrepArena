import { Brain, BookOpen, BarChart2, MessageSquare, Layers, Building2 } from 'lucide-react';
import './FeaturesSection.css';

const FEATURES = [
  {
    Icon: Brain,
    title: 'AI Mock Interviews',
    description: 'Full coding and system design sessions with real-time AI feedback tailored to company style.',
    tag: 'Popular',
  },
  {
    Icon: BookOpen,
    title: '200+ Curated Problems',
    description: 'Hand-picked questions from top companies — organised by topic, difficulty, and company.',
    tag: null,
  },
  {
    Icon: BarChart2,
    title: 'Performance Analytics',
    description: 'Track progress, surface weak spots, and receive a personalised improvement plan.',
    tag: null,
  },
  {
    Icon: MessageSquare,
    title: 'Behavioural Prep',
    description: 'Practice STAR-method answers and get feedback on clarity, structure, and impact.',
    tag: null,
  },
  {
    Icon: Layers,
    title: 'System Design Sessions',
    description: 'Architecture deep-dives covering load balancing, databases, and distributed systems.',
    tag: null,
  },
  {
    Icon: Building2,
    title: 'Company-Specific Prep',
    description: 'Targeted question sets and strategy guides for Google, Meta, Amazon, and more.',
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
          From first session to final offer — PrepArena supports every stage.
        </p>

        <div className="features-grid">
          {FEATURES.map(({ Icon, title, description, tag }, idx) => (
            <div className="feature-card" key={idx}>
              {tag && <span className="feature-tag">{tag}</span>}
              <div className="feature-icon-wrap">
                <Icon size={18} strokeWidth={1.75} />
              </div>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
