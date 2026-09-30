import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Response } from './Responses.jsx';
import {
  applyCommand,
  applyCompletion,
  applyPopState,
  createInitialState,
  directories,
  displayPath,
  pages,
  projects,
  projectRoute,
  promptTime,
  routeFromLocation,
  routeUrl,
  stepHistory,
} from './terminal.js';

function CommandPrompt({ route, time, draft, inputRef, onChange, onKeyDown, onSubmit }) {
  return (
    <form className="command-form" autoComplete="off" onSubmit={onSubmit}>
      <label className="prompt" htmlFor="command-input">
        <span className="prompt-time">{time}</span>
        <span className="prompt-identity">
          <span className="prompt-user">guest</span><span className="prompt-at">@</span><span className="prompt-host">inxv</span>
        </span>
        <span className="prompt-path">{displayPath(route)}</span>
      </label>
      <div className="command-line">
        <span className="prompt-symbol" aria-hidden="true">%</span>
        <input
          ref={inputRef}
          id="command-input"
          name="command"
          type="text"
          value={draft}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label="输入终端命令"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
        />
      </div>
    </form>
  );
}

function CommandEcho({ echo }) {
  return (
    <div className="command-echo">
      <div className="echo-prompt">
        <span className="prompt-time">{echo.time}</span>{' '}
        <span className="prompt-user">guest</span><span className="prompt-at">@</span><span className="prompt-host">inxv</span>{' '}
        <span className="prompt-path">{displayPath(echo.route)}</span>
      </div>
      <div className="echo-line">
        <span className="prompt-symbol">%</span>
        <span className="echo-command">{echo.command}</span>
      </div>
    </div>
  );
}

function FileExplorer({ route, onCommand }) {
  const explorerRef = useRef(null);

  useLayoutEffect(() => {
    const explorer = explorerRef.current;
    const current = explorer?.querySelector('.tree-file[aria-current="page"]');
    if (!current) return;
    const visible = explorer.getBoundingClientRect();
    const selected = current.getBoundingClientRect();
    if (selected.top < visible.top) explorer.scrollTop -= visible.top - selected.top;
    else if (selected.bottom > visible.bottom) explorer.scrollTop += selected.bottom - visible.bottom;
  }, [route]);

  return (
    <aside ref={explorerRef} className="file-explorer" aria-label="页面文件">
      <nav className="file-tree" aria-label="页面目录">
        <button
          type="button"
          className={`tree-root${route === '' ? ' is-current' : ''}`}
          aria-label="返回根目录"
          data-command="cd /"
          onClick={() => onCommand('cd /')}
        >
          <span className="tree-root-mark" aria-hidden="true">~/</span>
        </button>

        <ul className="tree-directories">
          {directories.map(({ route: pageRoute, description }) => {
            const expanded = route === pageRoute || route.startsWith(`${pageRoute}/`);
            const fileName = pages.get(pageRoute).file.split('/').at(-1);

            return (
              <li className="tree-directory-item" key={pageRoute}>
                <button
                  type="button"
                  className={`tree-directory${route === pageRoute ? ' is-current' : ''}`}
                  aria-label={`进入${description}目录`}
                  aria-expanded={expanded}
                  data-command={`cd ${pageRoute}`}
                  onClick={() => onCommand(`cd ${pageRoute}`)}
                >
                  <span className="tree-chevron" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
                  <span className="tree-directory-name">{pageRoute}/</span>
                </button>
                {expanded && (
                  <ul className="tree-files">
                    <li>
                      <button
                        type="button"
                        className={`tree-file${route === pageRoute ? ' is-current' : ''}`}
                        aria-current={route === pageRoute ? 'page' : undefined}
                        data-command={route === pageRoute ? `cat ${fileName}` : `cd /${pageRoute}`}
                        onClick={() => onCommand(route === pageRoute ? `cat ${fileName}` : `cd /${pageRoute}`)}
                      >
                        <span className="tree-file-mark" aria-hidden="true">md</span>
                        {fileName}
                      </button>
                    </li>
                    {pageRoute === 'projects' && projects.map((project) => (
                      <li key={project.title}>
                        <button
                          type="button"
                          className={`tree-file tree-project${route === projectRoute(project) ? ' is-current' : ''}`}
                          aria-current={route === projectRoute(project) ? 'page' : undefined}
                          title={project.title}
                          data-command={`cd /${projectRoute(project)}`}
                          onClick={() => onCommand(`cd /${projectRoute(project)}`)}
                        >
                          <span className="tree-file-mark" aria-hidden="true">md</span>
                          <span className="tree-file-name">{project.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

const TranscriptBlock = memo(function TranscriptBlock({
  block,
  active,
  route,
  time,
  draft,
  inputRef,
  onChange,
  onKeyDown,
  onSubmit,
  onCommand,
  baseUrl,
}) {
  const prompt = active
    ? <CommandPrompt route={route} time={time} draft={draft} inputRef={inputRef} onChange={onChange} onKeyDown={onKeyDown} onSubmit={onSubmit} />
    : null;

  return (
    <div className={`transcript-block${block.response?.type === 'completion' ? ' completion-block' : ''}`}>
      {block.echo && <CommandEcho echo={block.echo} />}
      <Response response={block.response} onCommand={onCommand} baseUrl={baseUrl} />
      {prompt}
    </div>
  );
});

export default function TerminalApp({ baseUrl }) {
  const isReload = window.performance.getEntriesByType?.('navigation')?.[0]?.type === 'reload';
  const [view, setView] = useState(() => createInitialState(
    isReload ? '' : routeFromLocation(window.location.pathname, baseUrl.pathname),
    promptTime(),
  ));
  const viewRef = useRef(view);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const focusAfterUpdate = useRef(false);

  const commit = useCallback((nextView) => {
    viewRef.current = nextView;
    setView(nextView);
  }, []);

  const executeCommand = useCallback((raw, focusInput) => {
    const line = raw.trim();
    if (!line) return;

    const { state, effect } = applyCommand(viewRef.current, line, promptTime());

    if (effect?.type === 'push') {
      window.history.pushState(
        { inxv: true, index: (window.history.state?.index ?? 0) + 1 },
        '',
        routeUrl(effect.route, baseUrl),
      );
    }

    focusAfterUpdate.current = focusInput;
    commit(state);
  }, [baseUrl, commit]);

  const onCommand = useCallback((command) => {
    executeCommand(command, window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, [executeCommand]);

  const onChange = useCallback((event) => {
    commit({ ...viewRef.current, draft: event.target.value });
  }, [commit]);

  const onKeyDown = useCallback((event) => {
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && viewRef.current.commandHistory.length) {
      event.preventDefault();
      const nextView = stepHistory(viewRef.current, event.key === 'ArrowUp' ? 'up' : 'down');
      commit(nextView);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        input?.setSelectionRange(input.value.length, input.value.length);
      });
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const previous = viewRef.current;
      const nextView = applyCompletion(previous);
      if (nextView !== previous) {
        focusAfterUpdate.current = nextView.blocks.length !== previous.blocks.length;
        commit(nextView);
      }
    } else if (event.key === 'Escape') {
      commit({ ...viewRef.current, draft: '' });
    }
  }, [commit]);

  const onSubmit = useCallback((event) => {
    event.preventDefault();
    executeCommand(viewRef.current.draft, true);
  }, [executeCommand]);

  useEffect(() => {
    if (isReload) {
      window.history.replaceState(
        { inxv: true, index: 0 },
        '',
        `${routeUrl('', baseUrl)}${window.location.search}${window.location.hash}`,
      );
    } else if (!window.history.state?.inxv) {
      window.history.replaceState({ inxv: true, index: 0 }, '', window.location.href);
    }

    const onPopState = () => {
      const route = routeFromLocation(window.location.pathname, baseUrl.pathname);
      focusAfterUpdate.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      commit(applyPopState(viewRef.current, route, promptTime()));
    };
    window.addEventListener('popstate', onPopState);

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus({ preventScroll: true });
    }

    return () => window.removeEventListener('popstate', onPopState);
  }, [baseUrl, commit, isReload]);

  useEffect(() => {
    const page = pages.get(view.route);
    document.title = view.route ? `${page.title} | inxv` : 'inxv | terminal';
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description);
  }, [view.route]);

  useLayoutEffect(() => {
    if (terminalRef.current) {
      const projectBlock = terminalRef.current.querySelector('.transcript-block:last-child .page-response:has(.github-activity), .transcript-block:last-child .project-response');
      terminalRef.current.scrollTop = projectBlock
        ? Math.max(0, projectBlock.offsetTop - terminalRef.current.offsetTop - 20)
        : terminalRef.current.scrollHeight;
    }
    if (focusAfterUpdate.current) {
      inputRef.current?.focus({ preventScroll: true });
      focusAfterUpdate.current = false;
    }
  }, [view.scrollVersion]);

  const lastId = view.blocks.at(-1)?.id;
  const promptProps = {
    route: view.route,
    time: view.promptTime,
    draft: view.draft,
    inputRef,
    onChange,
    onKeyDown,
    onSubmit,
  };

  return (
    <div className="terminal-shell">
      <header className="topbar">
        <div className="brand" aria-label="inxv terminal">
          <span className="brand-icon" aria-hidden="true">&gt;_</span>
          <span className="brand-name">inxv</span>
          <span className="brand-divider">/</span>
          <span className="brand-detail">terminal</span>
        </div>
      </header>

      <main ref={terminalRef} className="terminal-output" aria-label="终端">
        <div className="terminal-transcript" role="log" aria-live="polite" aria-label="终端输出">
          {view.blocks.map((block) => (
            <TranscriptBlock
              key={block.id}
              block={block}
              active={block.id === lastId}
              {...promptProps}
              onCommand={onCommand}
              baseUrl={baseUrl}
            />
          ))}
          {!view.blocks.length && (
            <>
              <CommandPrompt {...promptProps} />
              {!view.commandHistory.length && !view.draft && <p className="command-hint">#试试help?</p>}
            </>
          )}
        </div>
      </main>

      <FileExplorer route={view.route} onCommand={onCommand} />
    </div>
  );
}
