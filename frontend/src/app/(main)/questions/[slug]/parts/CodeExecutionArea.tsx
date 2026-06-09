'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMediaQuery } from '@/shared/hooks';
import Button from '@/shared/components/Button';
import Select from '@/shared/components/Select';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { EditorView, keymap, Decoration } from '@codemirror/view';
import { StateEffect, StateField, RangeSet, Range, RangeValue } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { undo, redo } from '@codemirror/commands';
import {
  FiChevronDown, FiChevronUp, FiPlus, FiTrash2, FiPlay, FiCheckCircle,
  FiXCircle, FiClock, FiUpload, FiRotateCcw, FiCopy, FiX, FiChevronLeft,
  FiChevronRight, FiRotateCw,
} from 'react-icons/fi';
import { toast } from '@/shared/components/Toast';
import styles from './CodeExecutionArea.module.css';
import { SiCplusplus } from 'react-icons/si';
import { FaPython } from 'react-icons/fa';
import { PartyPopper, PartyPopperRef } from '@/shared/components/PartyPopper';
import { parseErrorLineNumber, getErrorType } from './errorParser';
import { ExecutionStatusIndicator, ExecutionStatus } from '@/features/codeExecution/components/ExecutionStatusIndicator';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRouter } from 'next/navigation';

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
  executionError?: string | null;
  onCodeChange?: (code: string) => void;
  initialHistory: any[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  executionStatus?: ExecutionStatus;
}

const languageOptions = [
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++' },
];

// Storage keys
const getStorageKey = (questionId: string, language: string) => `code_${questionId}_${language}`;
const getLanguageStorageKey = (questionId: string) => `code_language_${questionId}`;

// ========== Custom Find/Replace State ==========
class SearchMatchValue extends RangeValue {
  constructor(public type: string) { super(); }
  eq(other: SearchMatchValue) { return this.type === other.type; }
  map() { return this; }
  startSide = 0; endSide = 0; mapMode = 0; point = false; side = 0;
}

const addSearchMatchEffect = StateEffect.define<RangeSet<SearchMatchValue>>();
const searchMatchField = StateField.define<RangeSet<SearchMatchValue>>({
  create() { return RangeSet.empty; },
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(addSearchMatchEffect)) { return effect.value; }
    }
    return value;
  },
});

const searchHighlightTheme = EditorView.baseTheme({
  '.cm-search-match': {
    backgroundColor: 'var(--accent-moss)',
    color: 'var(--primary-text-on-action)',
  },
});

function getMatchRanges(doc: any, searchText: string): { from: number; to: number; value: SearchMatchValue }[] {
  if (!searchText) return [];
  const ranges: { from: number; to: number; value: SearchMatchValue }[] = [];
  const content = doc.toString();
  let start = 0;
  while (true) {
    const idx = content.indexOf(searchText, start);
    if (idx === -1) break;
    const from = idx;
    const to = from + searchText.length;
    ranges.push({ from, to, value: new SearchMatchValue('search-match') });
    start = to;
  }
  return ranges;
}

function updateSearchMatches(view: EditorView, searchText: string) {
  const ranges = getMatchRanges(view.state.doc, searchText);
  const set = RangeSet.of(ranges.map(r => ({ from: r.from, to: r.to, value: r.value })));
  view.dispatch({ effects: addSearchMatchEffect.of(set) });
}

function getCurrentMatchIndex(view: EditorView): number | null {
  const selection = view.state.selection.main;
  const from = selection.from;
  const field = view.state.field(searchMatchField);
  let matches: { from: number; to: number; value: SearchMatchValue }[] = [];
  field.between(0, view.state.doc.length, (from, to, value) => { matches.push({ from, to, value }); });
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].from === from) return i;
  }
  return null;
}

function goToMatch(view: EditorView, direction: 'next' | 'prev') {
  const field = view.state.field(searchMatchField);
  let matches: { from: number; to: number; value: SearchMatchValue }[] = [];
  field.between(0, view.state.doc.length, (from, to, value) => { matches.push({ from, to, value }); });
  if (matches.length === 0) return;
  let currentIdx = getCurrentMatchIndex(view);
  let nextIdx: number;
  if (currentIdx === null) {
    nextIdx = direction === 'next' ? 0 : matches.length - 1;
  } else {
    nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx < 0) nextIdx = matches.length - 1;
    if (nextIdx >= matches.length) nextIdx = 0;
  }
  const match = matches[nextIdx];
  view.dispatch({ selection: { anchor: match.from, head: match.to }, scrollIntoView: true });
}

function replaceCurrent(view: EditorView, replaceText: string) {
  const selection = view.state.selection.main;
  const from = selection.from;
  const to = selection.to;
  const field = view.state.field(searchMatchField);
  let isMatch = false;
  field.between(from, to, (f, t) => { if (f === from && t === to) isMatch = true; });
  if (!isMatch) return;
  view.dispatch({ changes: { from, to, insert: replaceText }, selection: { anchor: from, head: from + replaceText.length } });
  const searchText = (window as any).__searchText || '';
  if (searchText) updateSearchMatches(view, searchText);
}

function replaceAll(view: EditorView, searchText: string, replaceText: string) {
  if (!searchText) return;
  const content = view.state.doc.toString();
  const newContent = content.split(searchText).join(replaceText);
  if (newContent !== content) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: newContent } });
    updateSearchMatches(view, searchText);
  }
}

// ========== Error Line Highlighting Extension ==========
const errorLineEffect = StateEffect.define<{ from: number; to: number } | null>();
const errorLineField = StateField.define<RangeSet<Decoration>>({
  create() { return RangeSet.empty; },
  update(value, tr) {
    for (let effect of tr.effects) {
      if (effect.is(errorLineEffect)) {
        if (!effect.value) return RangeSet.empty;
        const { from, to } = effect.value;
        const decoration = Decoration.line({ attributes: { class: styles.errorLine } }).range(from, to);
        return RangeSet.of([decoration]);
      }
    }
    return value;
  },
});
const errorLineExtension = [ errorLineField, EditorView.decorations.compute([errorLineField], (state) => state.field(errorLineField)) ];

// ========== Theme & Indentation ==========
const createCustomTheme = (isDark: boolean): Extension => {
  const backgroundColor = isDark ? 'var(--code-bg)' : 'var(--code-bg)';
  const textColor = isDark ? 'var(--code-text)' : 'var(--code-text)';
  return [
    EditorView.theme({
      '&': { backgroundColor, color: textColor, fontSize: '0.9rem', fontFamily: 'var(--font-code)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
      '.cm-editor': { backgroundColor },
      '.cm-scroller': { backgroundColor },
      '.cm-gutters': { backgroundColor: 'var(--bg-elevated)', borderRight: '1px solid var(--border)', color: 'var(--text-muted)' },
      '.cm-activeLine': { backgroundColor: 'rgba(124, 139, 122, 0.1)' },
      '.cm-activeLineGutter': { backgroundColor: 'rgba(124, 139, 122, 0.1)' },
      '.cm-selectionBackground': { backgroundColor: 'rgba(var(--accent-moss-rgb), 0.3) !important' },
      '.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(var(--accent-moss-rgb), 0.5) !important' },
      '.cm-cursor': { borderLeftColor: textColor },
      '.cm-cursor-primary': { borderLeftColor: textColor },
    }),
    syntaxHighlighting(HighlightStyle.define([
      { tag: t.keyword, color: isDark ? '#f92672' : '#d73a49' },
      { tag: t.comment, color: isDark ? '#7c8b7a' : '#6a737d', fontStyle: 'italic' },
      { tag: t.string, color: isDark ? '#a6e22e' : '#032f62' },
      { tag: t.number, color: isDark ? '#ae81ff' : '#005cc5' },
      { tag: t.function(t.variableName), color: isDark ? '#66d9ef' : '#6f42c1' },
      { tag: t.operator, color: isDark ? '#f92672' : '#d73a49' },
    ])),
  ];
};

const useTheme = () => {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const observer = new MutationObserver(() => { setIsDark(document.documentElement.classList.contains('dark')); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    setIsDark(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);
  return isDark;
};

// ========== Main Component ==========
export const CodeExecutionArea: React.FC<CodeExecutionAreaProps> = ({
  questionId,
  defaultTestCases,
  starterCodeByLanguage,
  initialLanguage,
  initialCustomTestCases = [],
  onRun,
  isRunning,
  results,
  executionError,
  onCodeChange,
  initialHistory,
  activeTab,
  onTabChange,
  executionStatus = 'idle',
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDark = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const isLoggedIn = !!user;

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState(initialLanguage);
  const [customTestCases, setCustomTestCases] = useState<TestCase[]>(initialCustomTestCases);
  const [testCasesCollapsed, setTestCasesCollapsed] = useState(isMobile);
  const [isCodeModified, setIsCodeModified] = useState(false);
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const skipStarterLoad = useRef(false);
  const autoSwitched = useRef(false);
  const editorViewRef = useRef<EditorView | null>(null);
  const partyPopperRef = useRef<PartyPopperRef>(null);
  const hasLoadedInitialHistory = useRef(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDone = useRef(false);
  const prevIsRunningRef = useRef(isRunning);
  const lastPartyTrigger = useRef<string>('');
  const [showFindPanel, setShowFindPanel] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  const handleUndo = useCallback(() => { if (editorViewRef.current) undo(editorViewRef.current); }, []);
  const handleRedo = useCallback(() => { if (editorViewRef.current) redo(editorViewRef.current); }, []);

  const persistCode = useCallback((newCode: string, lang: string) => {
    if (!newCode) return;
    const key = getStorageKey(questionId, lang);
    if (typeof window !== 'undefined') localStorage.setItem(key, newCode);
  }, [questionId]);

  const getPersistedCode = useCallback((lang: string): string | null => {
    const key = getStorageKey(questionId, lang);
    if (typeof window !== 'undefined') return localStorage.getItem(key);
    return null;
  }, [questionId]);

  const persistLanguage = useCallback((lang: string) => {
    const key = getLanguageStorageKey(questionId);
    if (typeof window !== 'undefined') localStorage.setItem(key, lang);
  }, [questionId]);

  const getPersistedLanguage = useCallback((): string | null => {
    const key = getLanguageStorageKey(questionId);
    if (typeof window !== 'undefined') return localStorage.getItem(key);
    return null;
  }, [questionId]);

  const getCurrentStarterCode = useCallback(() => {
    if (!starterCodeByLanguage) return '';
    const lang = language;
    if (starterCodeByLanguage[lang]) return starterCodeByLanguage[lang];
    if (lang === 'python' && starterCodeByLanguage['python3']) return starterCodeByLanguage['python3'];
    if (lang === 'cpp' && starterCodeByLanguage['c++']) return starterCodeByLanguage['c++'];
    return `// Starter code not available for ${language}\n`;
  }, [starterCodeByLanguage, language]);

  const checkIfModified = useCallback((currentCode: string) => {
    const starter = getCurrentStarterCode();
    setIsCodeModified(currentCode !== starter);
  }, [getCurrentStarterCode]);

  const handleCodeChange = useCallback((val: string) => {
    setCode(val);
    onCodeChange?.(val);
    checkIfModified(val);
    if (errorLine !== null) {
      setErrorLine(null);
      if (editorViewRef.current) editorViewRef.current.dispatch({ effects: errorLineEffect.of(null) });
    }
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => { persistCode(val, language); }, 500);
  }, [onCodeChange, checkIfModified, persistCode, language, errorLine]);

  // Initial load logic (unchanged)
  useEffect(() => {
    if (initialLoadDone.current) return;
    const savedLang = getPersistedLanguage();
    if (savedLang && languageOptions.some(opt => opt.value === savedLang)) setLanguage(savedLang as typeof language);
    initialLoadDone.current = true;
  }, [getPersistedLanguage]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const savedCode = getPersistedCode(language);
    if (savedCode) {
      setCode(savedCode);
      onCodeChange?.(savedCode);
      checkIfModified(savedCode);
    } else {
      const starter = getCurrentStarterCode();
      setCode(starter);
      onCodeChange?.(starter);
      checkIfModified(starter);
    }
    skipStarterLoad.current = true;
  }, [language, getPersistedCode, getCurrentStarterCode, onCodeChange, checkIfModified]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (skipStarterLoad.current) return;
    persistLanguage(language);
    const saved = getPersistedCode(language);
    if (saved) {
      setCode(saved);
      onCodeChange?.(saved);
      checkIfModified(saved);
    } else {
      const starter = getCurrentStarterCode();
      setCode(starter);
      onCodeChange?.(starter);
      checkIfModified(starter);
    }
  }, [language, getPersistedCode, getCurrentStarterCode, onCodeChange, checkIfModified, persistLanguage]);

  useEffect(() => {
    if (!hasLoadedInitialHistory.current && initialHistory.length > 0) {
      const sorted = [...initialHistory].sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
      const last = sorted[0];
      if (last) {
        let frontendLang = initialLanguage;
        const backendLang = last.language.toLowerCase();
        if (backendLang === 'python3') frontendLang = 'python';
        else if (backendLang === 'c++') frontendLang = 'cpp';
        else if (backendLang === 'python') frontendLang = 'python';
        else frontendLang = backendLang;
        const existing = getPersistedCode(frontendLang);
        if (!existing && initialLoadDone.current) {
          skipStarterLoad.current = true;
          setLanguage(frontendLang);
          persistLanguage(frontendLang);
          setCode(last.code);
          onCodeChange?.(last.code);
          persistCode(last.code, frontendLang);
          setTimeout(() => { skipStarterLoad.current = false; }, 100);
        }
      }
      hasLoadedInitialHistory.current = true;
    }
  }, [initialHistory, initialLanguage, onCodeChange, getPersistedCode, persistCode, persistLanguage]);

  useEffect(() => {
    if ((results && results.length > 0) || executionError) {
      if (!autoSwitched.current) {
        autoSwitched.current = true;
        onTabChange('results');
        setTimeout(() => { autoSwitched.current = false; }, 500);
      }
    }
  }, [results, executionError, onTabChange]);

  useEffect(() => {
    const wasRunning = prevIsRunningRef.current;
    const justFinished = wasRunning && !isRunning;
    if (justFinished && !executionError && results && results.length > 0 && results.every(r => r.passed)) {
      const key = `${results.length}-${results.filter(r => r.passed).length}`;
      if (lastPartyTrigger.current !== key) {
        lastPartyTrigger.current = key;
        partyPopperRef.current?.fire();
      }
    }
    prevIsRunningRef.current = isRunning;
  }, [isRunning, results, executionError]);

  useEffect(() => {
    if (!results || results.length === 0) {
      if (!executionError) setErrorLine(null);
      return;
    }
    const failedWithError = results.find(r => !r.passed && r.error);
    if (failedWithError && failedWithError.error) {
      const line = parseErrorLineNumber(failedWithError.error, language);
      setErrorLine(line);
      if (line !== null && editorViewRef.current) {
        setTimeout(() => {
          const view = editorViewRef.current;
          if (view) {
            try { const lineInfo = view.state.doc.lineAt(line); view.dispatch({ effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }) }); } catch (e) {}
          }
        }, 100);
      }
    } else { setErrorLine(null); }
  }, [results, language, executionError]);

  useEffect(() => {
    if (executionError) {
      const line = parseErrorLineNumber(executionError, language);
      if (line !== null) {
        setErrorLine(line);
        if (editorViewRef.current) {
          setTimeout(() => {
            const view = editorViewRef.current;
            if (view) {
              try { const lineInfo = view.state.doc.lineAt(line); view.dispatch({ effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }) }); } catch (e) {}
            }
          }, 200);
        }
      } else { setErrorLine(null); }
    } else {
      if (!results || results.length === 0) setErrorLine(null);
    }
  }, [executionError, language, results]);

  useEffect(() => {
    if (!editorViewRef.current) return;
    const view = editorViewRef.current;
    if (errorLine !== null) {
      try { const line = view.state.doc.lineAt(errorLine); view.dispatch({ effects: errorLineEffect.of({ from: line.from, to: line.to }) }); } catch (e) {}
    } else { view.dispatch({ effects: errorLineEffect.of(null) }); }
  }, [errorLine]);

  const handleFindNext = useCallback(() => { if (editorViewRef.current && findText) goToMatch(editorViewRef.current, 'next'); }, [findText]);
  const handleFindPrev = useCallback(() => { if (editorViewRef.current && findText) goToMatch(editorViewRef.current, 'prev'); }, [findText]);
  const handleReplaceOne = useCallback(() => { if (editorViewRef.current && findText) replaceCurrent(editorViewRef.current, replaceText); }, [findText, replaceText]);
  const handleReplaceAll = useCallback(() => { if (editorViewRef.current && findText) replaceAll(editorViewRef.current, findText, replaceText); }, [findText, replaceText]);

  useEffect(() => {
    if (!editorViewRef.current) return;
    const view = editorViewRef.current;
    updateSearchMatches(view, findText);
    (window as any).__searchText = findText;
  }, [findText]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        if (!showFindPanel) {
          setShowFindPanel(true);
          setFindText('');
          setReplaceText('');
          setShowReplace(false);
          setTimeout(() => findInputRef.current?.focus(), 10);
        } else { findInputRef.current?.focus(); }
      }
      if (e.key === 'Escape' && showFindPanel) { setShowFindPanel(false); editorViewRef.current?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFindPanel]);

  const copyToClipboard = () => { navigator.clipboard.writeText(code); toast.success('Code copied to clipboard'); };
  const handleReset = () => {
    const starter = getCurrentStarterCode();
    setCode(starter);
    onCodeChange?.(starter);
    const key = getStorageKey(questionId, language);
    localStorage.removeItem(key);
    toast.success('Reset to starter code');
  };

  const customTheme = useMemo(() => createCustomTheme(isDark), [isDark]);
  const tabs = [ { id: 'code', label: 'Code' }, { id: 'history', label: 'History' }, { id: 'results', label: 'Results' } ];
  const passedCount = results?.filter((r) => r.passed).length || 0;
  const totalCount = results?.length || 0;
  const resetButtonContent = isMobile ? <FiRotateCcw /> : <><FiRotateCcw /> Reset</>;

  const getLanguageExtension = (lang: string) => {
    switch (lang) {
      case 'python': return python();
      case 'cpp': return cpp();
      default: return python();
    }
  };

  const indentExtensions = useMemo(() => [
    indentUnit.of(' '),
    keymap.of([
      { key: 'Tab', run: (view) => { view.dispatch({ changes: { from: view.state.selection.main.head, insert: ' ' }, selection: { anchor: view.state.selection.main.head + 4 } }); return true; }, preventDefault: true },
      { key: 'Shift-Tab', run: (view) => {
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        const lineStart = line.from;
        const lineText = line.text;
        let spacesToRemove = 0;
        for (let i = 0; i < Math.min(4, lineText.length); i++) { if (lineText[i] === ' ') spacesToRemove++; else break; }
        if (spacesToRemove > 0) {
          const from = lineStart;
          const to = lineStart + spacesToRemove;
          view.dispatch({ changes: { from, to, insert: '' }, selection: { anchor: pos - spacesToRemove } });
        }
        return true;
      }, preventDefault: true },
    ]),
  ], []);

  const editorExtensions = useMemo(() => [
    getLanguageExtension(language),
    customTheme,
    searchHighlightTheme,
    searchMatchField,
    indentExtensions,
    errorLineExtension,
    keymap.of([
      { key: 'Ctrl-f', run: () => { setShowFindPanel(true); return true; }, preventDefault: true },
      { key: 'Cmd-f', run: () => { setShowFindPanel(true); return true; }, preventDefault: true },
    ]),
  ], [language, customTheme, indentExtensions]);

  const handleStatusHide = useCallback(() => {}, []);

  return (
    <div className={styles.container}>
      <PartyPopper ref={partyPopperRef} />
      <div className={styles.topRow}>
        <div className={styles.languageRow}>
          <Select options={languageOptions} value={language} onChange={setLanguage} className={styles.select} />
        </div>
        <ExecutionStatusIndicator status={executionStatus} onHide={handleStatusHide} />
        <div className={styles.tabsSwitch}>
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTab : ''}`} onClick={() => onTabChange(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className={styles.actionButtons}>
          {activeTab === 'code' && (
            <>
              <button className={styles.iconButton} onClick={handleUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><FiRotateCcw /></button>
              <button className={styles.iconButton} onClick={handleRedo} aria-label="Redo" title="Redo (Ctrl+Y / Cmd+Shift+Z)"><FiRotateCw /></button>
              <button className={styles.iconButton} onClick={copyToClipboard} aria-label="Copy code" title="Copy code"><FiCopy /></button>
            </>
          )}
          {isCodeModified && activeTab === 'code' && (
            <button className={styles.iconButton} onClick={handleReset} aria-label="Reset code" title="Reset to starter code">{resetButtonContent}</button>
          )}
          {isLoggedIn ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onRun(code, language, [...defaultTestCases, ...customTestCases])}
              disabled={isRunning}
              leftIcon={<FiPlay />}
              className={styles.runButton}
            >
              Run Code
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/login')}
              leftIcon={<FiPlay />}
              className={styles.runButton}
            >
              Login to Run
            </Button>
          )}
        </div>
      </div>

      {/* Editor and test cases – always mounted, hidden when not in code tab */}
      <div style={{ display: activeTab === 'code' ? 'block' : 'none' }}>
        <div className={styles.editorWrapper}>
          {isLoggedIn ? (
            <CodeMirror
              value={code}
              onChange={handleCodeChange}
              height={isMobile ? '300px' : '500px'}
              extensions={editorExtensions}
              basicSetup={{
                lineNumbers: true, highlightActiveLineGutter: true, highlightActiveLine: true, foldGutter: true,
                dropCursor: true, allowMultipleSelections: true, indentOnInput: true, bracketMatching: true,
                closeBrackets: true, autocompletion: true, rectangularSelection: true, crosshairCursor: true,
                highlightSelectionMatches: true, closeBracketsKeymap: true, defaultKeymap: true, historyKeymap: true,
                foldKeymap: true, completionKeymap: true, lintKeymap: true,
              }}
              className={styles.editor}
              onCreateEditor={(view) => { editorViewRef.current = view; }}
            />
          ) : (
            <div className={styles.loginPlaceholder}>
              <div className={styles.loginPlaceholderContent}>
                <p className={styles.loginPlaceholderTitle}>🔒 Login to see boilerplate code</p>
                <pre className={styles.loginPlaceholderCode}>{getCurrentStarterCode()}</pre>
                <Button variant="primary" size="sm" onClick={() => router.push('/login')} leftIcon={<FiPlay />}>
                  Login to Run Code
                </Button>
              </div>
            </div>
          )}
          {showFindPanel && isLoggedIn && (
            <div className={styles.findPanel}>
              <div className={styles.findPanelContent}>
                <div className={styles.findRow}>
                  <input ref={findInputRef} type="text" placeholder="Find" value={findText} onChange={(e) => setFindText(e.target.value)} className={styles.findInput} />
                  <button className={styles.findActionButton} onClick={handleFindPrev} title="Previous match"><FiChevronLeft /></button>
                  <button className={styles.findActionButton} onClick={handleFindNext} title="Next match"><FiChevronRight /></button>
                  <button className={styles.findActionButton} onClick={() => setShowReplace(!showReplace)} title="Show replace">{showReplace ? <FiChevronUp /> : <FiChevronDown />}</button>
                  <button className={styles.findCloseButton} onClick={() => setShowFindPanel(false)} aria-label="Close"><FiX /></button>
                </div>
                {showReplace && (
                  <div className={styles.replaceRow}>
                    <input type="text" placeholder="Replace with" value={replaceText} onChange={(e) => setReplaceText(e.target.value)} className={styles.replaceInput} />
                    <button className={styles.replaceButton} onClick={handleReplaceOne}>Replace</button>
                    <button className={styles.replaceAllButton} onClick={handleReplaceAll}>Replace All</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className={styles.testCasesSection}>
          <div className={styles.testCasesHeader}>
            <strong>Test Cases</strong>
            <div className={styles.testCasesHeaderActions}>
              <button className={styles.addButtonSmall} onClick={() => setCustomTestCases((prev) => [...prev, { stdin: '', expected: '' }])}><FiPlus /> Add</button>
              <button className={styles.toggleButton} onClick={() => setTestCasesCollapsed(!testCasesCollapsed)}>{testCasesCollapsed ? <FiChevronDown /> : <FiChevronUp />}</button>
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
                  <div className={styles.testCaseCell}><code className={styles.mono}>{tc.stdin}</code></div>
                  <div className={styles.testCaseCell}><code className={styles.mono}>{tc.expected}</code></div>
                </div>
              ))}
              {customTestCases.map((tc, idx) => (
                <div key={`custom-${idx}`} className={styles.testCaseRowEditable}>
                  <div className={styles.testCaseCell}>
                    <textarea value={tc.stdin} onChange={(e) => { const newCases = [...customTestCases]; newCases[idx].stdin = e.target.value; setCustomTestCases(newCases); }} className={styles.editableInput} rows={2} />
                  </div>
                  <div className={styles.testCaseCell}>
                    <textarea value={tc.expected} onChange={(e) => { const newCases = [...customTestCases]; newCases[idx].expected = e.target.value; setCustomTestCases(newCases); }} className={styles.editableInput} rows={2} />
                  </div>
                  <button className={styles.deleteButton} onClick={() => setCustomTestCases((prev) => prev.filter((_, i) => i !== idx))}><FiTrash2 /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
                const passed = entry.summary.passedCount;
                const total = entry.summary.totalCount;
                const allPassed = passed === total;
                const executedAt = new Date(entry.executedAt);
                const diffMs = Date.now() - executedAt.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                let timeAgo = '';
                if (diffMins < 1) timeAgo = 'just now';
                else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
                else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
                else timeAgo = `${diffDays}d ago`;
                const getLanguageIcon = () => {
                  const l = entry.language.toLowerCase();
                  if (l === 'python') return <FaPython size={14} />;
                  if (l === 'cpp') return <SiCplusplus size={14} />;
                  return null;
                };
                return (
                  <div key={entry._id} className={styles.historyEntry}>
                    <div className={styles.historyEntryLine}>
                      <div className={styles.historyEntryDot} />
                      {idx !== initialHistory.length - 1 && <div className={styles.historyEntryConnector} />}
                    </div>
                    <div className={styles.historyEntryContent}>
                      <div className={styles.historyEntryHeader}>
                        <div className={styles.historyEntryLanguage}>{getLanguageIcon()} <span>{entry.language}</span></div>
                        <div className={styles.historyEntryTime}><FiClock size={12} /> <span>{timeAgo}</span></div>
                      </div>
                      <div className={styles.historyEntryFooter}>
                        <span className={allPassed ? styles.historyEntrySuccess : styles.historyEntryFailure}>{allPassed ? '✓ All tests passed' : `${passed}/${total} passed`}</span>
                        <button className={styles.historyLoadButton} onClick={() => {
                          let frontendLang = entry.language;
                          if (frontendLang === 'python3') frontendLang = 'python';
                          else if (frontendLang === 'c++') frontendLang = 'cpp';
                          skipStarterLoad.current = true;
                          setLanguage(frontendLang);
                          persistLanguage(frontendLang);
                          setCode(entry.code);
                          onCodeChange?.(entry.code);
                          persistCode(entry.code, frontendLang);
                          onTabChange('code');
                          toast.success('Code loaded');
                          setTimeout(() => { skipStarterLoad.current = false; }, 100);
                        }}><FiUpload size={12} /> Load code</button>
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
          {isRunning ? (
            <div className={styles.resultsLoading}>
              <div className={styles.spinner}></div>
              <p>Running your code...</p>
            </div>
          ) : executionError ? (
            <div className={styles.resultCard}>
              <div className={styles.resultHeader}>
                <span className={styles.resultFailedIcon}><FiXCircle /></span>
                <span className={styles.resultLabel}>Compilation / Runtime Error</span>
              </div>
              <div className={styles.resultError}><pre className={styles.resultErrorValue}>{executionError}</pre></div>
            </div>
          ) : !results || results.length === 0 ? (
            <div className={styles.resultsEmpty}>Run your code to see results here.</div>
          ) : (
            <>
              <div className={styles.resultSummaryTop}>{passedCount} / {totalCount} passed</div>
              <div className={styles.resultsList}>
                {results.map((res, idx) => {
                  const errorType = res.error ? getErrorType(res.error) : null;
                  const isCompilationError = errorType === 'compilation';
                  const isRuntimeError = errorType === 'runtime';
                  return (
                    <div key={idx} className={styles.resultCard}>
                      <div className={styles.resultHeader}>
                        <span className={res.passed ? styles.resultPassedIcon : styles.resultFailedIcon}>{res.passed ? <FiCheckCircle /> : <FiXCircle />}</span>
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
                          <div className={styles.resultDetailLabel}>{isCompilationError ? 'Compilation Error:' : isRuntimeError ? 'Runtime Error:' : 'Error:'}</div>
                          <pre className={styles.resultErrorValue}>{res.error}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};