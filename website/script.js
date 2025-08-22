/* ByteLab download page script
 * Fetches latest GitHub release and renders DMG download buttons
 */

(async function () {
  const owner = 'ByteLabs-Studio';
  const repo = 'ByteLab';
  const api = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;

  const statusEl = document.getElementById('status');
  const buttonsEl = document.getElementById('buttons');
  const notesEl = document.getElementById('notes');

  function humanSize(bytes) {
    if (!Number.isFinite(bytes)) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    const val = bytes / Math.pow(k, i);
    return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${sizes[i]}`;
  }

  function makeButton(label, href, sizeBytes) {
    const a = document.createElement('a');
    a.className = 'button';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noreferrer noopener';
    a.textContent = label;

    if (Number.isFinite(sizeBytes)) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = humanSize(sizeBytes);
      a.appendChild(document.createTextNode(' '));
      a.appendChild(badge);
    }
    return a;
  }

  function pickAssets(assets) {
    // Filter DMG assets
    const dmgs = assets.filter(a => /\.dmg$/i.test(a.name));

    // Classify by arch via filename hints
    const isArm = n => /(arm64|aarch64|apple\s*silicon)/i.test(n);
    const isX64 = n => /(x64|x86_64|amd64|intel)/i.test(n);
    const isUniv = n => /(universal)/i.test(n);

    const res = { arm64: null, x64: null, universal: null, others: [] };

    for (const a of dmgs) {
      const name = a.name;
      if (isUniv(name) && !res.universal) res.universal = a;
      else if (isArm(name) && !res.arm64) res.arm64 = a;
      else if (isX64(name) && !res.x64) res.x64 = a;
      else res.others.push(a);
    }

    // If nothing matched and there is exactly one DMG, treat as generic
    if (!res.arm64 && !res.x64 && !res.universal && dmgs.length === 1) {
      res.others = [dmgs[0]];
    }
    return res;
  }

  try {
    const resp = await fetch(api, { headers: { 'Accept': 'application/vnd.github+json' } });
    if (!resp.ok) {
      const msg = resp.status === 403 ? 'GitHub API rate limit hit.' : `GitHub API error: ${resp.status}`;
      statusEl.textContent = `${msg} Use the Releases link below.`;
      return;
    }
    const release = await resp.json();

    if (!Array.isArray(release.assets) || release.assets.length === 0) {
      statusEl.textContent = 'No downloadable assets were found in the latest release. Please check Releases.';
      return;
    }

    const picked = pickAssets(release.assets);

    // Clear status and show buttons
    statusEl.textContent = `Latest: ${release.tag_name || release.name || ''}`.trim();
    buttonsEl.hidden = false;

    if (picked.universal) {
      buttonsEl.appendChild(makeButton('Download for macOS (Universal)', picked.universal.browser_download_url, picked.universal.size));
    }
    if (picked.arm64) {
      buttonsEl.appendChild(makeButton('Download for Apple Silicon (arm64)', picked.arm64.browser_download_url, picked.arm64.size));
    }
    if (picked.x64) {
      buttonsEl.appendChild(makeButton('Download for Intel (x64)', picked.x64.browser_download_url, picked.x64.size));
    }

    // Fallback: list any remaining DMGs generically
    if (!picked.universal && !picked.arm64 && !picked.x64 && picked.others.length) {
      for (const a of picked.others) {
        buttonsEl.appendChild(makeButton('Download for macOS', a.browser_download_url, a.size));
      }
    }

    // Notes
    const lines = [];
    if (release.name) lines.push(`Release: ${release.name}`);
    if (release.published_at) {
      lines.push(`Published: ${new Date(release.published_at).toLocaleString()}`);
    }
    if (release.body) {
      const truncated = release.body.length > 280 ? release.body.slice(0, 280) + '…' : release.body;
      lines.push(truncated);
    }
    if (lines.length) {
      notesEl.hidden = false;
      notesEl.textContent = lines.join('\n');
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Could not reach GitHub. Please use the Releases link below.';
  }
})();
