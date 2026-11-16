/* FinTrack Part 2: UI-only progressive enhancement. No authentication or money movement. */
(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[s]);
  const money = (v) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(v);

  let toastTimer;
  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hide');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.add('hide'), 4800);
  }

  // Navigation: the same responsive sidebar appears across all authenticated pages.
  const sidebar = $('#app-sidebar');
  const overlay = $('#sidebar-overlay');
  const menu = $('#mobile-menu');
  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('show');
    menu?.setAttribute('aria-expanded', 'false');
  }
  menu?.addEventListener('click', () => {
    const opening = !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', opening);
    overlay?.classList.toggle('show', opening);
    menu.setAttribute('aria-expanded', String(opening));
  });
  overlay?.addEventListener('click', closeSidebar);
  $$('.nav-item').forEach((link) => link.addEventListener('click', closeSidebar));

  // The top search searches page names, not financial data.
  const pageLinks = $$('.sidebar-nav a[href]');
  $('[data-global-search]')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const term = event.currentTarget.value.trim().toLowerCase();
    if (!term) return;
    const link = pageLinks.find((a) => a.textContent.toLowerCase().includes(term));
    if (link) location.href = link.getAttribute('href');
    else toast('No matching page. Try “accounts”, “trading”, or “reports”.');
  });

  // Reusable notification actions.
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-toast]');
    if (trigger) toast(trigger.getAttribute('data-toast'));
  });

  // Password visibility and lightweight password strength feedback.
  $$('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      button.setAttribute('aria-label', input.type === 'text' ? 'Hide password' : 'Show password');
    });
  });
  const registerPassword = $('#password');
  registerPassword?.addEventListener('input', () => {
    const value = registerPassword.value;
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (value.length >= 16) score++;
    if (value.length >= 20) score++;
    $('[data-meter]')?.setAttribute('data-strength', String(score));
  });

  // All auth actions are intentionally visual demos. No credentials are persisted.
  $$('form[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const type = form.dataset.demoForm;
      if (type === 'login') {
        toast('UI demo only: opening the dashboard without authenticating.');
        location.href = 'dashboard.html';
      } else if (type === 'register' || type === 'reset') {
        const first = $('[name="password"], [name="new_password"]', form);
        const confirm = $('[name="confirm_password"]', form);
        if (first && confirm && first.value !== confirm.value) {
          confirm.setCustomValidity('Passwords do not match.');
          confirm.reportValidity();
          return;
        }
        const success = $('#auth-success');
        success?.classList.add('show');
        success?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (type === 'forgot') {
        $('#auth-success')?.classList.add('show');
      }
    });
    form.addEventListener('input', () => {
      $('[name="confirm_password"]', form)?.setCustomValidity('');
    });
  });

  // A small accessible modal system for UI previews. We generate text safely.
  let activeModal = null;
  let previousFocus = null;
  function closeModal() {
    if (activeModal) activeModal.remove();
    activeModal = null;
    previousFocus?.focus();
    previousFocus = null;
  }
  function openModal(title, contentHTML, actionText = '') {
    closeModal();
    previousFocus = document.activeElement;
    const layer = document.createElement('div');
    layer.className = 'modal-backdrop open';
    layer.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button type="button" class="icon-button modal-close" data-close-modal aria-label="Close dialog">×</button><h2 id="modal-title">${escapeHTML(title)}</h2>${contentHTML}<div class="modal-actions"><button type="button" class="btn btn-outline" data-close-modal>Close</button>${actionText ? `<button type="button" class="btn btn-primary" data-demo-action>${escapeHTML(actionText)}</button>` : ''}</div></div>`;
    document.body.append(layer);
    activeModal = layer;
    $('[data-close-modal]',layer)?.focus();
    layer.addEventListener('click', (event) => {
      if (event.target === layer || event.target.closest('[data-close-modal]')) closeModal();
      if (event.target.closest('[data-demo-action]')) {closeModal(); toast('Preview complete. No data was changed or stored.');}
    });
  }
  document.addEventListener('keydown',(event) => { if(event.key==='Escape') {closeModal();closeSidebar();} });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-modal-open]');
    if (!trigger) return;
    if (trigger.dataset.modalOpen === 'add-account-modal') {
      openModal('Add a simulated account', '<p>Account creation is a frontend preview; in Part 3, PHP will validate and save the record in MySQL.</p><div class="stack section-gap" style="gap:12px"><div class="field"><label>Account type</label><select class="form-control" disabled><option>Checking account</option><option>Savings account</option><option>Credit card</option><option>Investment account</option></select></div><div class="field"><label>Account nickname</label><input class="form-control" placeholder="e.g. Travel savings" disabled></div><div class="notice">Sample accounts are already available to explore.</div></div>');
    }
  });

  // Table search and optional category filter, both client-side.
  const tableSearch = $('[data-table-search]');
  const categoryFilter = $('[data-category-filter]');
  function filterRows() {
    const query = tableSearch?.value.trim().toLowerCase() || '';
    const category = categoryFilter?.value.toLowerCase() || '';
    let visible = 0;
    $$('[data-filter-row]').forEach((row) => {
      const okText = (row.dataset.search || '').includes(query);
      const okCategory = !category || row.dataset.category === category;
      row.hidden = !(okText && okCategory);
      if (!row.hidden) visible++;
    });
    $('#filter-empty')?.classList.toggle('hide', visible > 0);
  }
  tableSearch?.addEventListener('input', filterRows);
  categoryFilter?.addEventListener('change', filterRows);

  // Generate downloadable CSVs only from visible demo tables.
  function exportTable(buttonId,filename) {
    document.getElementById(buttonId)?.addEventListener('click', () => {
      const table = $('main table');
      if(!table) return;
      const rows = $$('tr',table).filter((row) => !row.hidden);
      const csv = rows.map((row) => $$('th,td',row).map((cell) => '"' + cell.innerText.trim().replace(/"/g,'""').replace(/\s+/g,' ') + '"').join(',')).join('\r\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;a.download = filename;document.body.appendChild(a);a.click();a.remove();
      URL.revokeObjectURL(url);
      toast('Downloaded sample UI data, not financial records.');
    });
  }
  exportTable('export-transactions','fintrack-demo-transactions.csv');
  exportTable('export-reports','fintrack-demo-report.csv');

  // Transfer order is never submitted. The modal displays a readable preview.
  $('#transfer-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if(!form.reportValidity()) return;
    const from = $('#transfer-from').value;
    const to = $('#transfer-to').value;
    const amount = Number($('#transfer-amount').value);
    if(from === to){toast('Please choose two different accounts.');return;}
    if(!Number.isFinite(amount)||amount<=0){toast('Enter a valid amount.');return;}
    const balance = from==='Everyday Checking'?8420.55:16850;
    if(amount > balance){toast('The demo transfer amount exceeds the example balance.');return;}
    const memo = $('#transfer-memo').value.trim() || 'None';
    openModal('Transfer preview (no funds move)', '<p>Review the details below. This is not a transfer confirmation.</p><div class="section-gap">'+[ ['From',from],['To',to],['Amount',money(amount)],['Memo',memo],['Status','Not submitted · UI only']].map(([label,value])=>`<div class="info-row"><span class="label">${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('')+'</div>', 'Close preview');
  });

  // Paper-trading screen: sample prices, order estimate and no brokerage integration.
  const tradeType = $('#trade-type');
  tradeType?.addEventListener('change', () => $('#trade-limit-wrap')?.classList.toggle('hide', !tradeType.value.startsWith('Limit')));
  $('#trade-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if(!form.reportValidity()) return;
    const symbol = $('#trade-symbol').selectedOptions[0];
    const price = Number(symbol.dataset.price);
    const quantity = Number($('#trade-quantity').value);
    if(!Number.isInteger(quantity)||quantity<=0){toast('Enter a whole number of shares.');return;}
    const kind = tradeType.value;
    const limit = Number($('#trade-limit').value);
    if(kind.startsWith('Limit') && (!Number.isFinite(limit)||limit<=0)){toast('Enter a valid limit price.');return;}
    const estimatePrice = kind.startsWith('Limit') ? limit : price;
    openModal('Paper order preview (not submitted)', '<p>Example prices are fictional and are not suitable for real trading.</p><div class="section-gap">'+[['Side',$('#trade-side').value],['Symbol',symbol.value],['Quantity',String(quantity)],['Type',kind],['Illustrative price',money(estimatePrice)],['Estimated value',money(estimatePrice*quantity)],['Status','No order placed']].map(([label,value])=>`<div class="info-row"><span class="label">${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`).join('')+'</div>', 'Close preview');
  });

  // Editing a profile requires a database; Part 2 simply validates the form.
  $('#profile-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) toast('Profile form checked. Changes were not saved (frontend demo).');
  });
})();
