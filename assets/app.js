// Comportamento del browser: filtri e ordine dell'elenco, "già fatto", copia del codice.
// Senza JavaScript le pagine restano leggibili: elenco e guide sono già nell'HTML.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const leggi = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const FMT = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const fmt = iso => FMT.format(new Date(iso)).replace(/ /g, ' ');
  const oggi = new Date().toLocaleDateString('sv-SE'); // data locale AAAA-MM-GG
  const giorni = iso => Math.round((Date.parse(iso) - Date.parse(oggi)) / 864e5);

  // Stessa logica di build.mjs, con la data di oggi.
  function stato(scad) {
    if (!scad) return { k: 'continuo', t: 'Senza scadenza', d: 'Nessuna data di fine', s: 'Attivo' };
    const g = giorni(scad);
    if (g < 0) return { k: 'chiuso', t: 'Scaduto il', d: fmt(scad), s: 'Chiuso' };
    const t = g === 0 ? 'Scade oggi' : g === 1 ? 'Scade domani' : `Tra ${g} gg`;
    return { k: g <= 14 ? 'vicina' : 'attivo', t, d: fmt(scad), s: g <= 14 ? 'Scade presto' : 'Attivo', g };
  }
  const fatti = () => leggi('fatti', []);
  const prefs = () => ({ nascondiFatti: false, ...leggi('prefs', {}) });

  if (document.body.dataset.pagina === 'home') home();
  if (document.body.dataset.pagina === 'bonus') bonus();

  function home() {
    const righe = $$('.riga');
    const elenco = $('[data-elenco]');
    const NOMI = { conto: 'Conto', carta: 'Carta', app: 'App', broker: 'Broker', crypto: 'Crypto', zero: 'Nessun capitale', sotto: 'Fino a 20€', oltre: 'Oltre 20€', attivo: 'Da fare', near: 'Scade entro 14 giorni', fatto: 'Già fatto' };
    const s = { f: { tipo: '', cap: '', stato: '' }, q: '', ordine: 'scad', p: prefs() };

    righe.forEach(li => { li._s = stato(li.dataset.scad); });

    function mostra() {
      const dn = fatti();
      let n = 0;
      righe.forEach(li => {
        const st = li._s, fd = dn.includes(li.dataset.id), cl = st.k === 'chiuso', spenta = cl || fd;
        li.classList.toggle('spenta', spenta);
        li.classList.toggle('passata', cl);
        li.classList.toggle('vicina', st.k === 'vicina' && !fd);
        $('.scad-t', li).textContent = fd ? 'Già fatto' : st.t;
        $('.scad-d', li).textContent = fd ? '' : st.d;
        $('.stato', li).textContent = fd ? 'Già fatto' : st.s;
        const ok = (!s.f.tipo || li.dataset.tipo === s.f.tipo)
          && (!s.f.cap || li.dataset.cap === s.f.cap)
          && (s.f.stato !== 'attivo' || (!cl && !fd))
          && (s.f.stato !== 'fatto' || fd)
          && (s.f.stato !== 'near' || (st.k === 'vicina' && !fd))
          && (!s.q || li.dataset.nome.includes(s.q.toLowerCase()))
          && !(s.p.nascondiFatti && fd && s.f.stato !== 'fatto');
        li.hidden = !ok;
        if (ok) n++;
      });
      // Ordine: chiusi in fondo, poi già fatti, poi il criterio scelto.
      const chiave = li => { const st = li._s; return st.k === 'chiuso' ? 1e6 : fatti().includes(li.dataset.id) ? 5e5 : s.ordine === 'imp' ? 1e4 - Number(li.dataset.num) : st.k === 'continuo' ? 1e5 : st.g; };
      righe.slice().sort((a, b) => chiave(a) - chiave(b)).forEach(li => elenco.append(li));

      const attivi = righe.filter(li => li._s.k !== 'chiuso' && !dn.includes(li.dataset.id));
      const vicini = attivi.filter(li => li._s.k === 'vicina').length;
      $('[data-titolo]').textContent = `${attivi.length} ${attivi.length === 1 ? 'bonus attivo' : 'bonus attivi'}`;
      $('[data-conteggio]').textContent = `${s.ordine === 'imp' ? 'Ordinati per importo più alto' : 'Ordinati per scadenza più vicina'}. Mostrati ${n} di ${righe.length}${dn.length ? `. Già fatti: ${dn.length}` : ''}.`;
      const bv = $('[data-vicine]');
      bv.hidden = !(vicini && !anyFiltro());
      $('[data-vicine-n]').textContent = `${vicini} ${vicini === 1 ? 'bonus scade' : 'bonus scadono'} entro 14 giorni.`;

      $$('.opz').forEach(b => {
        const g = b.dataset.g, on = g === 'ordine' ? s.ordine === b.dataset.v : (s.f[g] || '') === b.dataset.v;
        b.setAttribute('aria-pressed', on);
      });
      $$('[data-pref]').forEach(b => b.setAttribute('aria-checked', s.p[b.dataset.pref]));
      $('[data-sub-fatti]').textContent = `Hai segnato ${dn.length} ${dn.length === 1 ? 'bonus' : 'bonus'} come già fatti.`;
      $('[data-azzera-fatti]').hidden = !dn.length;

      const chips = chipList();
      const nF = ['tipo', 'cap', 'stato'].filter(k => s.f[k]).length;
      $('[data-etichetta-filtri]').textContent = nF ? `Filtri (${nF})` : 'Filtri';
      const aperto = $('[data-apri-filtri]').getAttribute('aria-expanded') === 'true';
      const box = $('[data-chips]');
      box.hidden = !chips.length || aperto;
      box.replaceChildren(...chips.map(chipBtn));
      const vuoto = n === 0;
      $('[data-vuoto]').hidden = !vuoto;
      $('[data-elenco-box]').hidden = vuoto;
      if (vuoto) {
        $('[data-vuoto-testo]').textContent = `Hai scelto: ${chips.map(c => c.label).join(', ')}. Nessun bonus li rispetta tutti insieme. Togli un filtro o azzera tutto.`;
        $('[data-vuoto-chips]').replaceChildren(...chips.map(c => Object.assign(chipBtn(c), { className: 'btn', textContent: `Togli «${c.label}»` })));
      }
    }
    const anyFiltro = () => !!(s.f.tipo || s.f.cap || s.f.stato || s.q);
    function chipList() {
      const l = ['tipo', 'cap', 'stato'].filter(k => s.f[k]).map(k => ({ label: NOMI[s.f[k]], off: () => { s.f[k] = ''; mostra(); } }));
      if (s.q) l.push({ label: `Cerca: ${s.q}`, off: () => { s.q = ''; $('[data-cerca]').value = ''; mostra(); } });
      return l;
    }
    function chipBtn(c) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.setAttribute('aria-label', `Togli il filtro ${c.label}`);
      const SVG = 'http://www.w3.org/2000/svg';
      const x = document.createElementNS(SVG, 'svg'), tr = document.createElementNS(SVG, 'path'), tx = document.createElement('span');
      x.setAttribute('class', 'ico'); x.setAttribute('viewBox', '0 0 24 24'); x.setAttribute('aria-hidden', 'true');
      tr.setAttribute('d', 'M6 6l12 12M18 6L6 18'); x.append(tr);
      tx.textContent = c.label;
      b.append(tx, x);
      b.addEventListener('click', c.off);
      return b;
    }

    $$('.opz').forEach(b => b.addEventListener('click', () => {
      const g = b.dataset.g, v = b.dataset.v;
      if (g === 'ordine') s.ordine = v; else s.f[g] = s.f[g] === v ? '' : v;
      mostra();
    }));
    $('[data-cerca]').addEventListener('input', e => { s.q = e.target.value.trim(); mostra(); });
    $('[data-apri-filtri]').addEventListener('click', e => {
      const b = e.currentTarget, apri = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', apri); $('#filtri').hidden = !apri; mostra();
    });
    $$('[data-pref]').forEach(b => b.addEventListener('click', () => { s.p[b.dataset.pref] = !s.p[b.dataset.pref]; scrivi('prefs', s.p); mostra(); }));
    $('[data-azzera-fatti-btn]').addEventListener('click', () => { scrivi('fatti', []); mostra(); });
    $('[data-reset]').addEventListener('click', () => { s.f = { tipo: '', cap: '', stato: '' }; s.q = ''; $('[data-cerca]').value = ''; mostra(); });
    $('[data-vicine]').addEventListener('click', () => { s.f.stato = 'near'; mostra(); });
    mostra();
  }

  function bonus() {
    const main = $('main'), id = main.dataset.id;
    const st = stato(main.dataset.scad);
    const t = $('[data-scad-t]'), d = $('[data-scad-d]');
    if (t) { t.textContent = st.t; d.textContent = st.d; }

    const fb = $('[data-fatto]');
    if (fb) {
      const agg = () => { const on = fatti().includes(id); fb.setAttribute('aria-pressed', on); $('[data-fatto-t]').textContent = on ? 'Già fatto. Tocca per togliere' : 'Segna come già fatto'; };
      fb.addEventListener('click', () => { const l = fatti(); scrivi('fatti', l.includes(id) ? l.filter(x => x !== id) : l.concat(id)); agg(); });
      agg();
    }
    const cp = $('[data-copia]');
    if (cp) cp.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(cp.dataset.copia); } catch {}
      const lab = $('[data-copia-t]', cp); lab.textContent = 'Copiato';
      setTimeout(() => { lab.textContent = 'Copia il codice'; }, 1800);
    });
  }
})();
