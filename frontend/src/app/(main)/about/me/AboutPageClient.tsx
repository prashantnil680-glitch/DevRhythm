'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  FiHeart,
  FiTrendingUp,
  FiRepeat,
  FiTarget,
  FiCode,
  FiGithub,
  FiLinkedin,
  FiAward,
  FiCalendar,
  FiArrowRight,
  FiCompass,
  FiExternalLink,
  FiGrid,
} from 'react-icons/fi';
import Button from '@/shared/components/Button';
import { Avatar } from '@/shared/components/Avatar';
import styles from './page.module.css';

// Memory Retention Comparison – animated SVG
function MemoryComparison() {
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
    let y = 80;
    if (item.days === 14 || item.days === 30) y = 100;
    return { x, y, days: item.days };
  });

  let pathD = 'M 50 80';
  dotPositions.forEach((pos) => {
    pathD += ` L ${pos.x} ${pos.y}`;
  });
  pathD += ' L 680 160';

  return (
    <div className={styles.memoryWrapper} ref={containerRef}>
      <div className={styles.memoryGraph}>
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

          {/* Forgetting curve */}
          <path
            d="M 50 80 Q 150 130 300 190 Q 450 230 600 250 Q 650 250 680 250"
            stroke="#d32f2f"
            strokeWidth="3"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            className={styles.forgettingCurve}
          />
          <text x="560" y="200" fill="#d32f2f" fontSize="12" fontWeight="bold">
            Without revision
          </text>

          {/* Spaced repetition curve */}
          <path
            d={pathD}
            stroke="#2e7d32"
            strokeWidth="3"
            fill="none"
            strokeDasharray="1000"
            strokeDashoffset="1000"
            className={styles.spacedRepetitionCurve}
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
              className={styles.revisionDot}
              style={{ animationDelay: `${1.5 + idx * 0.3}s` }}
            />
          ))}
        </svg>
      </div>
      <p className={styles.memoryCaption}>
        Without revision, memory fades quickly. With spaced repetition, each revision strengthens the memory,
        keeping it above 80% long‑term.
      </p>
    </div>
  );
}

export default function AboutPageClient() {
  const projects = [
    {
      id: 1,
      title: 'Sortopia',
      description: 'A algorithm visualizer for sorting algorithms',
      image: '/images/projects/sortopia-thumb.png',
      url: 'https://sortopia.devrhythm.space',
    },
    {
      id: 2,
      title: 'Apna Time',
      description: 'A modern advanced Todo list application',
      image: '/images/projects/todo-thumb.png',
      url: 'https://donow.devrhythm.space',
    },
    {
      id: 3,
      title: 'Kolpata',
      description: 'A frontend visual design of a restaurant landing page',
      image: '/images/projects/kolapata-thumb.png',
      url: 'https://kolapata.vercel.app/',
    },
  ];

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <FiCompass />
        </div>
        <h1 className={styles.heroTitle}>The story behind DevRhythm</h1>
        <p className={styles.heroSubtitle}>
          Why I built a platform to fix my own broken DSA practice.
        </p>
        <div className={styles.heroMeta}>
          <FiCalendar size={14} />
          <span>Started building in 2025 · Refining ever since</span>
        </div>
      </div>

      <hr className={styles.divider} />

      {/* The Problem */}
      <section className={styles.section}>
        <h2>
          <FiHeart className={styles.sectionIcon} /> The Problem
        </h2>
        <p>
          Every few months, I'd get motivated to master Data Structures &amp; Algorithms. I'd solve daily,
          feel progress, and think, <em>"This time, I'll do it."</em>
        </p>
        <p>
          Then life would happen. A difficult problem would take too long. A busy week would break the streak.
          And just like that, I'd stop – sometimes for weeks, sometimes months.
        </p>
        <p>
          I wasn't lazy. I was missing a <strong>system</strong>.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* The Realisation */}
      <section className={styles.section}>
        <h2>
          <FiTrendingUp className={styles.sectionIcon} /> The Realisation
        </h2>
        <blockquote className={styles.pullQuote}>
          "Motivation fades, but habits shouldn't. The problem wasn't my effort – it was the lack of a rhythm."
        </blockquote>
        <p>
          I realised that spaced repetition – the same technique that helps you remember vocabulary,
          names, and facts – could be applied to coding problems. Solve a problem, then revise it
          at carefully chosen intervals.
        </p>
        <p>
          That's how the core idea of DevRhythm was born: <strong>practice with rhythm</strong>.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* How It Works – Memory Comparison */}
      <section className={styles.section}>
        <h2>
          <FiRepeat className={styles.sectionIcon} /> How It Works
        </h2>
        <p>
          When you solve a problem, DevRhythm creates a revision schedule. The graph below shows
          how spaced repetition keeps knowledge fresh:
        </p>
        <MemoryComparison />
        <p>
          Each revision reinforces the underlying concept – not just the solution.
          Over time, patterns become second nature.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* What DevRhythm Actually Does */}
      <section className={styles.section}>
        <h2>
          <FiTarget className={styles.sectionIcon} /> What DevRhythm Actually Does
        </h2>
        <p>
          DevRhythm isn't another problem tracker. It's a system designed to help you move
          from short‑term memory to lasting mastery.
        </p>
        <ul>
          <li>
            <strong>Spaced Repetition</strong> – Automatically schedules revisions at optimal
            intervals (1 day, 3 days, 6 days, 14 days, 30 days).
          </li>
          <li>
            <strong>Heatmaps</strong> – Visualises your daily consistency, not just your solves.
          </li>
          <li>
            <strong>Revision Schedules</strong> – Shows you exactly what to revise and when.
          </li>
          <li>
            <strong>Goal Tracking</strong> – Set daily, weekly, or planned goals with specific questions.
          </li>
          <li>
            <strong>Sheets</strong> – Curated lists of problems you can create, share, and track with others.
          </li>
          <li>
            <strong>Code Runner</strong> – Write and test Python and C++ code directly in the browser.
          </li>
        </ul>
      </section>

      <hr className={styles.divider} />

      {/* What's Been Built So Far */}
      <section className={styles.section}>
        <h2>
          <FiAward className={styles.sectionIcon} /> What's Been Built So Far
        </h2>
        <ul>
          <li>✅ Full authentication with Google and GitHub</li>
          <li>✅ Question bank with search, filters, and pagination</li>
          <li>✅ Revision system with automatic scheduling</li>
          <li>✅ Heatmap and activity tracking</li>
          <li>✅ Goal setting (daily, weekly, planned)</li>
          <li>✅ Code runner for Python and C++</li>
          <li>✅ Sheets – curated problem lists</li>
          <li>✅ Dashboard with progress overview</li>
          <li>✅ Notifications system</li>
        </ul>
      </section>

      <hr className={styles.divider} />

      {/* A Note on What's Coming */}
      <section className={styles.section}>
        <h2>
          <FiCompass className={styles.sectionIcon} /> A Note on What's Coming
        </h2>
        <p>
          DevRhythm is a work in progress. Features like study groups, shareable progress links,
          and user settings are on the roadmap.
        </p>
        <p>
          I'm building this in the open – feedback, bug reports, and feature suggestions are always welcome.
          The best way to reach me is through <a href="https://github.com/anupam6335/DevRhythm/issues" target="_blank" rel="noopener noreferrer" className={styles.inlineLink}>GitHub Issues</a>.
        </p>
      </section>

      <hr className={styles.divider} />

      {/* Who I Am – with Avatar component */}
      <section className={styles.section}>
        <h2>Who I Am</h2>
        <div className={styles.bioCard}>
          <div className={styles.bioAvatar}>
            <Avatar
              src="/devrhythm-maker.jpg"
              name="Anupam Debnath"
              size="lg"
              className={styles.avatar}
              ring
            />
          </div>
          <div className={styles.bioContent}>
            <p className={styles.bioName}>Anupam Debnath</p>
            <p className={styles.bioRole}>
              Web Developer · 2+ years of experience · Based in India
            </p>
            <p className={styles.bioDescription}>
              I'm a self-taught developer who loves building tools that solve real problems.
              After years of starting and stopping my DSA practice, I decided to build a system
              that would help me stay consistent – and help others do the same.
            </p>
            <p className={styles.bioDescription}>
              When I'm not coding, I'm probably reading about new technologies, tinkering with side projects,
              or trying to convince myself that I don't need another coffee.
            </p>
            <div className={styles.bioLinks}>
              <a
                href="https://github.com/anupam6335"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bioLink}
                aria-label="GitHub"
              >
                <FiGithub /> GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/anupamdebnath6335/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bioLink}
                aria-label="LinkedIn"
              >
                <FiLinkedin /> LinkedIn
              </a>
              <a
                href="https://leetcode.com/u/anupam_nlogn/"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.bioLink}
                aria-label="LeetCode"
              >
                <FiCode /> LeetCode
              </a>
            </div>
          </div>
        </div>
      </section>

      <hr className={styles.divider} />

      {/* Other Projects */}
      <section className={styles.section}>
        <h2>
          <FiGrid className={styles.sectionIcon} /> Other Projects
        </h2>
        <div className={styles.projectsGrid}>
          {projects.map((project) => (
            <a
              key={project.id}
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.projectCardLink}
            >
              <div className={styles.projectCard}>
                <div className={styles.projectImageWrapper}>
                  <Image
                    src={project.image}
                    alt={project.title}
                    width={400}
                    height={200}
                    className={styles.projectImage}
                  />
                </div>
                <div className={styles.projectInfo}>
                  <h3 className={styles.projectTitle}>{project.title}</h3>
                  <p className={styles.projectDescription}>{project.description}</p>
                  <span className={styles.projectLink}>
                    View Project <FiExternalLink />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <hr className={styles.divider} />

      {/* CTA */}
      <div className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Ready to build a sustainable practice?</h2>
        <p className={styles.ctaText}>
          Start solving problems and let the rhythm take over.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/questions">
            Start solving <FiArrowRight className={styles.ctaIcon} />
          </Link>
        </Button>
      </div>
    </div>
  );
}