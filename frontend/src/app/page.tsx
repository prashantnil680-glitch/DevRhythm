'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Head from 'next/head';
import Script from 'next/script';
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
import OAuthButton from '@/shared/components/OAuthButton';
import { useSession } from '@/features/auth/hooks/useSession';
import { tokenStorage } from '@/features/auth/utils/tokenStorage';
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

  // Loader: hide when document is ready
  useEffect(() => {
    const hideLoader = () => setShowLoader(false);
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
      return () => window.removeEventListener('load', hideLoader);
    }
  }, []);

  // Parallax layers collection
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
      <Head>
        <meta name="author" content="Anupam Debnath" />
        <link rel="author" href="/about/me" />
      </Head>

      {/* WebSite Schema referencing the Person @id */}
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
              <span className={styles.heatmapTitle}>📊 Your 365‑day activity heatmap</span>
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
            <p className={styles.heatmapCaption}>▲ 350+ problems mastered over the past year</p>
          </div>
        </section>

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
                { title: '🌱 First steps', desc: 'You begin solving problems — from LeetCode\'s daily challenge or your own list. The platform quietly tracks every attempt, every pattern, every insight.' },
                { title: '🔄 Finding rhythm', desc: 'Within weeks, your heatmap shows consistent green. Spaced repetition activates — reminders arrive precisely when you\'re about to forget.' },
                { title: '🧩 Pattern recognition', desc: 'You stop seeing isolated problems and start recognizing <em>patterns</em> — Two Pointers, Sliding Window, DP. Confidence climbs from 1.2 to 3.8.' },
                { title: '⚡ Deep mastery', desc: 'Months in, your revision schedule runs on autopilot. Overdue reviews flagged. Code submissions auto‑complete revisions. You\'re retaining at 85%+.' },
                { title: '🏔️ One year later', desc: '350+ problems mastered. 18 patterns at confidence 4+. A 200+ day streak. You\'ve built demonstrable coding mastery backed by data.' },
              ].map((stage, idx) => (
                <div key={idx} className={styles.stageCard} ref={(el) => { stageCardsRef.current[idx] = el; }}>
                  <h3>{stage.title}</h3>
                  <p dangerouslySetInnerHTML={{ __html: stage.desc }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.trendsSection} ${styles.reveal} ${styles.sectionContainer}`}>
          <div className={styles.trendsCard}>
            <h3>📈 Your growth trajectory</h3>
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

        {/* Visible author credit */}
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

export default function HomePage() {
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