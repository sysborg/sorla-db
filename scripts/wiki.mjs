/**
 * Builds the GitHub wiki pages from the Markdown docs, in every language of site.config.json.
 *
 *   node scripts/wiki.mjs                 → wiki/ (Home.md, _Sidebar.md, _Footer.md and one page per doc)
 *   node scripts/wiki.mjs --push          → also commits and pushes wiki/ to <repo>.wiki.git
 *
 * A wiki is flat: pages of the first language keep their title as name ("Getting-started"), the
 * others get a prefix ("PT-Primeiros-passos"). Links between docs become wiki links, links to other
 * files of the repository and images point at GitHub, since the wiki cannot see the repository.
 * The wiki must exist: create its first page once on GitHub (Wiki → Create the first page).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));
const out = join(root, 'wiki');
const toPosix = path => path.split(sep).join('/');
const raw = `${config.repo.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/${config.branch}`;

/** A wiki page name from a title: spaces to dashes, characters wikis do not like removed */
const pageName = (title, prefix) => `${prefix}${title}`.replace(/&/g, 'and').replace(/[`*"?#%\\/:<>|()[\],.;']/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');

function titleOf(file) {
    const match = readFileSync(file, 'utf8').match(/^#\s+(.+)$/m);
    return match ? match[1].replace(/`/g, '') : posix.basename(file, '.md');
}

const languages = config.languages.map((lang, position) => {
    const dir = join(root, lang.dir);
    const files = readdirSync(dir).filter(name => name.endsWith('.md'));
    const index = lang.index ?? 'README.md';
    const prefix = position === 0 ? '' : `${lang.wikiPrefix ?? lang.code.split('-')[0].toUpperCase()}-`;
    const order = [];
    for (const [, label, target] of readFileSync(join(dir, index), 'utf8').matchAll(/\[([^\]]+)\]\(([^)#\s]+\.md)(?:#[^)]*)?\)/g)) {
        if (target.includes('/') || !files.includes(target) || target === index || order.some(entry => entry.file === target)) continue;
        order.push({ file: target, label: label.replace(/`/g, '') });
    }
    for (const file of files.sort()) {
        if (file !== index && !order.some(entry => entry.file === file)) order.push({ file, label: titleOf(join(dir, file)) });
    }
    // index pages become "<Overview>" pages; the others are named after their title
    const pages = new Map([[index, pageName(lang.home ?? 'Overview', prefix)]]);
    for (const entry of order) pages.set(entry.file, pageName(titleOf(join(dir, entry.file)), prefix));
    return { ...lang, path: dir, index, prefix, order, pages };
});

// page names must be unique across languages
const seen = new Set();
for (const lang of languages) {
    for (const name of lang.pages.values()) {
        if (seen.has(name)) throw new Error(`Two wiki pages would be named "${name}"`);
        seen.add(name);
    }
}

/** Wiki target of a repository path: a wiki page, or a GitHub / raw URL */
function target(repoPath, image) {
    for (const lang of languages) {
        const inLang = toPosix(relative(lang.path, join(root, repoPath)));
        if (!inLang.includes('/') && lang.pages.has(inLang)) return lang.pages.get(inLang);
    }
    if (image) return `${raw}/${repoPath}`;
    const published = (config.copy ?? []).some(entry => repoPath === entry || repoPath.startsWith(`${entry.replace(/\/$/, '')}/`));
    if (published && config.site) return `${config.site.replace(/\/?$/, '/')}${repoPath}`;
    return `${config.repo}/blob/${config.branch}/${repoPath}`;
}

function convert(lang, file) {
    const source = join(lang.path, file);
    let text = readFileSync(source, 'utf8')
        .replace(/^\*\*English\*\* · \[Português \(Brasil\)\]\([^)]*\)\s*$/m, '')
        .replace(/^\[English\]\([^)]*\) · \*\*Português \(Brasil\)\*\*\s*$/m, '');
    // rewrite links outside code blocks only
    const parts = text.split(/(^```[\s\S]*?^```)/m);
    text = parts.map((part, i) => i % 2 ? part : part.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (match, bang, label, href) => {
        if (/^([a-z]+:|#|\/\/)/i.test(href)) return match;
        const [path, hash] = href.split('#');
        const repoPath = toPosix(relative(root, resolve(dirname(source), path)));
        return `${bang}[${label}](${target(repoPath, !!bang)}${hash ? `#${hash}` : ''})`;
    })).join('');
    return text.trim() + '\n';
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let count = 0;
for (const lang of languages) {
    for (const [file, name] of lang.pages) {
        writeFileSync(join(out, `${name}.md`), convert(lang, file));
        count++;
    }
}

// Home: every language, with its table of contents
const home = [`# ${config.title}`, '', config.tagline, ''];
if (config.site) home.push(`🌐 **Website:** ${config.site} · 📦 \`${config.install}\``, '');
for (const lang of languages) {
    home.push(`## ${lang.label}`, '');
    if (lang.tagline && lang !== languages[0]) home.push(lang.tagline, '');
    home.push(`- **[${lang.home ?? 'Overview'}](${lang.pages.get(lang.index)})**`);
    for (const entry of lang.order) home.push(`- [${entry.label}](${lang.pages.get(entry.file)})`);
    home.push('');
}
writeFileSync(join(out, 'Home.md'), home.join('\n'));

const sidebar = [`**[${config.title}](Home)**`, ''];
for (const lang of languages) {
    sidebar.push(`**${lang.label}**`, '', `- [${lang.home ?? 'Overview'}](${lang.pages.get(lang.index)})`);
    for (const entry of lang.order) sidebar.push(`- [${entry.label}](${lang.pages.get(entry.file)})`);
    sidebar.push('');
}
writeFileSync(join(out, '_Sidebar.md'), sidebar.join('\n'));
writeFileSync(join(out, '_Footer.md'), [config.site ? `[Website](${config.site})` : '', `[Repository](${config.repo})`, config.footer ?? ''].filter(Boolean).join(' · ') + '\n');

console.log(`wiki/ built: ${count + 3} pages in ${languages.length} languages`);

if (process.argv.includes('--push')) {
    const remote = `${config.repo.replace('https://github.com/', 'git@github.com:')}.wiki.git`;
    const work = join(root, '.wiki-checkout');
    rmSync(work, { recursive: true, force: true });
    try {
        execFileSync('git', ['clone', '--quiet', remote, work], { stdio: 'inherit' });
    } catch {
        throw new Error(`Could not clone ${remote}. Create the first page of the wiki on GitHub once, then run this again.`);
    }
    // the wiki mirrors the docs: pages that no longer exist are removed
    for (const name of readdirSync(work)) if (name.endsWith('.md')) rmSync(join(work, name));
    for (const name of readdirSync(out)) writeFileSync(join(work, name), readFileSync(join(out, name)));
    const git = (...args) => execFileSync('git', ['-C', work, ...args], { encoding: 'utf8' });
    git('add', '-A');
    if (!git('status', '--porcelain').trim()) {
        console.log('The wiki is already up to date');
    } else {
        git('commit', '--quiet', '-m', `docs: update the wiki from the docs (${execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()})`);
        git('push', '--quiet', 'origin', 'HEAD');
        console.log(`Pushed to ${remote}`);
    }
    rmSync(work, { recursive: true, force: true });
    if (existsSync(work)) throw new Error('Could not remove the wiki checkout');
}
