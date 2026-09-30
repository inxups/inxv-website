export function markdownPrefix(project, section = 'readme') {
  return `project-${project.title}-${section}-`;
}

export function markdownUrl(value, project, { image = false, section = 'readme' } = {}) {
  if (!value) return '';
  if (value.startsWith('#') && !image) return `#user-content-${markdownPrefix(project, section)}${value.slice(1)}`;
  const branchRoot = `${project.url}/${image ? 'raw' : 'blob'}/${encodeURIComponent(project.defaultBranch || 'main')}/`;
  const base = section === 'readme' && project.readme
    ? (image ? project.readme.downloadUrl : project.readme.url)
    : `${branchRoot}README.md`;
  try {
    const fromRoot = value.startsWith('/') && !value.startsWith('//');
    const url = new URL(fromRoot ? value.slice(1) : value, fromRoot ? branchRoot : base);
    if (!['http:', 'https:', ...(image ? [] : ['mailto:'])].includes(url.protocol)) return '';
    if (image && url.hostname === 'github.com') url.pathname = url.pathname.replace('/blob/', '/raw/');
    return url.href;
  } catch {
    return '';
  }
}
