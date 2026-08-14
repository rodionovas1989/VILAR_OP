import { useMemo, useState } from 'react';
import { canViewObject } from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import { USER_GUIDE_FAQ, USER_GUIDE_SECTIONS } from '../content/userGuide';
import { GuideBlock, blocksToSearchText } from '../content/userGuideTypes';
import AccessDenied from './AccessDenied';
import PageTitle from './PageTitle';

const PAGE_ID = 'admin_user_guide';

type TabId = 'manual' | 'faq';

function matchesQuery(query: string, ...parts: string[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => p.toLowerCase().includes(q));
}

function GuideBlocks({ blocks }: { blocks: GuideBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'p') {
          return <p key={i}>{block.text}</p>;
        }
        if (block.type === 'ul') {
          return (
            <ul key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'callout') {
          return (
            <div key={i} className={`user-guide-callout is-${block.tone}`} role="note">
              {block.text}
            </div>
          );
        }
        if (block.type === 'flow') {
          return (
            <ol key={i} className="user-guide-flow">
              {block.items.map((item, j) => (
                <li key={j}>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <div key={i} className="user-guide-table-wrap">
            <table className="user-guide-table">
              <thead>
                <tr>
                  {block.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

export default function UserGuidePage() {
  const { user } = useAuth();
  const canView = canViewObject(user?.permissions, PAGE_ID, Boolean(user));
  const [tab, setTab] = useState<TabId>('manual');
  const [query, setQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<Set<string>>(new Set());

  const filteredSections = useMemo(() => {
    return USER_GUIDE_SECTIONS.filter((section) =>
      matchesQuery(query, section.title, blocksToSearchText(section.blocks))
    );
  }, [query]);

  const filteredFaq = useMemo(() => {
    return USER_GUIDE_FAQ.filter((item) =>
      matchesQuery(query, item.q, blocksToSearchText(item.blocks))
    );
  }, [query]);

  const searchActive = Boolean(query.trim());

  const toggleFaq = (id: string) => {
    setOpenFaq((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`guide-section-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const printGuide = () => {
    window.print();
  };

  if (!canView) {
    return <AccessDenied title="Руководство пользователя" />;
  }

  return (
    <div className="page user-guide-page">
      <div className="page-toolbar guide-no-print">
        <PageTitle pageId={PAGE_ID} title="Руководство пользователя" />
        <div className="toolbar-actions">
          <button type="button" className="ghost" onClick={printGuide}>
            Печать
          </button>
        </div>
      </div>

      <h2 className="report-print-title">Руководство пользователя</h2>

      <p className="hint guide-no-print">
        Для тех, кто ещё не работал в системе: сначала прочитайте инструкцию по порядку, затем держите
        рядом «Вопросы и ответы». Поиск ищет сразу в обоих разделах.
      </p>

      <div className="tabs guide-no-print">
        <button type="button" className={tab === 'manual' ? 'active' : ''} onClick={() => setTab('manual')}>
          Инструкция
        </button>
        <button type="button" className={tab === 'faq' ? 'active' : ''} onClick={() => setTab('faq')}>
          Вопросы и ответы
        </button>
      </div>

      <div className="user-guide-search guide-no-print">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по инструкции и вопросам…"
          aria-label="Поиск по руководству"
        />
        {searchActive && (
          <button type="button" className="ghost" onClick={() => setQuery('')}>
            Сбросить
          </button>
        )}
      </div>

      <div className="user-guide-layout">
        {tab === 'manual' && (
          <nav className="user-guide-toc guide-no-print" aria-label="Оглавление">
            <div className="user-guide-toc-title">Содержание</div>
            {filteredSections.length === 0 && <p className="hint">Ничего не найдено</p>}
            {filteredSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className="user-guide-toc-item"
                onClick={() => scrollToSection(section.id)}
              >
                {section.title}
              </button>
            ))}
          </nav>
        )}

        <div className="user-guide-body">
          <div className={`user-guide-pane${tab === 'manual' ? ' is-active' : ''}`}>
            <h2 className="user-guide-print-heading">Инструкция</h2>
            {filteredSections.length === 0 && <p className="hint">По запросу ничего не найдено.</p>}
            {filteredSections.map((section) => (
              <section
                key={section.id}
                id={`guide-section-${section.id}`}
                className="user-guide-section"
              >
                <h2>{section.title}</h2>
                <GuideBlocks blocks={section.blocks} />
              </section>
            ))}
          </div>

          <div className={`user-guide-pane${tab === 'faq' ? ' is-active' : ''}`}>
            <h2 className="user-guide-print-heading">Вопросы и ответы</h2>
            {filteredFaq.length === 0 && <p className="hint">По запросу ничего не найдено.</p>}
            {filteredFaq.map((item) => {
              const open = searchActive || openFaq.has(item.id);
              return (
                <article key={item.id} className={`user-guide-faq${open ? ' is-open' : ''}`}>
                  <button type="button" className="user-guide-faq-q" onClick={() => toggleFaq(item.id)}>
                    {item.q}
                  </button>
                  <div className="user-guide-faq-a">
                    <GuideBlocks blocks={item.blocks} />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
