import { siteContent } from '../assets/content.js';
import { directories, helpRows, pages, projects, projectRoute, routeUrl } from './terminal.js';
import MarkdownContent from './MarkdownContent.js';
import GitHubActivity from './GitHubActivity.jsx';

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

function DetailRow({ label, value, url }) {
  const safeUrl = externalUrl(url);

  return (
    <div className="detail-row">
      <span className="detail-key">{label}</span>
      <span className="detail-value">
        {safeUrl
          ? <a className="detail-link" href={safeUrl} target="_blank" rel="noopener noreferrer">{value}</a>
          : value}
      </span>
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

function ContentListing({ items, emptyMessage, internal = false, onCommand, baseUrl }) {
  if (!items.length) return <p className="empty-state">{emptyMessage}</p>;

  return (
    <div className="content-list">
      {items.map((item, index) => {
        const safeUrl = internal ? routeUrl(projectRoute(item), baseUrl) : externalUrl(item.url);
        return (
          <article className="content-row" key={`${item.title}-${index}`}>
            <span className="content-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="content-body">
              {safeUrl
                ? <a
                  className="content-title"
                  href={safeUrl}
                  target={internal ? undefined : '_blank'}
                  rel={internal ? undefined : 'noopener noreferrer'}
                  onClick={internal ? (event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    onCommand(`cd /${projectRoute(item)}`);
                  } : undefined}
                >{item.title}</a>
                : <span className="content-title">{item.title}</span>}
              {item.description && <p className="content-description">{item.description}</p>}
            </div>
            {safeUrl && <span className="content-arrow" aria-hidden="true">{internal ? '›' : '↗'}</span>}
          </article>
        );
      })}
    </div>
  );
}

function ProjectResponse({ page, onCommand }) {
  const { project } = page;
  const releaseUrl = externalUrl(project.release?.url);
  const githubUrl = externalUrl(project.url);
  return (
    <section className="response page-response project-response">
      <div className="response-meta"><span className="file-path">{page.file}</span></div>
      <h2 className="page-title">{project.title}</h2>
      {project.description && <p className="page-paragraph project-description">{project.description}</p>}
      <div className="project-summary-meta">
        <dl className="project-stats" aria-label="仓库统计">
          <div><dt>Star</dt><dd>{project.stars ?? 0}</dd></div>
          <div><dt>Fork</dt><dd>{project.forks ?? 0}</dd></div>
        </dl>
        <span className="project-kind">{project.isFork ? 'Fork 仓库' : '自建仓库'}</span>
        {githubUrl && (
          <a
            className="project-github"
            href={githubUrl}
            title={project.url}
            aria-label={`在新标签页打开 ${project.title} 的 GitHub 仓库`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="project-github-label">GitHub</span>
            <svg className="project-github-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
              <path d="M4 12 12 4M5 4h7v7" />
            </svg>
          </a>
        )}
      </div>
      <section className="project-section project-release" aria-label="最新 Release">
        {project.release && releaseUrl ? (
          <>
            <div className="release-meta">
              <h3 className="project-section-title">最新 Release</h3>
              <a className="detail-link" href={releaseUrl} target="_blank" rel="noopener noreferrer">{project.release.name}</a>
              {project.release.name !== project.release.tag && <span>{project.release.tag}</span>}
              <time dateTime={project.release.publishedAt}>{project.release.publishedAt.slice(0, 10)}</time>
            </div>
            {project.release.assets.length > 0 && (
              <ul className="release-assets">
                {project.release.assets.map((asset) => {
                  const url = externalUrl(asset.url);
                  return url && <li key={asset.url}><a className="detail-link" href={url} target="_blank" rel="noopener noreferrer">{asset.name}</a></li>;
                })}
              </ul>
            )}
            {project.release.body && (
              <details className="release-notes">
                <summary>发布说明</summary>
                <MarkdownContent content={project.release.body} project={project} section="release" />
              </details>
            )}
          </>
        ) : <p className="release-empty"><span>最新 Release</span>暂无正式 Release。</p>}
      </section>
      <section className="project-section project-readme" aria-label="项目 README">
        <h3 className="project-section-title">{project.readme?.path || 'README.md'}</h3>
        {project.readme?.content
          ? <MarkdownContent content={project.readme.content} project={project} />
          : <p className="page-paragraph">该仓库暂无 README。</p>}
      </section>
      <div className="next-command">
        <CommandButton label="cd .." command="cd .." onCommand={onCommand} />
        <span className="next-explanation">返回项目列表</span>
      </div>
    </section>
  );
}

function PageResponse({ route, onCommand, baseUrl }) {
  if (route === '') return null;
  const page = pages.get(route);
  if (page.project) return <ProjectResponse page={page} onCommand={onCommand} />;

  return (
    <section className={`response page-response${route === 'projects' ? ' projects-response' : ''}`}>
      <div className="response-meta">
        <span className="file-path">{page.file}</span>
      </div>
      <h2 className="page-title">{page.title}</h2>

      {route === 'about' && (
        <>
          {siteContent.about.map((paragraph, index) => (
            <p className="page-paragraph" key={index}>{paragraph}</p>
          ))}
          <div className="detail-grid">
            <DetailRow label="NAME" value={siteContent.name} />
            {siteContent.profiles.map((profile) => <DetailRow key={profile.label} {...profile} />)}
            <DetailRow label="SITE" value="个人终端" />
            <DetailRow label="STATUS" value="持续完善中" />
          </div>
        </>
      )}

      {route === 'projects' && (
        <>
          <GitHubActivity />
          <ContentListing items={siteContent.projects} emptyMessage="项目档案正在整理中。" internal onCommand={onCommand} baseUrl={baseUrl} />
        </>
      )}

      {route === 'links' && (
        <ContentListing items={siteContent.links} emptyMessage="友情链接正在整理中。" />
      )}

      <div className="next-command">
        <CommandButton label="cd .." command="cd .." onCommand={onCommand} />
        <span className="next-explanation">返回首页</span>
      </div>
    </section>
  );
}

function HelpResponse({ onCommand }) {
  return (
    <section className="response help-response">
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

function ListingResponse({ route }) {
  const entries = route
    ? [
      { name: '../', description: '上一级' },
      { name: 'README.md', description: pages.get(route).title, file: true },
      ...(route === 'projects' ? projects.map((project) => ({ name: `${project.title}/`, description: '' })) : []),
    ]
    : directories.map(({ route: directory, description }) => ({ name: `${directory}/`, description }));

  return (
    <section className="response listing-response">
      <ul className="listing-list" aria-label={`目录 /${route ? `${route}/` : ''}`}>
        {entries.map(({ name, description, file }) => (
          <li className="listing-row" key={name}>
            <span className={`listing-name${file ? ' listing-file' : ''}`}>{name}</span>
            <span className="listing-description">{description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Notice({ message, error = false }) {
  return <p className={error ? 'notice notice-error' : 'notice'}>{message}</p>;
}

export function Response({ response, onCommand, baseUrl }) {
  if (!response) return null;

  switch (response.type) {
    case 'page':
      return (
        <>
          {response.notice && <Notice message={response.notice} />}
          <PageResponse route={response.route} onCommand={onCommand} baseUrl={baseUrl} />
        </>
      );
    case 'help':
      return <HelpResponse onCommand={onCommand} />;
    case 'listing':
      return <ListingResponse route={response.route} />;
    case 'notice':
      return <Notice message={response.message} error={response.error} />;
    case 'completion':
      return <Notice message={response.message} />;
    default:
      return null;
  }
}
