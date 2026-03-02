import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './MockTest.css';

/* ── Hardcoded question bank (keyed by topic) ── */
const QUESTION_BANK = {
  'Data Structures': [
    { q: 'Which data structure uses LIFO order?', options: ['Queue', 'Stack', 'Heap', 'Graph'], answer: 1 },
    { q: 'What is the time complexity of searching in a balanced BST?', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], answer: 1 },
    { q: 'Which traversal visits root first?', options: ['Inorder', 'Postorder', 'Preorder', 'Level-order'], answer: 2 },
    { q: 'A hash table has average-case lookup of:', options: ['O(n)', 'O(log n)', 'O(1)', 'O(n log n)'], answer: 2 },
    { q: 'Which is NOT a linear data structure?', options: ['Array', 'Linked List', 'Stack', 'Tree'], answer: 3 },
    { q: 'Dijkstra\'s algorithm finds:', options: ['Minimum spanning tree', 'Shortest path', 'Topological sort', 'Cycle detection'], answer: 1 },
    { q: 'What does a priority queue use internally?', options: ['Stack', 'Array', 'Heap', 'Graph'], answer: 2 },
    { q: 'In a doubly linked list, each node has:', options: ['One pointer', 'Two pointers', 'Three pointers', 'None'], answer: 1 },
    { q: 'Which structure is best for BFS?', options: ['Stack', 'Queue', 'Heap', 'Tree'], answer: 1 },
    { q: 'AVL trees maintain balance by ensuring height difference is at most:', options: ['0', '1', '2', '3'], answer: 1 },
    { q: 'Which data structure is used for undo operations?', options: ['Queue', 'Stack', 'Graph', 'Hash'], answer: 1 },
    { q: 'Insertion sort is best when input is:', options: ['Random', 'Reverse sorted', 'Nearly sorted', 'Unsorted'], answer: 2 },
    { q: 'Which structure allows O(1) push and pop?', options: ['Queue', 'Stack', 'BST', 'Trie'], answer: 1 },
    { q: 'A complete binary tree with n nodes has height:', options: ['n', 'log n', 'n/2', 'n²'], answer: 1 },
    { q: 'Trie is primarily used for:', options: ['Sorting', 'Graph traversal', 'String searching', 'Hashing'], answer: 2 },
    { q: 'Which is an in-place sorting algorithm?', options: ['Merge Sort', 'Counting Sort', 'Quick Sort', 'Radix Sort'], answer: 2 },
    { q: 'Best case of bubble sort is:', options: ['O(n²)', 'O(n log n)', 'O(n)', 'O(1)'], answer: 2 },
    { q: 'A deque supports insertions at:', options: ['Front only', 'Back only', 'Both ends', 'Middle only'], answer: 2 },
    { q: 'Segment trees are used for:', options: ['Graph search', 'Range queries', 'String match', 'Sorting'], answer: 1 },
    { q: 'What is the worst-case time for quicksort?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], answer: 2 },
  ],
  default: [
    { q: 'What does CPU stand for?', options: ['Central Processing Unit', 'Core Processing Utility', 'Central Program Unit', 'Core Program Utility'], answer: 0 },
    { q: 'Which protocol is used for web browsing?', options: ['FTP', 'SMTP', 'HTTP', 'SSH'], answer: 2 },
    { q: 'What is a primary key in a database?', options: ['A foreign reference', 'A unique row identifier', 'An index column', 'A default value'], answer: 1 },
    { q: 'REST APIs are stateless. What does that mean?', options: ['Each request is dependent on previous', 'Server stores session state', 'Each request is independent', 'No authentication needed'], answer: 2 },
    { q: 'Which layer does TCP operate at?', options: ['Network', 'Data Link', 'Transport', 'Application'], answer: 2 },
    { q: 'What is a deadlock?', options: ['Infinite loop', 'Two processes waiting on each other', 'Memory overflow', 'CPU overload'], answer: 1 },
    { q: 'Git is a:', options: ['Database', 'Version control system', 'Programming language', 'Web framework'], answer: 1 },
    { q: 'Which HTTP method is idempotent?', options: ['POST', 'PUT', 'Both PUT and POST', 'Neither'], answer: 1 },
    { q: 'ACID stands for:', options: ['Atomicity, Consistency, Isolation, Durability', 'Access, Control, Integrity, Data', 'Atomicity, Control, Integrity, Durability', 'Access, Consistency, Isolation, Data'], answer: 0 },
    { q: 'What is the time complexity of binary search?', options: ['O(n)', 'O(n²)', 'O(log n)', 'O(1)'], answer: 2 },
    { q: 'A process vs a thread: threads share:', options: ['CPU', 'Memory space', 'Both', 'Neither'], answer: 1 },
    { q: 'SQL stands for:', options: ['Structured Query Language', 'Standard Query Logic', 'Simple Query Layer', 'Stored Query Language'], answer: 0 },
    { q: 'Which is a NoSQL database?', options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'], answer: 2 },
    { q: 'What does DNS resolve?', options: ['IP to MAC', 'Domain to IP', 'IP to port', 'URL to path'], answer: 1 },
    { q: 'Virtual memory allows:', options: ['Faster CPU', 'More RAM than physically present', 'GPU acceleration', 'Disk compression'], answer: 1 },
    { q: 'Which design pattern is React based on?', options: ['MVC', 'Observer', 'Component/Compositional', 'Factory'], answer: 2 },
    { q: 'Big O of O(1) means:', options: ['Linear time', 'Logarithmic time', 'Constant time', 'Quadratic time'], answer: 2 },
    { q: 'What is a race condition?', options: ['Fast process', 'Concurrent access to shared data', 'Memory leak', 'Deadlock type'], answer: 1 },
    { q: 'CI/CD stands for:', options: ['Code Integration / Code Delivery', 'Continuous Integration / Continuous Delivery', 'Compiled Input / Compiled Data', 'None of the above'], answer: 1 },
    { q: 'OAuth is used for:', options: ['Encryption', 'Authorization', 'Authentication only', 'Database access'], answer: 1 },
  ],
};

function getQuestions(topic, difficulty, count) {
  const pool = QUESTION_BANK[topic] || QUESTION_BANK['default'];
  // shuffle and slice
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export default function MockTest() {
  const location = useLocation();
  const navigate = useNavigate();
  const { topic = 'Data Structures', difficulty = 'Medium', count = 10 } = location.state || {};

  const [questions] = useState(() => getQuestions(topic, difficulty, count));
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(count * 90); // 90s per question
  const [finished, setFinished] = useState(false);

  const handleFinish = useCallback(() => {
    if (finished) return;
    setFinished(true);
    const finalScore = questions.filter((q, i) => answers[i] === q.answer).length;
    navigate('/dashboard/mock-results', {
      state: { questions, answers, score: finalScore, topic, difficulty, timeTaken: count * 90 - timeLeft },
    });
  }, [finished, questions, answers, navigate, topic, difficulty, count, timeLeft]);

  useEffect(() => {
    if (timeLeft <= 0) { handleFinish(); return; }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, handleFinish]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const urgent = timeLeft < 60;

  function selectAnswer(idx) {
    setAnswers((prev) => ({ ...prev, [current]: idx }));
  }

  const answered = Object.keys(answers).length;
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="test-root">
      <Navbar />
      <div className="test-container">

        {/* Top bar */}
        <div className="test-topbar">
          <div className="test-meta">
            <span className="test-topic-tag">{topic}</span>
            <span className="test-diff-tag">{difficulty}</span>
          </div>
          <div className={`test-timer ${urgent ? 'urgent' : ''}`}>
            ⏱ {mins}:{secs}
          </div>
          <div className="test-progress-text">{answered}/{questions.length} answered</div>
        </div>

        {/* Progress bar */}
        <div className="test-progress-bar">
          <div className="test-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Question */}
        <div className="test-card">
          <div className="test-q-counter">Question {current + 1} of {questions.length}</div>
          <h2 className="test-q-text">{questions[current]?.q}</h2>

          <div className="test-options">
            {questions[current]?.options.map((opt, idx) => (
              <button
                key={idx}
                className={`test-option ${answers[current] === idx ? 'selected' : ''}`}
                onClick={() => selectAnswer(idx)}
              >
                <span className="opt-letter">{String.fromCharCode(65 + idx)}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="test-nav">
          <button
            className="nav-btn"
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
          >
            ← Previous
          </button>

          <div className="test-dot-nav">
            {questions.map((_, i) => (
              <button
                key={i}
                className={`dot-btn ${i === current ? 'dot-current' : ''} ${answers[i] !== undefined ? 'dot-answered' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button
              className="nav-btn nav-next"
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
            >
              Next →
            </button>
          ) : (
            <button className="nav-btn submit-btn" onClick={handleFinish}>
              Submit ✓
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
