import { siteContent } from '../assets/content.js';
import { directories, helpRows, pages } from './terminal.js';

function CommandButton({ label, command, className = 'inline-command', onCommand }) {
  return (
    <button
      type="button"
      className={className}
      data-command={command}
      aria-label={`执行 ${command}`}
      onClick={() => onCommand(command)}
    >
      {label}
    </button>
  );
}

function DirectoryListing({ onCommand }) {
  return (
    <div className="directory-list">
      {directories.map(({ route, description }) => (
        <div className="directory-row" key={route}>
          <CommandButton label={`${route}/`} command={`cd ${route}`} className="directory-command" onCommand={onCommand} />
          <span className="directory-description">{description}</span>
        </div>
      ))}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-key">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

export function externalUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function ContentListing({ items, emptyMessage }) {
  if (!items.length) return <p className="empty-state">{emptyMessage}</p>;

  return (
    <div className="content-list">
      {items.map((item, index) => {
        const safeUrl = externalUrl(item.url);
        return (
          <article className="content-row" key={`${item.title}-${index}`}>
            <span className="content-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="content-body">
              {safeUrl
                ? <a className="content-title" href={safeUrl} target="_blank" rel="noopener noreferrer">{item.title}</a>
                : <span className="content-title">{item.title}</span>}
              {item.description && <p className="content-description">{item.description}</p>}
            </div>
            {safeUrl && <span className="content-arrow" aria-hidden="true">↗</span>}
          </article>
        );
      })}
    </div>
  );
}

function PageResponse({ route, prompt, onCommand }) {
  const page = pages.get(route);

  return (
    <section className="response page-response">
      <div className="response-meta">
        <span className="file-badge">FILE</span>
        <span className="file-path">{page.file}</span>
      </div>
      <h2 className="page-title">{page.title}</h2>

      {route === '' && (
        <>
          <p className="page-lead">输入 help 查看可用命令，或选择一个目录继续。</p>
          {prompt}
          <DirectoryListing onCommand={onCommand} />
        </>
      )}

      {route === 'about' && (
        <>
          {siteContent.about.map((paragraph, index) => (
            <p className="page-paragraph" key={index}>{paragraph}</p>
          ))}
          <div className="detail-grid">
            <DetailRow label="NAME" value={siteContent.name} />
            <DetailRow label="SITE" value="个人终端" />
            <DetailRow label="STATUS" value="持续完善中" />
          </div>
        </>
      )}

      {route === 'projects' && (
        <>
          <p className="page-lead">这里收集我做过或正在做的项目。</p>
          <ContentListing items={siteContent.projects} emptyMessage="项目档案正在整理中。" />
        </>
      )}

      {route === 'links' && (
        <>
          <p className="page-lead">一些值得访问的网站，会在这里相遇。</p>
          <ContentListing items={siteContent.links} emptyMessage="友情链接正在整理中。" />
        </>
      )}

      {route !== '' && (
        <div className="next-command">
          <CommandButton label="cd .." command="cd .." onCommand={onCommand} />
          <span className="next-explanation">返回首页</span>
        </div>
      )}
    </section>
  );
}

function HelpResponse({ onCommand }) {
  return (
    <section className="response help-response">
      <div className="response-meta">[ MANUAL / COMMANDS ]</div>
      <h2 className="page-title">可用命令</h2>
      <div className="help-table">
        {helpRows.map(([command, description]) => (
          <div className="help-row" key={command}>
            <code className="help-command">{command}</code>
            <span className="help-description">{description}</span>
          </div>
        ))}
      </div>
      <p className="help-examples">
        试试 <CommandButton label="cd projects" command="cd projects" onCommand={onCommand} /> 或{' '}
        <CommandButton label="cd links" command="cd links" onCommand={onCommand} />。
      </p>
    </section>
  );
}

function ListingResponse({ route, onCommand }) {
  return (
    <section className="response listing-response">
      <div className="response-meta">{`[ DIRECTORY /${route ? `${route}/` : ''} ]`}</div>
      {route ? (
        <div className="directory-list">
          <div className="directory-row">
            <CommandButton label="../" command="cd .." className="directory-command" onCommand={onCommand} />
            <span className="directory-description">上一级</span>
          </div>
          <div className="directory-row">
            <CommandButton label="README.md" command="cat README.md" className="directory-command directory-file" onCommand={onCommand} />
            <span className="directory-description">{pages.get(route).title}</span>
          </div>
        </div>
      ) : <DirectoryListing onCommand={onCommand} />}
    </section>
  );
}

function HistoryResponse({ commands }) {
  return (
    <section className="response history-response">
      <div className="response-meta">[ SESSION / HISTORY ]</div>
      {commands.map((command, index) => (
        <div className="history-row" key={index}>
          <span className="history-number">{String(index + 1).padStart(2, '0')}</span>
          <span>{command}</span>
        </div>
      ))}
    </section>
  );
}

function Notice({ message, error = false }) {
  return <p className={error ? 'notice notice-error' : 'notice'}>{message}</p>;
}

export function Response({ response, prompt, onCommand }) {
  if (!response) return null;

  switch (response.type) {
    case 'page':
      return (
        <>
          {response.notice && <Notice message={response.notice} />}
          <PageResponse route={response.route} prompt={prompt} onCommand={onCommand} />
        </>
      );
    case 'help':
      return <HelpResponse onCommand={onCommand} />;
    case 'listing':
      return <ListingResponse route={response.route} onCommand={onCommand} />;
    case 'history':
      return <HistoryResponse commands={response.commands} />;
    case 'notice':
      return <Notice message={response.message} error={response.error} />;
    case 'completion':
      return <Notice message={response.message} />;
    default:
      return null;
  }
}
