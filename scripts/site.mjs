/**
 * Builds the documentation website (GitHub Pages) from the Markdown docs, in every language.
 *
 *   node scripts/site.mjs            → site/
 *
 * Everything project specific is in site.config.json:
 *   title, tagline, repo, branch, install, highlights[], languages[{ code, label, dir, index }],
 *   copy[] (files and folders published as they are, e.g. live examples), backendPages[], hero,
 *   official { label, url } (the project's own website, when the docs are a mirror of it)
 *
 * Pages keep the anchors GitHub gives headings, so links between pages work the same on GitHub and
 * on the site. Links to other files of the repository point at GitHub, unless the file is published.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const out = join(root, 'site');
const toPosix = path => path.split(sep).join('/');
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** GitHub's heading anchors: lower case, punctuation removed, spaces to dashes, repeats numbered */
function slugger() {
    const seen = new Map();
    return text => {
        const base = text.replace(/<[^>]+>/g, '').replace(/`/g, '').trim().toLowerCase()
            .replace(/&[a-z]+;|&#\d+;/g, '')
            .replace(/[^\p{L}\p{N}\-_ ]/gu, '')
            .replace(/ /g, '-');
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        return count ? `${base}-${count}` : base;
    };
}

// ---------------------------------------------------------------- pages of every language

const languages = config.languages.map(lang => {
    const dir = join(root, lang.dir);
    const files = readdirSync(dir).filter(name => name.endsWith('.md'));
    const index = lang.index ?? 'README.md';
    // the menu follows the order of the links in the index page
    const indexText = readFileSync(join(dir, index), 'utf8');
    const order = [];
    for (const [, label, target] of indexText.matchAll(/\[([^\]]+)\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
        // only pages of this language: the switch to the other language links outside the folder
        if (target.includes('/')) continue;
        if (files.includes(target) && target !== index && !order.some(entry => entry.name === target)) order.push({ name: target, label: label.replace(/`/g, '') });
    }
    for (const name of files.sort()) {
        if (name !== index && !order.some(entry => entry.name === name)) order.push({ name, label: titleOf(join(dir, name)) });
    }
    return { ...lang, path: dir, index, pages: order, files };
});

function titleOf(file) {
    const match = readFileSync(file, 'utf8').match(/^#\s+(.+)$/m);
    return match ? match[1].replace(/`/g, '') : posix.basename(file, '.md');
}

const pageFile = (lang, name) => `${lang.code}/${name === lang.index ? 'index' : name.replace(/\.md$/, '')}.html`;
const published = path => config.copy.some(entry => path === entry || path.startsWith(`${entry.replace(/\/$/, '')}/`));

/** Site path of a repository path, or a GitHub URL */
function linkTarget(repoPath) {
    for (const lang of languages) {
        const relativeToLang = toPosix(relative(lang.path, join(root, repoPath)));
        if (!relativeToLang.startsWith('..') && !relativeToLang.includes('/') && lang.files.includes(relativeToLang)) {
            return { site: pageFile(lang, relativeToLang) };
        }
    }
    if (published(repoPath) || repoPath.startsWith('docs/assets/')) return { site: repoPath };
    const isDir = existsSync(join(root, repoPath)) && statSync(join(root, repoPath)).isDirectory();
    return { url: `${config.repo}/${isDir ? 'tree' : 'blob'}/${config.branch}/${repoPath}` };
}

function renderPage(lang, name) {
    const source = join(lang.path, name);
    const markdown = readFileSync(source, 'utf8')
        // the language line of an index page is replaced by the switcher of the layout
        .replace(/^\*\*English\*\* · \[Português \(Brasil\)\]\([^)]*\)\s*$/m, '')
        .replace(/^\[English\]\([^)]*\) · \*\*Português \(Brasil\)\*\*\s*$/m, '');
    const slug = slugger();
    const headings = [];
    const here = pageFile(lang, name);
    const marked = new Marked({
        gfm: true,
        renderer: {
            heading({ tokens, depth, text }) {
                const html = this.parser.parseInline(tokens);
                const id = slug(text);
                if (depth === 2 || depth === 3) headings.push({ depth, id, html });
                return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${html}</h${depth}>\n`;
            },
            link({ href, title, tokens }) {
                const text = this.parser.parseInline(tokens);
                return `<a href="${escape(rewrite(href))}"${title ? ` title="${escape(title)}"` : ''}>${text}</a>`;
            },
            image({ href, title, text }) {
                return `<img src="${escape(rewrite(href))}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ''} loading="lazy">`;
            },
            code({ text, lang: language }) {
                const cls = language ? ` class="language-${escape(language.split(/\s/)[0])}"` : '';
                return `<pre><button class="copy" type="button" aria-label="Copy">⧉</button><code${cls}>${escape(text)}</code></pre>\n`;
            },
            table(token) {
                return `<div class="table">${this.constructor.prototype.table.call(this, token)}</div>`;
            }
        }
    });

    function rewrite(href) {
        if (/^([a-z]+:|#|\/\/)/i.test(href)) return href;
        const [path, hash] = href.split('#');
        const repoPath = toPosix(relative(root, resolve(dirname(source), path)));
        const target = linkTarget(repoPath);
        if (target.url) return target.url + (hash ? `#${hash}` : '');
        return toPosix(posix.relative(posix.dirname(here), target.site)) + (hash ? `#${hash}` : '');
    }

    const body = marked.parse(markdown);
    return { html: body, headings, title: titleOf(source) };
}

// ---------------------------------------------------------------- layout

const css = `
:root{--bg:#fff;--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--soft:#f6f8fa;--accent:#0969da;--accent-fg:#fff;--code:#f6f8fa;--side:280px}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--line:#30363d;--soft:#151b23;--accent:#4493f8;--accent-fg:#0d1117;--code:#151b23}}
*{box-sizing:border-box}html{scroll-padding-top:72px}
body{margin:0;font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg)}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
header.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:16px;height:60px;padding:0 20px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px)}
header.top .brand{font-weight:700;font-size:18px;color:var(--fg)}header.top .brand small{font-weight:400;color:var(--muted);margin-left:8px}
header.top nav{margin-left:auto;display:flex;gap:14px;align-items:center;font-size:14px}
header.top select{font:inherit;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
.menu-toggle{display:none;font:inherit;background:none;border:1px solid var(--line);border-radius:6px;color:var(--fg);padding:4px 10px}
.layout{display:grid;grid-template-columns:var(--side) minmax(0,1fr) 220px;max-width:1440px;margin:0 auto}
aside.side{position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto;padding:20px 12px 40px 20px;border-right:1px solid var(--line)}
aside.side input{width:100%;font:inherit;font-size:14px;padding:6px 10px;margin-bottom:12px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
aside.side a{display:block;padding:5px 10px;border-radius:6px;color:var(--fg);font-size:14.5px}
aside.side a:hover{background:var(--soft);text-decoration:none}aside.side a.current{background:var(--soft);color:var(--accent);font-weight:600}
main{padding:28px 40px 80px;min-width:0}
main h1{font-size:2.2em;line-height:1.2;margin:.2em 0 .6em}main h2{margin-top:2em;padding-bottom:.3em;border-bottom:1px solid var(--line)}
main h1,main h2,main h3,main h4{position:relative}.anchor{position:absolute;left:-1em;opacity:0;color:var(--muted)}h1:hover .anchor,h2:hover .anchor,h3:hover .anchor,h4:hover .anchor{opacity:1}
code{font:0.88em/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--code);padding:.15em .35em;border-radius:5px}
pre{position:relative;background:var(--code);border:1px solid var(--line);border-radius:8px;padding:14px 16px;overflow:auto}pre code,pre code.hljs{background:none;padding:0;font-size:13.5px}
pre .copy{position:absolute;top:6px;right:6px;border:1px solid var(--line);background:var(--bg);color:var(--muted);border-radius:6px;cursor:pointer;opacity:0;font-size:14px}pre:hover .copy{opacity:1}
.table{overflow:auto;margin:1em 0}table{border-collapse:collapse;width:100%;font-size:14.5px}th,td{border:1px solid var(--line);padding:6px 12px;text-align:left;vertical-align:top}th{background:var(--soft)}
blockquote{margin:1em 0;padding:.2em 1em;border-left:4px solid var(--accent);color:var(--muted);background:var(--soft);border-radius:0 6px 6px 0}
img{max-width:100%;border-radius:8px;border:1px solid var(--line)}
aside.toc{position:sticky;top:60px;height:calc(100vh - 60px);overflow:auto;padding:28px 16px;font-size:13.5px}aside.toc b{display:block;color:var(--muted);margin-bottom:8px;font-weight:600}
aside.toc a{display:block;color:var(--muted);padding:3px 0}aside.toc a.d3{padding-left:12px}aside.toc a.active{color:var(--accent)}
.pager{display:flex;justify-content:space-between;gap:16px;margin-top:60px;padding-top:20px;border-top:1px solid var(--line)}.pager a{display:block;padding:12px 16px;border:1px solid var(--line);border-radius:8px;max-width:48%}.pager small{display:block;color:var(--muted)}
.edit{margin-top:24px;font-size:14px}
@media (max-width:1100px){.layout{grid-template-columns:var(--side) minmax(0,1fr)}aside.toc{display:none}}
@media (max-width:760px){.layout{display:block}aside.side{display:none;position:fixed;inset:60px 0 0 0;z-index:4;background:var(--bg);height:auto}body.menu-open aside.side{display:block}.menu-toggle{display:inline-block}main{padding:20px 16px 60px}header.top .brand small{display:none}}
/* landing */
.hero{padding:72px 20px 40px;text-align:center;background:radial-gradient(ellipse at top,color-mix(in srgb,var(--accent) 16%,transparent),transparent 60%)}
.hero h1{font-size:clamp(2.2rem,6vw,3.6rem);line-height:1.1;margin:0 0 16px}.hero p{font-size:1.2rem;color:var(--muted);max-width:760px;margin:0 auto 28px}
.install{display:inline-flex;align-items:center;gap:10px;font:15px ui-monospace,Menlo,monospace;background:var(--code);border:1px solid var(--line);border-radius:8px;padding:10px 16px}
.buttons{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin:28px 0 0}.buttons a{padding:11px 22px;border-radius:8px;border:1px solid var(--line);font-weight:600;color:var(--fg)}.buttons a.primary{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
.shot{max-width:1100px;margin:40px auto 0;padding:0 20px}.shot img{box-shadow:0 20px 50px rgba(0,0,0,.18)}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;max-width:1100px;margin:56px auto;padding:0 20px}
.features div{border:1px solid var(--line);border-radius:10px;padding:18px 20px;background:var(--soft)}.features b{display:block;margin-bottom:6px;font-size:1.05rem}.features span{color:var(--muted);font-size:15px}
footer{border-top:1px solid var(--line);padding:24px;text-align:center;color:var(--muted);font-size:14px}
`;

const script = `
document.querySelector('.menu-toggle')?.addEventListener('click',()=>document.body.classList.toggle('menu-open'));
document.querySelectorAll('pre .copy').forEach(b=>b.addEventListener('click',()=>{navigator.clipboard?.writeText(b.nextElementSibling.textContent);b.textContent='✓';setTimeout(()=>b.textContent='⧉',1200)}));
const filter=document.querySelector('aside.side input');filter?.addEventListener('input',()=>{const q=filter.value.toLowerCase();document.querySelectorAll('aside.side a').forEach(a=>a.hidden=!a.textContent.toLowerCase().includes(q))});
document.querySelector('header.top select')?.addEventListener('change',e=>{try{localStorage.setItem('docs-lang',e.target.selectedOptions[0].dataset.lang)}catch{}location.href=e.target.value});
const links=[...document.querySelectorAll('aside.toc a')];if(links.length){const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){links.forEach(l=>l.classList.toggle('active',l.hash==='#'+en.target.id))}})},{rootMargin:'0px 0px -70% 0px'});document.querySelectorAll('main h2[id],main h3[id]').forEach(h=>io.observe(h))}
if(window.hljs)hljs.highlightAll();
`;

const head = (title, description, depth) => `<!doctype html>
<html lang="__LANG__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${config.hero?.image ? `<meta property="og:image" content="${escape(config.site.replace(/\/$/, ''))}/${escape(config.hero.image)}">` : ''}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${config.icon ?? '▦'}</text></svg>">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
<link rel="stylesheet" href="${'../'.repeat(depth)}assets/site.css">
</head>`;

const scripts = depth => `<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="${'../'.repeat(depth)}assets/site.js"></script>`;

function topBar(lang, name, depth) {
    const options = languages.map(other => {
        const target = other.files.includes(name) || name === lang.index ? pageFile(other, name === lang.index ? other.index : name) : pageFile(other, other.index);
        return `<option value="${'../'.repeat(depth)}${target}" data-lang="${other.code}"${other.code === lang.code ? ' selected' : ''}>${escape(other.label)}</option>`;
    }).join('');
    return `<header class="top">
<button class="menu-toggle" type="button" aria-label="Menu">☰</button>
<a class="brand" href="${'../'.repeat(depth)}index.html">${escape(config.title)}<small>${escape(lang.docsLabel ?? '')}</small></a>
<nav>
${config.official ? `<a href="${escape(config.official.url)}"><b>${escape(config.official.label)}</b></a>` : ''}
${(lang.links ?? []).map(link => `<a href="${link.href.startsWith('http') ? link.href : '../'.repeat(depth) + link.href}">${escape(link.label)}</a>`).join('\n')}
<a href="${config.repo}">GitHub</a>
<select aria-label="Language">${options}</select>
</nav>
</header>`;
}

// ---------------------------------------------------------------- build

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'assets/site.css'), css);
writeFileSync(join(out, 'assets/site.js'), script);
writeFileSync(join(out, '.nojekyll'), '');

let pages = 0;
for (const lang of languages) {
    mkdirSync(join(out, lang.code), { recursive: true });
    const all = [{ name: lang.index, label: lang.home ?? 'Home' }, ...lang.pages];
    all.forEach((entry, position) => {
        const { html, headings, title } = renderPage(lang, entry.name);
        const nav = all.map(item => `<a href="${posix.basename(pageFile(lang, item.name))}"${item.name === entry.name ? ' class="current"' : ''}>${escape(item.label)}</a>`).join('\n');
        const toc = headings.length > 1
            ? `<aside class="toc"><b>${escape(lang.onThisPage ?? 'On this page')}</b>${headings.map(h => `<a class="d${h.depth}" href="#${h.id}">${h.html.replace(/<[^>]+>/g, '')}</a>`).join('')}</aside>`
            : '<aside class="toc"></aside>';
        const prev = all[position - 1];
        const next = all[position + 1];
        const pager = `<nav class="pager">${prev ? `<a href="${posix.basename(pageFile(lang, prev.name))}"><small>← ${escape(lang.previous ?? 'Previous')}</small>${escape(prev.label)}</a>` : '<span></span>'}${next ? `<a href="${posix.basename(pageFile(lang, next.name))}" style="text-align:right"><small>${escape(lang.next ?? 'Next')} →</small>${escape(next.label)}</a>` : ''}</nav>`;
        const edit = `<p class="edit"><a href="${config.repo}/edit/${config.branch}/${toPosix(relative(root, join(lang.path, entry.name)))}">${escape(lang.edit ?? 'Edit this page on GitHub')}</a></p>`;
        const doc = `${head(`${title} · ${config.title}`, lang.tagline ?? config.tagline, 1).replace('__LANG__', lang.code)}
<body>
${topBar(lang, entry.name, 1)}
<div class="layout">
<aside class="side"><input type="search" placeholder="${escape(lang.filter ?? 'Filter')}" aria-label="${escape(lang.filter ?? 'Filter')}">
${nav}
</aside>
<main>
${html}
${pager}
${edit}
</main>
${toc}
</div>
${scripts(1)}
</body>
</html>`;
        writeFileSync(join(out, pageFile(lang, entry.name)), doc);
        pages++;
    });
}

// files published as they are (live examples, bundles, images)
for (const entry of config.copy) {
    const from = join(root, entry);
    if (!existsSync(from)) throw new Error(`site.config.json copy: ${entry} does not exist (build first?)`);
    cpSync(from, join(out, entry), { recursive: true, filter: path => !path.endsWith('.map') });
}
if (existsSync(join(root, 'docs/assets'))) cpSync(join(root, 'docs/assets'), join(out, 'docs/assets'), { recursive: true });

// published HTML pages that link to the Markdown docs link to the site pages instead
const walk = path => statSync(path).isDirectory() ? readdirSync(path).flatMap(name => walk(join(path, name))) : [path];
for (const entry of config.copy) {
    for (const file of walk(join(out, entry)).filter(path => path.endsWith('.html'))) {
        const repoFile = toPosix(relative(out, file));
        const text = readFileSync(file, 'utf8').replace(/href="([^"#:]+\.md)(#[^"]*)?"/g, (match, path, hash = '') => {
            const target = linkTarget(posix.normalize(posix.join(posix.dirname(repoFile), path)));
            return `href="${target.url ?? posix.relative(posix.dirname(repoFile), target.site)}${hash}"`;
        });
        writeFileSync(file, text);
    }
}

// pages that need a backend explain how to run them
for (const page of config.backendPages ?? []) {
    const file = join(out, page);
    if (!existsSync(file)) continue;
    const note = `<div style="margin:0 0 16px;padding:12px 16px;border-radius:8px;background:#fff4ce;color:#3b2f00;border:1px solid #e6c200;font:15px/1.5 system-ui,sans-serif">${config.backendNote}</div>`;
    writeFileSync(file, readFileSync(file, 'utf8').replace(/<main>/, `<main>\n${note}`));
}

// landing page
const hero = config.hero ?? {};
const landingLang = languages[0];
const landing = `${head(`${config.title} · ${config.tagline}`, config.tagline, 0).replace('__LANG__', landingLang.code)}
<body>
<header class="top"><a class="brand" href="index.html">${escape(config.title)}</a><nav>
${languages.map(lang => `<a href="${lang.code}/index.html">${escape(lang.label)}</a>`).join('\n')}
<a href="${config.repo}">GitHub</a></nav></header>
<section class="hero">
<h1>${escape(config.title)}</h1>
<p>${escape(config.tagline)}</p>
<span class="install">$ ${escape(config.install)}</span>
<div class="buttons">
${languages.map((lang, i) => `<a class="${i === 0 ? 'primary' : ''}" href="${lang.code}/index.html">${escape(lang.docsLabel ?? lang.label)}</a>`).join('\n')}
${config.official ? `<a href="${escape(config.official.url)}">${escape(config.official.label)}</a>` : ''}
${(hero.buttons ?? []).map(button => `<a href="${escape(button.href)}">${escape(button.label)}</a>`).join('\n')}
</div>
</section>
${hero.image ? `<div class="shot"><img src="${escape(hero.image)}" alt="${escape(hero.alt ?? config.title)}"></div>` : ''}
<section class="features">
${(config.highlights ?? []).map(item => `<div><b>${escape(item.title)}</b><span>${escape(item.text)}</span></div>`).join('\n')}
</section>
<footer>${escape(config.footer ?? '')}${config.official ? ` · <a href="${escape(config.official.url)}">${escape(config.official.label)}</a>` : ''} · <a href="${config.repo}">GitHub</a></footer>
<script>
// a visitor whose browser speaks Portuguese sees the Portuguese button first
try { const saved = localStorage.getItem('docs-lang'); const lang = saved || navigator.language;
  const match = [...document.querySelectorAll('.buttons a')].find(a => lang && a.getAttribute('href').startsWith(lang.startsWith('pt') ? 'pt' : 'en'));
  if (match) { document.querySelectorAll('.buttons a').forEach(a => a.classList.remove('primary')); match.classList.add('primary'); match.parentElement.prepend(match); } } catch {}
</script>
</body>
</html>`;
writeFileSync(join(out, 'index.html'), landing);
// GitHub Pages serves 404.html at any missing URL: absolute links keep working there
const base = config.site.replace(/\/?$/, '/');
writeFileSync(join(out, '404.html'), landing.replace(/(href|src)="(?!https?:|data:|#)([^"]+)"/g, (match, attr, path) => `${attr}="${base}${path}"`));

console.log(`site/ built: ${pages} pages in ${languages.length} languages, ${config.copy.length} published paths`);
