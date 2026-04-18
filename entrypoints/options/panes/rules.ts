import { canonicalize } from '@/utils/normalize';
import { matchRule } from '@/utils/rules';
import { settingsStore } from '@/utils/storage';
import type {
  BuiltinId,
  NormalizerSpec,
  Rule,
  Settings,
} from '@/utils/types';
import { escapeHtml, openModal, randomId } from '../ui';

const BUILTIN_IDS: readonly BuiltinId[] = [
  'github-pr',
  'github-issue',
  'google-docs',
  'youtube-video',
];

const STEP_KINDS: ReadonlyArray<NormalizerSpec['kind']> = [
  'identity',
  'stripFragment',
  'stripQuery',
  'stripTrackingParams',
  'pathPrefix',
  'regex',
  'builtin',
];

export function renderRulesPane(root: HTMLElement, settings: Settings) {
  const rules = [...settings.dedup.rules].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );

  root.innerHTML = `
    <h2>Dedup Rules</h2>
    <p class="muted">Rules are evaluated top-to-bottom by priority. The first matching rule is applied.</p>
    <div class="row">
      <button id="add-rule" class="primary">Add rule</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>Priority</th>
          <th>Name</th>
          <th>Host</th>
          <th>Scope</th>
          <th>Enabled</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rules
          .map(
            (r) => `
          <tr data-id="${escapeHtml(r.id)}">
            <td>${r.priority}</td>
            <td>${escapeHtml(r.name)}</td>
            <td><code>${escapeHtml(r.match.hostGlob)}</code></td>
            <td>${r.scope}</td>
            <td><input type="checkbox" class="toggle" ${
              r.enabled ? 'checked' : ''
            } /></td>
            <td class="row">
              <button class="edit">Edit</button>
              <button class="delete danger">Delete</button>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>

    <div class="test-harness">
      <h2>Test URL</h2>
      <input type="url" id="test-url" placeholder="https://github.com/foo/bar/pull/1/files" />
      <pre id="test-result" class="muted"></pre>
    </div>
  `;

  root.querySelector('#add-rule')!.addEventListener('click', () => {
    openRuleEditor(null, settings);
  });

  root.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
    const id = row.dataset.id!;
    row.querySelector<HTMLInputElement>('.toggle')!.addEventListener(
      'change',
      async (e) => {
        const next = structuredClone(settings);
        const rule = next.dedup.rules.find((r) => r.id === id);
        if (!rule) return;
        rule.enabled = (e.target as HTMLInputElement).checked;
        await settingsStore.setValue(next);
      },
    );
    row.querySelector('.edit')!.addEventListener('click', () => {
      const rule = settings.dedup.rules.find((r) => r.id === id);
      if (rule) openRuleEditor(rule, settings);
    });
    row.querySelector('.delete')!.addEventListener('click', async () => {
      if (!confirm('Delete this rule?')) return;
      const next = structuredClone(settings);
      next.dedup.rules = next.dedup.rules.filter((r) => r.id !== id);
      await settingsStore.setValue(next);
    });
  });

  const testUrl = root.querySelector<HTMLInputElement>('#test-url')!;
  const testResult = root.querySelector<HTMLPreElement>('#test-result')!;
  testUrl.addEventListener('input', () => {
    const val = testUrl.value.trim();
    if (!val) {
      testResult.textContent = '';
      return;
    }
    const rule = matchRule(val, settings.dedup.rules);
    if (!rule) {
      testResult.textContent = 'No rule matched.';
      return;
    }
    const canonical = canonicalize(val, rule.pipeline);
    testResult.textContent = `Matched: ${rule.name}\nCanonical: ${canonical}`;
  });
}

function openRuleEditor(existing: Rule | null, settings: Settings): void {
  const rule: Rule = existing
    ? structuredClone(existing)
    : {
        id: randomId(),
        name: 'New rule',
        enabled: true,
        match: { hostGlob: '*' },
        pipeline: [{ kind: 'identity' }],
        scope: 'profile',
        priority: 50,
      };

  const body = document.createElement('div');
  body.innerHTML = `
    <div class="field">
      <label for="e-name">Name</label>
      <input id="e-name" type="text" value="${escapeHtml(rule.name)}" />
    </div>
    <div class="field">
      <label for="e-host">Host glob (e.g. <code>github.com</code>, <code>*.figma.com</code>, <code>*</code>)</label>
      <input id="e-host" type="text" value="${escapeHtml(rule.match.hostGlob)}" />
    </div>
    <div class="field">
      <label for="e-path">Path regex (optional)</label>
      <input id="e-path" type="text" value="${escapeHtml(
        rule.match.pathRegex ?? '',
      )}" />
    </div>
    <div class="field">
      <label for="e-scope">Scope</label>
      <select id="e-scope">
        <option value="profile" ${
          rule.scope === 'profile' ? 'selected' : ''
        }>Profile (all windows)</option>
        <option value="window" ${
          rule.scope === 'window' ? 'selected' : ''
        }>Window only</option>
      </select>
    </div>
    <div class="field">
      <label for="e-priority">Priority</label>
      <input id="e-priority" type="number" value="${rule.priority}" />
    </div>
    <div class="field">
      <label>Pipeline</label>
      <div id="pipeline"></div>
      <button id="add-step">+ Add step</button>
    </div>
  `;

  const pipelineEl = body.querySelector('#pipeline') as HTMLDivElement;
  let pipeline: NormalizerSpec[] = [...rule.pipeline];

  const renderPipeline = () => {
    pipelineEl.innerHTML = '';
    pipeline.forEach((step, idx) => {
      const row = document.createElement('div');
      row.className = 'pipeline-step';
      const select = document.createElement('select');
      STEP_KINDS.forEach((k) => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        if (k === step.kind) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', () => {
        pipeline[idx] = defaultStep(select.value as NormalizerSpec['kind']);
        renderPipeline();
      });
      row.appendChild(select);

      const args = document.createElement('span');
      args.className = 'row';
      args.style.flex = '1';
      if (step.kind === 'builtin') {
        const s = document.createElement('select');
        BUILTIN_IDS.forEach((b) => {
          const opt = document.createElement('option');
          opt.value = b;
          opt.textContent = b;
          if (b === step.id) opt.selected = true;
          s.appendChild(opt);
        });
        s.addEventListener('change', () => {
          pipeline[idx] = { kind: 'builtin', id: s.value as BuiltinId };
        });
        args.appendChild(s);
      } else if (step.kind === 'pathPrefix') {
        const n = document.createElement('input');
        n.type = 'number';
        n.value = String(step.segments);
        n.addEventListener('input', () => {
          pipeline[idx] = {
            kind: 'pathPrefix',
            segments: Math.max(0, Number(n.value) || 0),
          };
        });
        args.appendChild(n);
      } else if (step.kind === 'regex') {
        const p = document.createElement('input');
        p.type = 'text';
        p.placeholder = 'pattern';
        p.value = step.pattern;
        const c = document.createElement('input');
        c.type = 'text';
        c.placeholder = 'canonical ($1, $2, …)';
        c.value = step.canonical;
        const sync = () => {
          pipeline[idx] = {
            kind: 'regex',
            pattern: p.value,
            canonical: c.value,
          };
        };
        p.addEventListener('input', sync);
        c.addEventListener('input', sync);
        args.append(p, c);
      } else if (step.kind === 'stripQuery') {
        const e = document.createElement('input');
        e.type = 'text';
        e.placeholder = 'keep params (comma-separated)';
        e.value = (step.except ?? []).join(',');
        e.addEventListener('input', () => {
          const list = e.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          pipeline[idx] =
            list.length > 0
              ? { kind: 'stripQuery', except: list }
              : { kind: 'stripQuery' };
        });
        args.appendChild(e);
      }
      row.appendChild(args);

      const up = document.createElement('button');
      up.textContent = '↑';
      up.addEventListener('click', () => {
        if (idx > 0) {
          [pipeline[idx - 1], pipeline[idx]] = [
            pipeline[idx]!,
            pipeline[idx - 1]!,
          ];
          renderPipeline();
        }
      });
      const down = document.createElement('button');
      down.textContent = '↓';
      down.addEventListener('click', () => {
        if (idx < pipeline.length - 1) {
          [pipeline[idx + 1], pipeline[idx]] = [
            pipeline[idx]!,
            pipeline[idx + 1]!,
          ];
          renderPipeline();
        }
      });
      const del = document.createElement('button');
      del.className = 'danger';
      del.textContent = '×';
      del.addEventListener('click', () => {
        pipeline.splice(idx, 1);
        renderPipeline();
      });
      row.append(up, down, del);
      pipelineEl.appendChild(row);
    });
  };
  renderPipeline();

  body.querySelector('#add-step')!.addEventListener('click', (e) => {
    e.preventDefault();
    pipeline.push({ kind: 'identity' });
    renderPipeline();
  });

  openModal({
    title: existing ? 'Edit rule' : 'Add rule',
    body,
    onSave: async () => {
      const name = (body.querySelector('#e-name') as HTMLInputElement).value.trim();
      const hostGlob = (
        body.querySelector('#e-host') as HTMLInputElement
      ).value.trim();
      const pathRegex = (
        body.querySelector('#e-path') as HTMLInputElement
      ).value.trim();
      const scope = (body.querySelector('#e-scope') as HTMLSelectElement)
        .value as 'profile' | 'window';
      const priority = Number(
        (body.querySelector('#e-priority') as HTMLInputElement).value,
      );
      if (!name || !hostGlob) throw new Error('Name and host glob are required');

      const updated: Rule = {
        id: rule.id,
        name,
        enabled: rule.enabled,
        match: pathRegex ? { hostGlob, pathRegex } : { hostGlob },
        pipeline: pipeline.length > 0 ? pipeline : [{ kind: 'identity' }],
        scope,
        priority: Number.isFinite(priority) ? priority : 0,
      };

      const next = structuredClone(settings);
      const idx = next.dedup.rules.findIndex((r) => r.id === updated.id);
      if (idx >= 0) next.dedup.rules[idx] = updated;
      else next.dedup.rules.push(updated);
      await settingsStore.setValue(next);
    },
  });
}

function defaultStep(kind: NormalizerSpec['kind']): NormalizerSpec {
  switch (kind) {
    case 'identity':
      return { kind: 'identity' };
    case 'stripFragment':
      return { kind: 'stripFragment' };
    case 'stripQuery':
      return { kind: 'stripQuery' };
    case 'stripTrackingParams':
      return { kind: 'stripTrackingParams' };
    case 'pathPrefix':
      return { kind: 'pathPrefix', segments: 2 };
    case 'regex':
      return { kind: 'regex', pattern: '', canonical: '' };
    case 'builtin':
      return { kind: 'builtin', id: 'github-pr' };
  }
}
