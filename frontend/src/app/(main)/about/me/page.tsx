'use client'
import React from 'react';
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
  FiExternalLink,
  FiAward,
  FiZap,
  FiDatabase,
  FiUser,
} from 'react-icons/fi';
import Card from '@/shared/components/Card';
import Breadcrumb from '@/shared/components/Breadcrumb';
import { Avatar } from '@/shared/components/Avatar';
import styles from './page.module.css';

export const Metadata = {
  title: 'About · DevRhythm',
  description: 'The story behind DevRhythm – building habits, not just solving problems.',
};

const breadcrumbItems = [
  { label: 'Home', href: '/' },
  { label: 'About Me' },
];

// Example projects data – you will replace with your own
const projectsData = [
  {
    id: 1,
    title: 'DevRhythm',
    description: 'DSA habit platform with spaced repetition, heatmaps, and revision schedules.',
    image: '/images/projects/devrhythm-thumb.png',
    url: 'https://devrhythm.vercel.app',
  },
  {
    id: 2,
    title: 'Sortopia',
    description: 'a algorithm visualizer',
    image: '/images/projects/sortopia-thumb.png',
    url: 'https://sortopia.vercel.app/',
  },
  {
    id: 3,
    title: 'Apna Time',
    description: 'A Moden Adv Todo List Application',
    image: '/images/projects/todo-thumb.png',
    url: 'https://donow.vercel.app/',
  },
  {
    id: 4,
    title: 'Kolpata',
    description: 'A Frontend visual design of a restrurent landing page',
    image: '/images/projects/kolapata-thumb.png',
    url: 'https://kolapata.vercel.app/',
  },
];

export default function AboutPage() {
  return (
    <div className={styles.container}>
      <Breadcrumb items={breadcrumbItems} />

      {/* Hero Section */}
      <Card className={styles.heroCard}>
        <div className={styles.heroGrid}>
          <div className={styles.avatarWrapper}>
            <Avatar
              src="/devrhythm-maker.jpg"
              name="Anupam Debnath"
              size="xl"
              ring
              className={styles.profileAvatar}
            />
          </div>
          <div className={styles.intro}>
            <h1 className={styles.name}>Anupam Debnath</h1>
            <p className={styles.role}>
              Web Developer <span className={styles.dot}>•</span> 25 Yrs old
            </p>
            <p className={styles.detail}>2+ years experience · B.Tech in CSE</p>
            <p className={styles.bio}>
              Building tools that turn short‑term motivation into lasting habits.
            </p>
          </div>
        </div>
      </Card>

      {/* Emotional Story */}
      <Card className={styles.storyCard}>
        <div className={styles.sectionHeader}>
          <FiHeart className={styles.sectionIcon} />
          <h2>The Story Behind DevRhythm</h2>
        </div>
        <div className={styles.storyContent}>
          <p>
            Every time I started solving DSA problems, I'd be highly motivated for a month,
            maybe a month and a half. I'd solve daily, feel progress, and think, 
            <em> "This time, I'll master it."</em>
          </p>
          <p>
            Then it would happen. Life gets busy. A difficult problem takes too long. 
            The streak breaks. And just like that, I'd stop – for weeks, sometimes months.
          </p>
          <p>
            I wasn't lazy. I was missing a <strong>system</strong>. Motivation fades, 
            but habits shouldn't. The problem wasn't my effort – it was the lack of a rhythm.
          </p>
          <p>
            That's why I built <strong>DevRhythm</strong>. Not just another problem tracker, 
            but a habit engine. Spaced repetition reminds you exactly when you're about to forget. 
            Revision schedules keep patterns alive. Your heatmap shows your consistency, 
            not just your solves.
          </p>
          <p className={styles.highlight}>
            This isn't about cramming 500 problems. It's about solving 5 problems, 10 times, 
            with rhythm. <strong>1 day, 3 days, 6 days, 30 days</strong> – the intervals that turn 
            short‑term memory into lasting mastery.
          </p>
          <p>
            DevRhythm is my attempt to solve my own problem – and help others break the cycle too.
          </p>
        </div>
      </Card>

      {/* What DevRhythm Does */}
      <Card className={styles.featuresCard}>
        <div className={styles.sectionHeader}>
          <FiZap className={styles.sectionIcon} />
          <h2>What DevRhythm Does</h2>
        </div>
        <div className={styles.featuresGrid}>
          <div className={styles.feature}>
            <FiRepeat className={styles.featureIcon} />
            <h3>Spaced Repetition</h3>
            <p>1 → 3 → 6 → 30 days. Revise exactly when you're about to forget.</p>
          </div>
          <div className={styles.feature}>
            <FiTrendingUp className={styles.featureIcon} />
            <h3>Heatmaps & Streaks</h3>
            <p>Your daily garden. Watch your consistency grow, not just your solve count.</p>
          </div>
          <div className={styles.feature}>
            <FiTarget className={styles.featureIcon} />
            <h3>Goal Tracking</h3>
            <p>Set daily, weekly, or planned goals. Build rhythm intentionally.</p>
          </div>
          <div className={styles.feature}>
            <FiAward className={styles.featureIcon} />
            <h3>Pattern Mastery</h3>
            <p>Identify strongest & weakest patterns. Focus where it matters.</p>
          </div>
        </div>
      </Card>

      {/* Full Width LeetCode Card */}
      <Card className={styles.leetcodeCardFull}>
        <a
          href="https://leetcode.com/u/anupam_nlogn"  
          target="_blank"
          rel="noopener noreferrer"
          className={styles.leetcodeCardLink}
        >
          <div className={styles.leetcodeCard}>
            <div className={styles.leetcodeImageWrapper}>
              <Image
                src="/leetcode-profile.png"
                alt="LeetCode Profile"
                width={400}
                height={100}
                className={styles.leetcodeImage}
              />
            </div>
            <div className={styles.leetcodeInfo}>
              <h3 className={styles.leetcodeTitle}>LeetCode Profile</h3>
              <p className={styles.leetcodeDescription}>
                Track my problem solving journey – see what I've been practicing.
              </p>
              <span className={styles.leetcodeLinkText}>
                Visit Profile <FiExternalLink />
              </span>
            </div>
          </div>
        </a>
      </Card>

      {/* Full Width Projects Section with Image Thumbnails */}
      <Card className={styles.projectsSection}>
        <div className={styles.sectionHeader}>
          <FiDatabase className={styles.sectionIcon} />
          <h2>Other Projects</h2>
        </div>
        <div className={styles.projectsGrid}>
          {projectsData.map((project) => (
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
      </Card>

      {/* Social Links */}
      <Card className={styles.socialCard}>
        <div className={styles.sectionHeader}>
          <FiHeart className={styles.sectionIcon} />
          <h2>Connect</h2>
        </div>
        <div className={styles.socialLinks}>
          <a
            href="https://github.com/anupam6335"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
          >
            <FiGithub /> GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/anupamdebnath6335/"  
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
          >
            <FiLinkedin /> LinkedIn
          </a>
          <a
            href="https://leetcode.com/u/anupam_nlogn/" 
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
          >
            <FiCode /> LeetCode
          </a>
          <a
            href="https://anupamdebnath.vercel.app/" 
            target="_blank"
            rel="noopener noreferrer"
            className={styles.socialLink}
          >
            <FiUser /> my portfolio
          </a>
        </div>
      </Card>

      {/* Call to Action */}
      <div className={styles.ctaWrapper}>
        <Link href="/questions" className={styles.ctaButton}>
          Build Your Rhythm
        </Link>
      </div>
    </div>
  );
}