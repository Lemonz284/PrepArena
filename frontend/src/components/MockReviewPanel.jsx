import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import './MockReviewPanel.css';

function asList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
}

export default function MockReviewPanel({ reviewPayload }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [review, setReview] = useState(null);

  const stablePayload = useMemo(() => reviewPayload || {}, [reviewPayload]);

  useEffect(() => {
    let aborted = false;

    async function fetchReview() {
      if (!stablePayload || !Array.isArray(stablePayload.questions) || !stablePayload.questions.length) {
        return;
      }

      setLoading(true);
      setError('');
      setReview(null);

      try {
        const res = await fetch('/api/mock-test-review/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(stablePayload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to generate review');
        }

        if (!aborted) {
          setReview({
            overview: String(data.overview || '').trim(),
            strengths: asList(data.strengths),
            gaps: asList(data.gaps),
            recommendations: asList(data.recommendations),
          });
        }
      } catch (err) {
        if (!aborted) {
          setError(err.message || 'Unable to load review');
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }

    fetchReview();
    return () => {
      aborted = true;
    };
  }, [stablePayload]);

  return (
    <section className="review-card">
      <div className="review-head">
        <div className="review-title">
          <Sparkles size={16} strokeWidth={2} />
          <span>AI Review</span>
        </div>
        <span className="review-subtitle">Generated with fallback Groq key</span>
      </div>

      {loading && (
        <div className="review-state">
          <Loader2 size={16} className="spin" />
          <span>Generating recommendations...</span>
        </div>
      )}

      {!loading && error && (
        <div className="review-state review-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && review && (
        <div className="review-content">
          {review.overview && <p className="review-overview">{review.overview}</p>}

          {!!review.strengths.length && (
            <div className="review-block">
              <h4>Strengths</h4>
              <ul>
                {review.strengths.map((item, idx) => <li key={`s-${idx}`}>{item}</li>)}
              </ul>
            </div>
          )}

          {!!review.gaps.length && (
            <div className="review-block">
              <h4>Gaps</h4>
              <ul>
                {review.gaps.map((item, idx) => <li key={`g-${idx}`}>{item}</li>)}
              </ul>
            </div>
          )}

          {!!review.recommendations.length && (
            <div className="review-block">
              <h4>Recommendations</h4>
              <ul>
                {review.recommendations.map((item, idx) => <li key={`r-${idx}`}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
