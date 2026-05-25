'use client';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMediaQuery } from '@/shared/hooks';
import Button from '@/shared/components/Button';
import Select from '@/shared/components/Select';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import {
  FiChevronDown,
  FiChevronUp,
  FiPlus,
  FiTrash2,
  FiPlay,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiUpload,
  FiRotateCcw,
} from 'react-icons/fi';
import { toast } from '@/shared/components/Toast';
import styles from './CodeExecutionArea.module.css';
import { SiCplusplus, SiJavascript } from 'react-icons/si';
import { FaJava, FaPython } from 'react-icons/fa';
import { PartyPopper, PartyPopperRef } from '@/shared/components/PartyPopper';

interface TestCase {
  stdin: string;
  expected: string;
}

interface ExecutionResult {
  passed: boolean;
  input: string;
  expected: string;
  output: string;
  error?: string;
}

interface CodeExecutionAreaProps {
  questionId: string;
  defaultTestCases: TestCase[];
  starterCodeByLanguage?: Record<string, string>;
  initialLanguage: string;
  initialCustomTestCases?: TestCase[];
  onRun: (code: string, language: string, testCases: TestCase[]) => Promise<void>;
  isRunning: boolean;
  results?: ExecutionResult[];
  onCodeChange?: (code: string) => void;
  initialHistory: any[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const languageOptions = [
  { value: 'python', label: 'Python' },
  // { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  // { value: 'javascript', label: 'JavaScript' },
];

const createCustomTheme = (isDark: boolean): Extension => {
  const backgroundColor = isDark ? 'var(--code-bg)' : 'var(--code-bg)';
  const textColor = isDark ? 'var(--code-text)' : 'var(--code-text)';

  return [
    EditorView.theme({
      '&': {
        backgroundColor,
        color: textColor,
        fontSize: '0.9rem',
        fontFamily: 'var(--font-code)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
      },
      '.cm-editor': { backgroundColor },
      '.cm-scroller': { backgroundColor },
      '.cm-gutters': {
        backgroundColor: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        color: 'var(--text-muted)',
      },
      '.cm-activeLine': { backgroundColor: 'rgba(124, 139, 122, 0.1)' },
      '.cm-activeLineGutter': { backgroundColor: 'rgba(124, 139, 122, 0.1)' },
      '.cm-selectionBackground': {
        backgroundColor: 'rgba(var(--accent-moss-rgb), 0.3) !important',
      },
      '.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(var(--accent-moss-rgb), 0.5) !important',
      },
      '.cm-cursor': { borderLeftColor: textColor },
      '.cm-cursor-primary': { borderLeftColor: textColor },
    }),
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: t.keyword, color: isDark ? '#f92672' : '#d73a49' },
        { tag: t.comment, color: isDark ? '#7c8b7a' : '#6a737d', fontStyle: 'italic' },
        { tag: t.string, color: isDark ? '#a6e22e' : '#032f62' },
        { tag: t.number, color: isDark ? '#ae81ff' : '#005cc5' },
        { tag: t.function(t.variableName), color: isDark ? '#66d9ef' : '#6f42c1' },
        { tag: t.operator, color: isDark ? '#f92672' : '#d73a49' },
      ])
    ),
  ];
};

const useTheme = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    setIsDark(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);

  return isDark;
};

export const CodeExecutionArea: React.FC<CodeExecutionAreaProps> = ({
  questionId,
  defaultTestCases,
  starterCodeByLanguage,
  initialLanguage,
  initialCustomTestCases = [],
  onRun,
  isRunning,
  results,
  onCodeChange,
  initialHistory,
  activeTab,
  onTabChange,
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDark = useTheme();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState(initialLanguage);
  const [customTestCases, setCustomTestCases] = useState<TestCase[]>(initialCustomTestCases);
  const [testCasesCollapsed, setTestCasesCollapsed] = useState(isMobile);
  const [isCodeModified, setIsCodeModified] = useState(false);
  const skipStarterLoad = useRef(false);
  const autoSwitched = useRef(false);
  const editorViewRef = useRef<EditorView | null>(null);
  const partyPopperRef = useRef<PartyPopperRef>(null);
  const hasLoadedInitialHistory = useRef(false);

  const getLanguageExtension = (lang: string) => {
    switch (lang) {
      case 'python':
        return python();
      // case 'java':
      //   return java();
      case 'cpp':
        return cpp();
      // case 'javascript': 
      //   return javascript();
      default:
        return python();
    }
  };

  const getCurrentStarterCode = useCallback(() => {
    if (!starterCodeByLanguage) return '';
    const lang = language;
    // Try exact match
    if (starterCodeByLanguage[lang]) {
      return starterCodeByLanguage[lang];
    }
    // Fallback for python (backend may have 'python3')
    if (lang === 'python' && starterCodeByLanguage['python3']) {
      return starterCodeByLanguage['python3'];
    }
    // Fallback for cpp (backend may have 'c++')
    if (lang === 'cpp' && starterCodeByLanguage['c++']) {
      return starterCodeByLanguage['c++'];
    }
    return `// Starter code not available for ${language}\n`;
  }, [starterCodeByLanguage, language]);

  const checkIfModified = useCallback(
    (currentCode: string) => {
      const starter = getCurrentStarterCode();
      setIsCodeModified(currentCode !== starter);
    },
    [getCurrentStarterCode]
  );

  useEffect(() => {
    if (!skipStarterLoad.current) {
      checkIfModified(code);
    }
  }, [code, checkIfModified]);

  // Load initial history only on mount
  useEffect(() => {
    if (!hasLoadedInitialHistory.current) {
      if (initialHistory.length > 0) {
        const sorted = [...initialHistory].sort(
          (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
        );
        const last = sorted[0];
        if (last) {
          let frontendLang = initialLanguage;
          // Map backend language to frontend language key
          const backendLang = last.language.toLowerCase();
          if (backendLang === 'python3') frontendLang = 'python';
          else if (backendLang === 'c++') frontendLang = 'cpp';
          else if (backendLang === 'python') frontendLang = 'python';
          else if (backendLang === 'java') frontendLang = 'java';
          else if (backendLang === 'javascript') frontendLang = 'javascript';
          else frontendLang = backendLang;
          skipStarterLoad.current = true;
          setLanguage(frontendLang);
          setCode(last.code);
          if (onCodeChange) onCodeChange(last.code);
          setTimeout(() => {
            skipStarterLoad.current = false;
          }, 100);
        }
      }
      hasLoadedInitialHistory.current = true;
    }
  }, [initialHistory, initialLanguage, onCodeChange]);

  // Update code when language changes (unless loading history)
  useEffect(() => {
    if (skipStarterLoad.current) return;
    const starter = getCurrentStarterCode();
    setCode(starter);
    if (onCodeChange) onCodeChange(starter);
    setIsCodeModified(false);
  }, [language, getCurrentStarterCode, onCodeChange]);

  useEffect(() => {
    if (onCodeChange) onCodeChange(code);
  }, [code, onCodeChange]);

  // Auto‑switch to results tab on new execution results
  useEffect(() => {
    if (results && results.length > 0 && !autoSwitched.current) {
      autoSwitched.current = true;
      onTabChange('results');
      setTimeout(() => {
        autoSwitched.current = false;
      }, 500);
    }
  }, [results, onTabChange]);

  const handleAddCustom = () => {
    setCustomTestCases((prev) => [...prev, { stdin: '', expected: '' }]);
  };

  const handleRemoveCustom = (index: number) => {
    setCustomTestCases((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCustomChange = (index: number, field: 'stdin' | 'expected', value: string) => {
    setCustomTestCases((prev) =>
      prev.map((tc, i) => (i === index ? { ...tc, [field]: value } : tc))
    );
  };

  const handleRun = () => {
    const combined = [...defaultTestCases, ...customTestCases];
    onRun(code, language, combined);
  };

  const handleReset = () => {
    const starter = getCurrentStarterCode();
    setCode(starter);
    if (onCodeChange) onCodeChange(starter);
    toast.success('Code reset');
  };

  const customTheme = useMemo(() => createCustomTheme(isDark), [isDark]);

  const tabs = [
    { id: 'code', label: 'Code' },
    { id: 'history', label: 'History' },
    { id: 'results', label: 'Results' },
  ];

  const passedCount = results?.filter((r) => r.passed).length || 0;
  const totalCount = results?.length || 0;

  const resetButtonContent = isMobile ? <FiRotateCcw /> : <><FiRotateCcw /> Reset</>;

  // Fire party popper if all tests pass
  useEffect(() => {
    if (results && results.length > 0 && results.every((r) => r.passed)) {
      partyPopperRef.current?.fire();
    }
  }, [results]);

  return (
    <div className={styles.container}>
      <PartyPopper ref={partyPopperRef} />

      <div className={styles.topRow}>
        <div className={styles.languageRow}>
          <Select
            options={languageOptions}
            value={language}
            onChange={setLanguage}
            className={styles.select}
          />
        </div>

        <div className={styles.tabsSwitch}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.actionButtons}>
          {isCodeModified && (
            <button
              className={styles.iconButton}
              onClick={handleReset}
              aria-label="Reset code"
              title="Reset to starter code"
            >
              {resetButtonContent}
            </button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={handleRun}
            isLoading={isRunning}
            leftIcon={<FiPlay />}
            className={styles.runButton}
          >
            Run Code
          </Button>
        </div>
      </div>

      {activeTab === 'code' && (
        <>
          <CodeMirror
            value={code}
            onChange={(val) => {
              setCode(val);
              if (onCodeChange) onCodeChange(val);
            }}
            height={isMobile ? '300px' : '500px'}
            extensions={[getLanguageExtension(language), customTheme]}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              foldGutter: true,
              dropCursor: true,
              allowMultipleSelections: true,
              indentOnInput: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: true,
              rectangularSelection: true,
              crosshairCursor: true,
              highlightSelectionMatches: true,
              closeBracketsKeymap: true,
              defaultKeymap: true,
              searchKeymap: true,
              historyKeymap: true,
              foldKeymap: true,
              completionKeymap: true,
              lintKeymap: true,
            }}
            className={styles.editor}
            onCreateEditor={(view) => {
              editorViewRef.current = view;
            }}
          />

          <div className={styles.testCasesSection}>
            <div className={styles.testCasesHeader}>
              <strong>Test Cases</strong>
              <div className={styles.testCasesHeaderActions}>
                <button className={styles.addButtonSmall} onClick={handleAddCustom}>
                  <FiPlus /> Add
                </button>
                <button
                  className={styles.toggleButton}
                  onClick={() => setTestCasesCollapsed(!testCasesCollapsed)}
                >
                  {testCasesCollapsed ? <FiChevronDown /> : <FiChevronUp />}
                </button>
              </div>
            </div>
            {!testCasesCollapsed && (
              <div className={styles.testCasesList}>
                <div className={styles.testCasesHeaderRow}>
                  <div className={styles.testCasesHeaderCell}>Input</div>
                  <div className={styles.testCasesHeaderCell}>Expected</div>
                </div>
                {defaultTestCases.map((tc, idx) => (
                  <div key={`default-${idx}`} className={styles.testCaseRow}>
                    <div className={styles.testCaseCell}>
                      <code className={styles.mono}>{tc.stdin}</code>
                    </div>
                    <div className={styles.testCaseCell}>
                      <code className={styles.mono}>{tc.expected}</code>
                    </div>
                  </div>
                ))}
                {customTestCases.map((tc, idx) => (
                  <div key={`custom-${idx}`} className={styles.testCaseRowEditable}>
                    <div className={styles.testCaseCell}>
                      <textarea
                        value={tc.stdin}
                        onChange={(e) => handleCustomChange(idx, 'stdin', e.target.value)}
                        className={styles.editableInput}
                        rows={2}
                      />
                    </div>
                    <div className={styles.testCaseCell}>
                      <textarea
                        value={tc.expected}
                        onChange={(e) => handleCustomChange(idx, 'expected', e.target.value)}
                        className={styles.editableInput}
                        rows={2}
                      />
                    </div>
                    <button className={styles.deleteButton} onClick={() => handleRemoveCustom(idx)}>
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className={styles.historyPanel}>
          {initialHistory.length === 0 ? (
            <div className={styles.historyEmpty}>
              <div className={styles.historyEmptyIcon}>⌨️</div>
              <p>No submissions yet</p>
              <span>Run your code to see history</span>
            </div>
          ) : (
            <div className={styles.historyTimeline}>
              {initialHistory.map((entry: any, idx: number) => {
                const passedCount = entry.summary.passedCount;
                const totalCount = entry.summary.totalCount;
                const allPassed = passedCount === totalCount;
                const executedAt = new Date(entry.executedAt);
                const now = new Date();
                const diffMs = now.getTime() - executedAt.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                let timeAgo = '';
                if (diffMins < 1) timeAgo = 'just now';
                else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
                else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
                else timeAgo = `${diffDays}d ago`;

                const isLast = idx === initialHistory.length - 1;

                const getLanguageIcon = () => {
                  switch (entry.language) {
                    case 'python':
                      return <FaPython size={14} />;
                    case 'java':
                      return <FaJava size={14} />;
                    case 'cpp':
                      return <SiCplusplus size={14} />;
                    case 'javascript':
                      return <SiJavascript size={14} />;
                    default:
                      return null;
                  }
                };

                return (
                  <div key={entry._id} className={styles.historyEntry}>
                    <div className={styles.historyEntryLine}>
                      <div className={styles.historyEntryDot} />
                      {!isLast && <div className={styles.historyEntryConnector} />}
                    </div>
                    <div className={styles.historyEntryContent}>
                      <div className={styles.historyEntryHeader}>
                        <div className={styles.historyEntryLanguage}>
                          {getLanguageIcon()}
                          <span>{entry.language}</span>
                        </div>
                        <div className={styles.historyEntryTime}>
                          <FiClock size={12} />
                          <span>{timeAgo}</span>
                        </div>
                      </div>
                      <div className={styles.historyEntryFooter}>
                        <span
                          className={
                            allPassed
                              ? styles.historyEntrySuccess
                              : styles.historyEntryFailure
                          }
                        >
                          {allPassed
                            ? '✓ All tests passed'
                            : `${passedCount}/${totalCount} passed`}
                        </span>
                        <button
                          className={styles.historyLoadButton}
                          onClick={() => {
                            let frontendLang = entry.language;
                            if (entry.language === 'python3') frontendLang = 'python';
                            else if (entry.language === 'c++') frontendLang = 'cpp';
                            skipStarterLoad.current = true;
                            setLanguage(frontendLang);
                            setCode(entry.code);
                            if (onCodeChange) onCodeChange(entry.code);
                            onTabChange('code');
                            toast.success('Code loaded');
                            setTimeout(() => {
                              skipStarterLoad.current = false;
                            }, 100);
                          }}
                        >
                          <FiUpload size={12} /> Load code
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div className={styles.resultsPanel}>
          {!results || results.length === 0 ? (
            <div className={styles.resultsEmpty}>Run your code to see results here.</div>
          ) : (
            <>
              <div className={styles.resultSummaryTop}>
                {passedCount} / {totalCount} passed
              </div>
              <div className={styles.resultsList}>
                {results.map((res, idx) => (
                  <div key={idx} className={styles.resultCard}>
                    <div className={styles.resultHeader}>
                      <span
                        className={
                          res.passed ? styles.resultPassedIcon : styles.resultFailedIcon
                        }
                      >
                        {res.passed ? <FiCheckCircle /> : <FiXCircle />}
                      </span>
                      <span className={styles.resultLabel}>Test Case {idx + 1}</span>
                    </div>
                    <div className={styles.resultDetail}>
                      <div className={styles.resultDetailLabel}>Input:</div>
                      <pre className={styles.resultDetailValue}>{res.input}</pre>
                    </div>
                    <div className={styles.resultDetail}>
                      <div className={styles.resultDetailLabel}>Expected:</div>
                      <pre className={styles.resultDetailValue}>{res.expected}</pre>
                    </div>
                    <div className={styles.resultDetail}>
                      <div className={styles.resultDetailLabel}>Output:</div>
                      <pre className={styles.resultDetailValue}>{res.output}</pre>
                    </div>
                    {res.error && (
                      <div className={styles.resultError}>
                        <div className={styles.resultDetailLabel}>Error:</div>
                        <pre className={styles.resultErrorValue}>{res.error}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};