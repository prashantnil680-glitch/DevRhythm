// src/app/HomePageClient.tsx

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  FiBarChart2,
  FiFeather,
  FiRefreshCw,
  FiGrid,
  FiZap,
  FiAward,
  FiCornerUpRight,
  FiLayout,
  FiShuffle,
  FiGlobe,
  FiSearch,
  FiDollarSign,
  FiGitBranch,
  FiUsers,
  FiBookOpen,
  FiLayers,
  FiTarget,
  FiCheckCircle,
  FiClock,
  FiTrendingUp,
  FiCalendar,
  FiCode,
  FiStar,
  FiArrowRight,
  FiHeart,
  FiAlertCircle,
  FiX,
} from 'react-icons/fi';
import OAuthButton from '@/shared/components/OAuthButton';
import { useSession } from '@/features/auth/hooks/useSession';
import { tokenStorage } from '@/features/auth/utils/tokenStorage';
import CustomYouTubePlayer from '@/features/video/components/CustomYouTubePlayer';
import { Avatar } from '@/shared/components/Avatar';
import apiClient from '@/shared/lib/apiClient';
import styles from './page.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const getRandomIntensity = (dayOffset: number): 0 | 1 | 2 | 3 | 4 => {
  let level = 0;
  const r = Math.random();
  if (dayOffset < 90) {
    level = r < 0.2 ? 0 : r < 0.45 ? 1 : r < 0.75 ? 2 : r < 0.93 ? 3 : 4;
  } else if (dayOffset < 180) {
    level = r < 0.35 ? 0 : r < 0.65 ? 1 : r < 0.88 ? 2 : 3;
  } else {
    level = r < 0.55 ? 0 : r < 0.82 ? 1 : 2;
  }
  return level as 0 | 1 | 2 | 3 | 4;
};

// ========== PROBLEM SECTION ==========
function ProblemSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.2 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const cycles = [
    { label: 'Motivation strikes', icon: <FiTarget size={16} />, status: 'active' },
    { label: 'Solve daily', icon: <FiBookOpen size={16} />, status: 'active' },
    { label: 'Life happens', icon: <FiAlertCircle size={16} />, status: 'active' },
    { label: 'Streak breaks', icon: <FiHeart size={16} />, status: 'active' },
    { label: 'Stop for weeks', icon: <FiX size={16} />, status: 'active' },
    { label: 'Repeat', icon: <FiRefreshCw size={16} />, status: 'repeat' },
  ];

  return (
    <section className={styles.problemSection} ref={containerRef}>
      <div className={styles.problemInner}>
        <div className={styles.problemHeader}>
          <span className={styles.problemBadge}>The Struggle</span>
          <h2 className={styles.problemTitle}>
            Every few months, the same cycle repeats.
          </h2>
        </div>

        <div className={styles.problemCycle}>
          {cycles.map((item, idx) => (
            <div key={idx} className={`${styles.cycleItem} ${styles[item.status]}`}>
              <div className={styles.cycleDot} />
              <span className={styles.cycleIcon}>{item.icon}</span>
              <span className={styles.cycleLabel}>{item.label}</span>
              {idx < cycles.length - 1 && (
                <div className={styles.cycleArrow}>→</div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.problemConclusion}>
          <p className={styles.problemText}>
            I wasn't lazy. I was missing a <strong>system</strong>.
          </p>
          <p className={styles.problemSubtext}>
            Motivation fades, but habits shouldn't. The problem wasn't my effort – it was the lack of a <strong>rhythm</strong>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ========== SPACED REPETITION SECTION ==========
function SpacedRepetitionSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.3 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const intervals = [
    { label: '1 day', days: 1 },
    { label: '3 days', days: 3 },
    { label: '6 days', days: 6 },
    { label: '14 days', days: 14 },
    { label: '30 days', days: 30 },
  ];

  // Compute dot positions dynamically for the SVG path
  const dotPositions = intervals.map((item) => {
    const x = 50 + (item.days / 30) * 600;
    // y values: first 3 at 80, then 14 at 100, 30 at 100
    let y = 80;
    if (item.days === 14 || item.days === 30) y = 100;
    return { x, y, days: item.days };
  });

  // Build the path string: start at (50, 80), then go through each dot, then to (680, 160)
  let pathD = 'M 50 80';
  dotPositions.forEach((pos) => {
    pathD += ` L ${pos.x} ${pos.y}`;
  });
  // Final point to show slight decline
  pathD += ' L 680 160';

  return (
    <section className={styles.spacedRepSection} ref={containerRef}>
      <div className={styles.spacedRepInner}>
        <div className={styles.spacedRepHeader}>
          <span className={styles.sectionBadge}>How It Works</span>
          <h2 className={styles.sectionTitle}>Spaced Repetition: The Science of Remembering</h2>
          <p className={styles.sectionSubtitle}>
            When you solve a problem, DevRhythm creates a revision schedule that reinforces your memory at optimal intervals.
          </p>
        </div>

        <div className={styles.spacedRepContent}>
          <div className={styles.spacedRepGraph}>
            <svg
              viewBox="0 0 700 300"
              preserveAspectRatio="xMidYMid meet"
              className={styles.memorySvg}
            >
              {/* Axes */}
              <line x1="50" y1="250" x2="680" y2="250" stroke="var(--border)" strokeWidth="2" />
              <line x1="50" y1="250" x2="50" y2="30" stroke="var(--border)" strokeWidth="2" />

              {/* Y-axis labels */}
              <text x="30" y="250" className={styles.axisLabel}>0%</text>
              <text x="30" y="155" className={styles.axisLabel}>50%</text>
              <text x="30" y="60" className={styles.axisLabel}>100%</text>

              {/* X-axis labels */}
              {[0, 1, 3, 6, 14, 30].map((day, i) => {
                const x = 50 + (day / 30) * 600;
                return (
                  <text key={i} x={x} y="270" className={styles.axisLabel}>
                    {day === 0 ? '0' : `${day}d`}
                  </text>
                );
              })}

              {/* Forgetting curve (without revision) */}
              <path
                d="M 50 80 Q 150 130 300 190 Q 450 230 600 250 Q 650 250 680 250"
                stroke="#d32f2f"
                strokeWidth="3"
                fill="none"
                strokeDasharray="1000"
                strokeDashoffset="1000"
                className={isVisible ? styles.forgettingCurve : ''}
              />
              <text x="560" y="200" fill="#d32f2f" fontSize="12" fontWeight="bold">
                Without revision
              </text>

              {/* Spaced repetition curve (with revision) */}
              <path
                d={pathD}
                stroke="#2e7d32"
                strokeWidth="3"
                fill="none"
                strokeDasharray="1000"
                strokeDashoffset="1000"
                className={isVisible ? styles.spacedRepetitionCurve : ''}
              />
              <text x="560" y="140" fill="#2e7d32" fontSize="12" fontWeight="bold">
                With spaced repetition
              </text>

              {/* Revision dots */}
              {dotPositions.map((pos, idx) => (
                <circle
                  key={idx}
                  cx={pos.x}
                  cy={pos.y}
                  r="6"
                  fill="#2e7d32"
                  stroke="#fff"
                  strokeWidth="2"
                  className={isVisible ? styles.revisionDot : ''}
                  style={{ animationDelay: `${1.5 + idx * 0.3}s` }}
                />
              ))}
            </svg>
          </div>

          <div className={styles.spacedRepIntervals}>
            {intervals.map((item, idx) => (
              <div key={idx} className={styles.intervalItem}>
                <div className={styles.intervalDot} />
                <span className={styles.intervalLabel}>{item.label}</span>
                <span className={styles.intervalBadge}>
                  {idx === 0 ? 'First revision' : idx === intervals.length - 1 ? 'Mastered' : 'Reinforce'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ========== PATTERN MASTERY SECTION ==========
function PatternSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.2 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const patterns = [
    { name: 'Two Pointers', icon: <FiCornerUpRight size={20} />, mastery: 85 },
    { name: 'Sliding Window', icon: <FiLayout size={20} />, mastery: 72 },
    { name: 'Dynamic Programming', icon: <FiGrid size={20} />, mastery: 58 },
    { name: 'Backtracking', icon: <FiShuffle size={20} />, mastery: 65 },
    { name: 'Graph Algorithms', icon: <FiGlobe size={20} />, mastery: 48 },
    { name: 'Binary Search', icon: <FiSearch size={20} />, mastery: 78 },
    { name: 'Greedy', icon: <FiDollarSign size={20} />, mastery: 62 },
    { name: 'Trie', icon: <FiGitBranch size={20} />, mastery: 42 },
  ];

  return (
    <section className={styles.patternSection} ref={containerRef}>
      <div className={styles.patternInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Pattern Mastery</span>
          <h2 className={styles.sectionTitle}>Master Every Coding Pattern</h2>
          <p className={styles.sectionSubtitle}>
            Track your progress across 20+ common DSA patterns. Identify strengths, improve weaknesses, and build a complete mental model.
          </p>
        </div>

        <div className={styles.patternGrid}>
          {patterns.map((pattern, idx) => (
            <div key={idx} className={styles.patternCard}>
              <div className={styles.patternIcon}>{pattern.icon}</div>
              <div className={styles.patternName}>{pattern.name}</div>
              <div className={styles.patternBar}>
                <div
                  className={styles.patternFill}
                  style={{ width: `${pattern.mastery}%` }}
                />
              </div>
              <span className={styles.patternPercent}>{pattern.mastery}%</span>
            </div>
          ))}
        </div>

        <div className={styles.patternCta}>
          <span className={styles.patternStats}>
            <FiTarget size={14} /> Track 20+ patterns · <FiStar size={14} /> 350+ questions mastered · <FiTrendingUp size={14} /> 85% retention rate
          </span>
        </div>
      </div>
    </section>
  );
}

// ========== SHEETS SECTION ==========
function SheetsSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.2 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const sheets = [
    { name: 'Interview Prep', category: 'Top 100', questions: 100 },
    { name: 'DP Practice', category: 'Dynamic Programming', questions: 45 },
    { name: 'Graph Algorithms', category: 'Advanced', questions: 60 },
  ];

  return (
    <section className={styles.sheetsSection} ref={containerRef}>
      <div className={styles.sheetsInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Sheets</span>
          <h2 className={styles.sectionTitle}>Curated Problem Lists</h2>
          <p className={styles.sectionSubtitle}>
            Create, share, and track progress on curated problem sheets. Start your own or follow existing ones.
          </p>
        </div>

        <div className={styles.sheetsGrid}>
          {sheets.map((sheet, idx) => (
            <div key={idx} className={styles.sheetCard}>
              <div className={styles.sheetHeader}>
                <span className={styles.sheetCategory}>{sheet.category}</span>
                <span className={styles.sheetCount}>{sheet.questions} questions</span>
              </div>
              <h3 className={styles.sheetName}>{sheet.name}</h3>
              <p className={styles.sheetCreator}>Community curated</p>
              <div className={styles.sheetProgress}>
                <div className={styles.sheetProgressBar}>
                  <div className={styles.sheetProgressFill} style={{ width: `${Math.random() * 30 + 10}%` }} />
                </div>
                <span className={styles.sheetProgressLabel}>Progress</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.sheetsCta}>
          <span className={styles.sheetsStats}>
            <FiBookOpen size={14} /> Create your own sheet · <FiUsers size={14} /> Track with others · <FiBarChart2 size={14} /> Measure progress
          </span>
        </div>
      </div>
    </section>
  );
}

// ========== REVISION TIMELINE SECTION ==========
function RevisionSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.2 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const revisions = [
    { label: 'Day 1', status: 'completed', desc: 'Solved' },
    { label: 'Day 3', status: 'completed', desc: 'Revised' },
    { label: 'Day 6', status: 'pending', desc: 'Due today' },
    { label: 'Day 14', status: 'upcoming', desc: 'In 8 days' },
    { label: 'Day 30', status: 'upcoming', desc: 'In 24 days' },
  ];

  return (
    <section className={styles.revisionSection} ref={containerRef}>
      <div className={styles.revisionInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Revision Rhythm</span>
          <h2 className={styles.sectionTitle}>Your Personal Revision Schedule</h2>
          <p className={styles.sectionSubtitle}>
            DevRhythm automatically schedules your revisions so you never forget what you've learned.
          </p>
        </div>

        <div className={styles.revisionTimeline}>
          <div className={styles.revisionTrack}>
            {revisions.map((item, idx) => (
              <div key={idx} className={`${styles.revisionItem} ${styles[item.status]}`}>
                <div className={styles.revisionDot} />
                <span className={styles.revisionLabel}>{item.label}</span>
                <span className={styles.revisionDesc}>{item.desc}</span>
                {idx < revisions.length - 1 && (
                  <div className={`${styles.revisionConnector} ${styles[item.status]}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.revisionStats}>
          <div className={styles.revisionStat}>
            <span className={styles.revisionStatValue}>0</span>
            <span className={styles.revisionStatLabel}>Pending today</span>
          </div>
          <div className={styles.revisionStat}>
            <span className={styles.revisionStatValue}>3</span>
            <span className={styles.revisionStatLabel}>Upcoming</span>
          </div>
          <div className={styles.revisionStat}>
            <span className={styles.revisionStatValue}>12</span>
            <span className={styles.revisionStatLabel}>Completed</span>
          </div>
          <div className={styles.revisionStat}>
            <span className={styles.revisionStatValue}>85%</span>
            <span className={styles.revisionStatLabel}>Retention rate</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ========== COMMUNITY SECTION ==========
function CommunitySection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.animate);
          }
        });
      },
      { threshold: 0.2 }
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  const avatars = [
    '/rhythmer1.webp',
    '/rhythmer2.webp',
    '/rhythmer3.webp',
    '/rhythmer4.webp',
    '/rhythmer5.webp',
    '/rhythmer6.webp',
  ];

  return (
    <section className={styles.communitySection} ref={containerRef}>
      <div className={styles.communityInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>Community</span>
          <h2 className={styles.sectionTitle}>Build Your Rhythm Together</h2>
          <p className={styles.sectionSubtitle}>
            Join <strong>7 early adopters</strong> who are already building lasting coding habits with DevRhythm.
            Be one of the first to grow your rhythm.
          </p>
        </div>

        <div className={styles.communityAvatars}>
          {avatars.map((src, idx) => (
            <div key={idx} className={styles.communityAvatar}>
              <Avatar src={src} name="Developer" size="md" ring />
            </div>
          ))}
          <div className={styles.communityCount}>
            <span className={styles.communityCountValue}>7+</span>
            <span className={styles.communityCountLabel}>Members</span>
          </div>
        </div>

        <div className={styles.communityMetrics}>
          <div className={styles.communityMetric}>
            <span className={styles.communityMetricValue}>100+</span>
            <span className={styles.communityMetricLabel}>Problems mastered</span>
          </div>
          <div className={styles.communityMetric}>
            <span className={styles.communityMetricValue}>200+</span>
            <span className={styles.communityMetricLabel}>Revisions completed</span>
          </div>
          <div className={styles.communityMetric}>
            <span className={styles.communityMetricValue}>5+</span>
            <span className={styles.communityMetricLabel}>Community sheets</span>
          </div>
        </div>

        <div className={styles.communityJoin}>
          <p className={styles.communityJoinText}>
            <FiFeather size={14} /> This is the beginning. Your contribution will shape the community.
          </p>
          <div className={styles.communityJoinCta}>
            <OAuthButton provider="google" variant="primary" size="sm" showIcon>
              Join the community
            </OAuthButton>
          </div>
        </div>
      </div>
    </section>
  );
}

// ========== MAIN HOMEPAGE CONTENT ==========
function HomePageContent() {
  const [showLoader, setShowLoader] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const [footnote, setFootnote] = useState('');

  const heroHeadlineRef = useRef<HTMLHeadingElement>(null);
  const heatmapCardRef = useRef<HTMLDivElement>(null);
  const travelerDotRef = useRef<HTMLDivElement>(null);
  const pathNodesRef = useRef<(HTMLDivElement | null)[]>([]);
  const stageCardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const parallaxLayersRef = useRef<(HTMLDivElement | null)[]>([]);
  const ticking = useRef(false);
  const targetTop = useRef(4);
  const currentTop = useRef(4);
  const animationFrame = useRef<number | undefined>(undefined);

  // Heatmap generation
  useEffect(() => {
    const grid = document.getElementById('yearHeatmapGrid');
    if (!grid) return;
    const totalDays = 365;
    const weeks = Math.ceil(totalDays / 7);
    const totalCells = weeks * 7;
    const intensities = new Array(totalCells).fill(0);
    const today = new Date();

    for (let i = 0; i < totalDays; i++) {
      const dayOffset = totalDays - 1 - i;
      const d = new Date(today);
      d.setDate(d.getDate() - dayOffset);
      const dow = d.getDay();
      let level = getRandomIntensity(dayOffset);
      if (dow === 0 || dow === 6) level = Math.max(0, level - 1) as 0 | 1 | 2 | 3 | 4;
      const col = Math.floor(i / 7);
      const row = (6 - dow) % 7;
      const idx = col * 7 + row;
      if (idx < totalCells) intensities[idx] = level;
    }

    grid.innerHTML = '';
    for (let i = 0; i < totalCells; i++) {
      const cell = document.createElement('div');
      cell.className = styles.heatmapYearCell;
      cell.setAttribute('data-level', String(intensities[i]));
      grid.appendChild(cell);
    }
  }, []);

  // Chart data
  useEffect(() => {
    try {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const curr = new Date().getMonth();
      const labels = Array.from({ length: 12 }, (_, i) => months[(curr - 11 + i + 12) % 12]);
      const userData = [12, 14, 11, 16, 13, 18, 15, 20, 17, 22, 19, 24];
      const avg = [10, 11, 10, 12, 11, 13, 11, 14, 12, 14, 12, 15];
      setChartData({
        labels,
        datasets: [
          {
            label: 'You',
            data: userData,
            borderColor: '#3d8b52',
            backgroundColor: 'rgba(61,139,82,0.06)',
            borderWidth: 3,
            pointRadius: 4,
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Average',
            data: avg,
            borderColor: '#C4A265',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 3,
            tension: 0.4,
          },
        ],
      });
      setFootnote(`▲ You completed <strong>${userData[11]}</strong> goals — ${userData[11] - avg[11]} above average`);
    } catch (err) {
      console.error('[HomePageContent] Chart error:', err);
    }
  }, []);

  // Loader
  useEffect(() => {
    const hideLoader = () => setShowLoader(false);
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
      return () => window.removeEventListener('load', hideLoader);
    }
  }, []);

  // Parallax layers
  useEffect(() => {
    const layers = Array.from(document.querySelectorAll(`.${styles.parallaxLayer}`)) as HTMLDivElement[];
    parallaxLayersRef.current = layers;
  }, []);

  const updateParallax = useCallback(() => {
    const scrollY = window.scrollY;
    parallaxLayersRef.current.forEach((layer) => {
      const speedAttr = layer?.getAttribute('data-speed');
      if (!speedAttr) return;
      const speed = parseFloat(speedAttr);
      const xDrift = Math.sin(scrollY * 0.0018) * 35 * speed;
      if (layer) {
        layer.style.transform = `translate3d(${xDrift}px, ${scrollY * speed}px, 0) scale(${1 + scrollY * 0.00008})`;
      }
    });

    if (heroHeadlineRef.current) {
      const rect = heroHeadlineRef.current.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - window.innerHeight * 0.4);
      heroHeadlineRef.current.style.transform = `scale(${Math.max(0.85, 1 - dist * 0.00055)})`;
      heroHeadlineRef.current.style.opacity = `${Math.max(0.45, 1 - dist * 0.0018)}`;
    }

    if (heatmapCardRef.current) {
      const rect = heatmapCardRef.current.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - window.innerHeight * 0.5);
      heatmapCardRef.current.style.transform = `scale(${Math.min(1.04, 1 + Math.max(0, (window.innerHeight * 0.5 - dist) * 0.00038))})`;
    }
    ticking.current = false;
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(updateParallax);
        ticking.current = true;
        updateJourney();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateParallax();
    return () => window.removeEventListener('scroll', onScroll);
  }, [updateParallax]);

  // Reveal animations
  useEffect(() => {
    const revealElements = document.querySelectorAll(`.${styles.reveal}`);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add(styles.visible);
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -40px 0px' }
    );
    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const updateJourney = useCallback(() => {
    const section = document.getElementById('journeySection');
    if (!section || !travelerDotRef.current) return;
    const rect = section.getBoundingClientRect();
    const sectionTop = rect.top + window.scrollY;
    const totalHeight = section.offsetHeight;
    const scrollY = window.scrollY;
    const start = sectionTop - window.innerHeight * 0.35;
    const end = sectionTop + totalHeight - window.innerHeight * 0.45;
    const range = end - start;
    if (range <= 0) return;
    const progress = Math.max(0, Math.min(1, (scrollY - start) / range));
    targetTop.current = 4 + (84 - 4) * progress;
    const activeIdx = Math.min(Math.floor(progress * 5), 4);
    pathNodesRef.current.forEach((node, i) => {
      if (node) node.classList.toggle(styles.active, i <= activeIdx);
    });
    stageCardsRef.current.forEach((card) => {
      if (card) {
        const r = card.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.78) card.classList.add(styles.revealed);
      }
    });
  }, []);

  useEffect(() => {
    const onScroll = () => updateJourney();
    window.addEventListener('scroll', onScroll);
    updateJourney();
    return () => window.removeEventListener('scroll', onScroll);
  }, [updateJourney]);

  useEffect(() => {
    const animate = () => {
      currentTop.current += (targetTop.current - currentTop.current) * 0.07;
      if (travelerDotRef.current) {
        travelerDotRef.current.style.top = `${currentTop.current}%`;
      }
      animationFrame.current = requestAnimationFrame(animate);
    };
    animationFrame.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return (
    <>
      {/* Schema */}
      <Script
        id="schema-website"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'DevRhythm',
            url: 'https://www.devrhythm.space',
            description:
              'Rhythm‑based coding practice platform with spaced repetition, heatmaps, and goal tracking.',
            creator: { '@id': 'https://www.devrhythm.space/about/me#person' },
            author: { '@id': 'https://www.devrhythm.space/about/me#person' },
          }),
        }}
      />

      {showLoader && (
        <div className={styles.loadingScreen}>
          <div className={styles.loadingLogo}>
            Dev<span>Rhythm</span>
          </div>
          <div className={styles.rhythmPulse}>
            <div className={styles.pulseDot}></div>
            <div className={styles.pulseDot}></div>
            <div className={styles.pulseDot}></div>
            <div className={styles.pulseDot}></div>
            <div className={styles.pulseDot}></div>
          </div>
        </div>
      )}

      <div className={styles.parallaxContainer} aria-hidden="true">
        <div className={styles.parallaxLayer} data-speed="0.05">
          <div className={`${styles.paraShape} ${styles.xl}`} style={{ top: '2%', left: '3%' }}></div>
          <div className={`${styles.paraShape} ${styles.lg} ${styles.warm}`} style={{ top: '30%', right: '5%' }}></div>
          <div className={`${styles.paraShape} ${styles.md}`} style={{ bottom: '18%', left: '7%' }}></div>
        </div>
        <div className={styles.parallaxLayer} data-speed="0.12">
          <div className={`${styles.paraShape} ${styles.lg}`} style={{ top: '10%', right: '16%' }}></div>
          <div className={`${styles.paraShape} ${styles.xl} ${styles.warm}`} style={{ bottom: '22%', right: '8%' }}></div>
          <div className={`${styles.paraShape} ${styles.sm}`} style={{ top: '50%', left: '14%' }}></div>
        </div>
        <div className={styles.parallaxLayer} data-speed="0.2">
          <div className={`${styles.paraShape} ${styles.sm} ${styles.warm}`} style={{ top: '38%', left: '65%' }}></div>
          <div className={`${styles.paraShape} ${styles.md}`} style={{ bottom: '35%', left: '40%' }}></div>
        </div>
        <div className={styles.parallaxLayer} data-speed="0.3">
          <div className={`${styles.paraShape} ${styles.sm}`} style={{ top: '20%', right: '22%' }}></div>
          <div className={`${styles.paraShape} ${styles.md} ${styles.warm}`} style={{ top: '70%', left: '8%' }}></div>
          <div className={`${styles.paraShape} ${styles.sm}`} style={{ bottom: '10%', right: '30%' }}></div>
        </div>
      </div>

      <main className={styles.mainContent}>
        {/* HERO */}
        <section className={`${styles.heroSection} ${styles.sectionContainer} ${styles.reveal}`}>
          <p className={styles.heroEyebrow}>The rhythm‑based practice platform</p>
          <h1 className={`${styles.heroHeadline} ${styles.cutout}`} ref={heroHeadlineRef}>
            <span className={styles.hl1}>Dev</span><span className={styles.hl2}>Rhythm</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Code with purpose. Revise with rhythm.<br />Master every pattern — one day at a time.
          </p>
          <div className={styles.heroCtaRow}>
            <OAuthButton provider="google" variant="primary" size="md" showIcon>
              Sign in with Google
            </OAuthButton>
            <OAuthButton provider="github" variant="secondary" size="md" showIcon>
              Sign in with GitHub
            </OAuthButton>
          </div>

          <div className={`${styles.heatmapCard} ${styles.reveal}`} ref={heatmapCardRef}>
            <div className={styles.heatmapHeader}>
              <span className={styles.heatmapTitle}>
                <FiBarChart2 size={16} style={{ marginRight: '0.4rem' }} />
                Your 365‑day activity heatmap
              </span>
              <span className={styles.heatmapStreak}>
                <span className={styles.heatmapStreakDot}></span> 213‑day streak
              </span>
            </div>
            <div className={styles.heatmapYearWrap}>
              <div className={styles.heatmapYearGrid} id="yearHeatmapGrid"></div>
            </div>
            <div className={styles.heatmapLegend}>
              Less <span data-level="0"></span><span data-level="1"></span><span data-level="2"></span>
              <span data-level="3"></span><span data-level="4"></span> More
            </div>
            <p className={styles.heatmapCaption}>
              <FiTrendingUp size={14} style={{ marginRight: '0.3rem' }} />
              350+ problems mastered over the past year
            </p>
          </div>
        </section>

        {/* PROBLEM SECTION */}
        <ProblemSection />

        {/* SPACED REPETITION SECTION */}
        <SpacedRepetitionSection />

        {/* PATTERN MASTERY SECTION */}
        <PatternSection />

        {/* SHEETS SECTION */}
        <SheetsSection />

        {/* REVISION SECTION */}
        <RevisionSection />

        {/* VIDEO DEMO */}
        <section className={`${styles.sectionContainer} ${styles.reveal}`} style={{ marginTop: '2rem', marginBottom: '2rem' }}>
          <div className={styles.videoSectionHeader}>
            <h2 className={styles.journeyHeading}>See DevRhythm in action</h2>
            <p className={styles.heroSubtitle}>Watch how rhythm‑based practice transforms your coding consistency.</p>
          </div>
          <CustomYouTubePlayer
            videoId="euv8JzyIrMI"
            thumbnailSrc="images/logos/main-logo.png"
            title="DevRhythm Demo – Build your coding rhythm"
          />
        </section>

        {/* JOURNEY SECTION */}
        <section className={`${styles.journeySection} ${styles.reveal}`} id="journeySection">
          <div className={`${styles.journeyHeader} ${styles.sectionContainer}`}>
            <p className={styles.journeyEyebrow}>The path to mastery</p>
            <h2 className={`${styles.journeyHeading} ${styles.cutoutLight}`}>
              Every coder walks a path.<br />Ours is built on <em>rhythm</em>.
            </h2>
          </div>
          <div className={styles.journeyLayout}>
            <div className={styles.pathColumn}>
              <div className={styles.pathVisual}>
                <div className={styles.pathGlowPulse}></div>
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className={styles.pathNode}
                    ref={(el) => { pathNodesRef.current[idx] = el; }}
                    style={{ top: `${4 + 20 * idx}%` }}
                  ></div>
                ))}
                <div className={styles.travelerDot} ref={travelerDotRef} style={{ top: '4%' }}></div>
              </div>
            </div>
            <div className={styles.stagesColumn}>
              {[
                { title: 'First steps', icon: <FiFeather size={18} />, desc: 'You begin solving problems — from LeetCode\'s daily challenge or your own list. The platform quietly tracks every attempt, every pattern, every insight.' },
                { title: 'Finding rhythm', icon: <FiRefreshCw size={18} />, desc: 'Within weeks, your heatmap shows consistent green. Spaced repetition activates — reminders arrive precisely when you\'re about to forget.' },
                { title: 'Pattern recognition', icon: <FiGrid size={18} />, desc: 'You stop seeing isolated problems and start recognizing <em>patterns</em> — Two Pointers, Sliding Window, DP. Confidence climbs from 1.2 to 3.8.' },
                { title: 'Deep mastery', icon: <FiZap size={18} />, desc: 'Months in, your revision schedule runs on autopilot. Overdue reviews flagged. Code submissions auto‑complete revisions. You\'re retaining at 85%+.' },
                { title: 'One year later', icon: <FiAward size={18} />, desc: '350+ problems mastered. 18 patterns at confidence 4+. A 200+ day streak. You\'ve built demonstrable coding mastery backed by data.' },
              ].map((stage, idx) => (
                <div key={idx} className={styles.stageCard} ref={(el) => { stageCardsRef.current[idx] = el; }}>
                  <h3>
                    {stage.icon}
                    {stage.title}
                  </h3>
                  <p dangerouslySetInnerHTML={{ __html: stage.desc }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMMUNITY SECTION */}
        <CommunitySection />

        {/* GROWTH CHART */}
        <section className={`${styles.trendsSection} ${styles.reveal} ${styles.sectionContainer}`}>
          <div className={styles.trendsCard}>
            <h3>
              <FiTrendingUp size={20} style={{ marginRight: '0.5rem' }} />
              Your growth trajectory
            </h3>
            <p className={styles.trendsSubtitle}>Monthly goals completed — you vs. average user</p>
            <div className={styles.chartWrap} suppressHydrationWarning>
              {chartData ? (
                <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
              ) : (
                <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Loading chart...
                </div>
              )}
            </div>
            <p className={styles.chartNote} dangerouslySetInnerHTML={{ __html: footnote }} />
          </div>
        </section>

        {/* COMPARISON */}
        <section className={`${styles.comparisonSection} ${styles.reveal} ${styles.sectionContainer}`}>
          <h2 className={`${styles.comparisonHeading} ${styles.cutoutLight}`}>Where will you stand after one year?</h2>
          <p className={styles.comparisonSubtitle}>
            Based on real data from consistent DevRhythm users vs. unstructured practice.
          </p>
          <div className={styles.comparisonCards}>
            <div className={styles.compCard}>
              <div className={styles.compLabel}>Without rhythm</div>
              <div className={styles.compValue}>~180</div>
              <div className={styles.compDetail}>problems solved<br />~40% retention</div>
            </div>
            <div className={`${styles.compCard} ${styles.alt}`}>
              <div className={styles.compLabel}>With DevRhythm</div>
              <div className={`${styles.compValue} ${styles.highlight}`}>350+</div>
              <div className={styles.compDetail}>
                problems <strong>mastered</strong><br />85%+ retention
              </div>
              <span className={styles.compBadge}>✦ Realistic &amp; achievable</span>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={`${styles.ctaSection} ${styles.reveal} ${styles.sectionContainer}`}>
          <h2 className={styles.cutoutLight}>Ready to find your rhythm?</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
            Sign in with Google or GitHub — your progress starts in seconds.
          </p>
          <div className={styles.heroCtaRow}>
            <OAuthButton provider="google" variant="primary" size="md" showIcon>
              Sign in with Google
            </OAuthButton>
            <OAuthButton provider="github" variant="secondary" size="md" showIcon>
              Sign in with GitHub
            </OAuthButton>
          </div>
        </section>

        <div className={styles.creatorCredit}>
          <p>
            Created with ❤️ by <strong>Anupam Debnath</strong> ·{' '}
            <a href="/about/me" target="_blank" rel="noopener noreferrer">
              Learn more
            </a>
          </p>
        </div>
      </main>
    </>
  );
}

export default function HomePageClient() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useSession();
  const redirectTriggered = useRef(false);

  useEffect(() => {
    if (!authLoading && user && !redirectTriggered.current) {
      redirectTriggered.current = true;
      router.replace('/dashboard');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && !user && window.location.pathname === '/') {
      tokenStorage.clearTokens();
    }
  }, [authLoading, user]);

  if (authLoading) return null;
  if (!user) return <HomePageContent />;
  return null;
}