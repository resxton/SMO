(function () {
    'use strict';
    var engine = window.SMO, tab = 'mm', sweeping = false, lastRows = [], lastHeaders = [], graphRows = [];
    function el(id) { return document.getElementById(id); }
    function show(id, visible) { el(id).style.display = visible ? 'block' : 'none'; }
    function text(node, value) {
        if ('textContent' in node) { node.textContent = value; } else { node.innerText = value; }
    }
    function cell(row, value, tag) {
        var node = document.createElement(tag || 'td'); text(node, String(value)); row.appendChild(node); return node;
    }
    function table(id, headers, rows, invalidColumn) {
        var target = el(id), head = document.createElement('thead'), body = document.createElement('tbody'),
            tr = document.createElement('tr'), i, j, td;
        while (target.firstChild) { target.removeChild(target.firstChild); }
        for (i = 0; i < headers.length; i += 1) { cell(tr, headers[i], 'th'); }
        head.appendChild(tr); target.appendChild(head);
        for (i = 0; i < rows.length; i += 1) {
            tr = document.createElement('tr');
            for (j = 0; j < rows[i].length; j += 1) {
                td = cell(tr, rows[i][j]);
                if (j > 0) { td.className = 'number'; }
                if (j === invalidColumn && String(rows[i][j]).indexOf('(!)') >= 0) { td.className += ' invalid'; }
            }
            body.appendChild(tr);
        }
        target.appendChild(body);
    }
    function input() {
        return {arrival: el('arrival').value, service: el('service').value, c: el('servers').value,
            m: el('buffer').value, cs: el('cstar').value, a: el('distribution').value,
            fractional: el('fractional').checked, literal: el('literal').checked};
    }
    function metrics(result) {
        var definitions = [
            ['φ', 'Предложенная нагрузка СМО', 'λ / μ', 'phi'],
            ['ρ', 'Предложенная нагрузка на аппарат', 'φ / C', 'rho'],
            ['P₀', 'Вероятность простоя всей системы', 'P(N = 0)', 'p0'],
            ['Pотк', 'Вероятность отказа', 'P(N = C + m)', 'loss'],
            ['λc', 'Интенсивность принятого потока', 'λ · q', 'accepted'],
            ['U', 'Использование аппаратов', '(L − Q) / C', 'utilization'],
            ['Q', 'Среднее число заявок в очереди', 'E[max(N − C, 0)]', 'Q'],
            ['L', 'Среднее число заявок в системе', 'Q + C · U', 'L'],
            ['W', 'Среднее ожидание', 'Q / λc', 'W'],
            ['T', 'Среднее время пребывания', 'L / λc', 'T'],
            ['q', 'Относительная пропускная способность', '1 − Pотк', 'q'],
            ['A', 'Абсолютная пропускная способность', 'q · λ', 'A']
        ], rows = [], i, d;
        for (i = 0; i < definitions.length; i += 1) {
            d = definitions[i]; rows.push([d[0], d[1], d[2], engine.fmt(result[d[3]])]);
        }
        table('metrics-table', ['Показатель', 'Описание', 'Формула', 'Значение'], rows);
        return rows;
    }
    function run(sweep) {
        var v = input(), buffers, rows = [], graphs = [], i, m, standard, corrected, invalid = false,
            base, metricRows, probabilityRows = [], notice;
        try {
            buffers = sweep ? engine.buffers : [engine.number(v.m)];
            for (i = 0; i < buffers.length; i += 1) {
                m = buffers[i]; standard = engine.calculate(v.arrival, v.service, v.c, m, v.fractional);
                corrected = engine.corrected(v.arrival, v.service, v.c, m, v.cs, v.a, v.fractional, v.literal);
                if (!engine.valid(corrected)) { invalid = true; }
                rows.push([engine.fmt(m), engine.fmt(standard.loss), engine.fmt(corrected) + (engine.valid(corrected) ? '' : ' (!)'),
                    engine.fmt(corrected - standard.loss), engine.relativeError(standard.loss, corrected)]);
                graphs.push([m, standard.loss, corrected]); base = standard;
            }
            show('error', false); show('comparison-card', true);
            lastHeaders = ['Буфер m', 'Pотк — M/M/c/m', 'Pотк* — G/G/c/m', 'Δ = Pотк* − Pотк', 'Погрешность, %'];
            table('comparison-table', lastHeaders, rows, 2);
            lastRows = rows; graphRows = graphs; sweeping = sweep;
            text(el('result-title'), sweep ? 'Сравнение по ёмкости буфера' : 'Сравнение моделей');
            text(el('snapshot'), 'tвх = ' + v.arrival + '; t₀ = ' + v.service + '; C = ' + v.c + '; C* = ' + v.cs + '; a = ' + v.a
                + '. Режим: ' + (v.fractional ? 'смесь целых конфигураций' : 'целые C и m') + '.');
            notice = 'Δ — разница вероятностей. Погрешность = |Δ| / Pотк · 100%. База сравнения — M/M/c/m; это расхождение методик, а не ошибка относительно точной G/G-системы.';
            if (invalid) { notice += ' (!) Результат модели 2 вне [0; 1] или не определён. Значение не обрезается. При недопустимом результате или нулевой базе погрешность обозначена «—».'; }
            text(el('comparison-note'), notice);
            show('metrics-card', tab === 'mm' && !sweep); show('states-card', tab === 'mm' && !sweep);
            if (tab === 'mm' && !sweep) {
                metricRows = metrics(base);
                for (i = 0; i < base.probabilities.length; i += 1) {
                    probabilityRows.push(['P' + i, engine.fmt(base.probabilities[i])]);
                }
                table('states-table', ['Состояние N', 'Вероятность P(N)'], probabilityRows);
                lastHeaders = ['Показатель', 'Описание', 'Формула', 'Значение'];
                lastRows = metricRows.concat([['', '', '', ''], ['Сравнение', '', '', '']],
                    [['Буфер m', 'Pотк — M/M/c/m', 'Pотк* — G/G/c/m', 'Δ', 'Погрешность, %']], rows,
                    [['', '', '', ''], ['Состояние N', 'Вероятность']], probabilityRows);
            }
            show('graph-card', sweep); show('copy-panel', false);
            if (sweep) { draw(); }
        } catch (error) {
            text(el('error'), error.message || String(error)); show('error', true);
            show('comparison-card', false); show('metrics-card', false); show('states-card', false);
            show('graph-card', false); show('copy-panel', false); lastRows = [];
        }
    }
    function draw() {
        var canvas = el('graph'), ctx, width = Math.max(el('graph-card').clientWidth - 48, 300),
            left = 85, right = width - 28, top = 20, bottom = 215, low = 0, high = 0,
            i, j, p, x, y, colors = ['#2467a6', '#bd493a'], started;
        if (!canvas.getContext) { show('graph-fallback', true); return; }
        ctx = canvas.getContext('2d'); if (!ctx) { show('graph-fallback', true); return; }
        canvas.width = width; canvas.height = 270;
        for (i = 0; i < graphRows.length; i += 1) {
            for (j = 1; j < 3; j += 1) {
                p = graphRows[i][j]; if (isFinite(p)) { low = Math.min(low, p); high = Math.max(high, p); }
            }
        }
        if (high === low) { high = low + 1; }
        ctx.font = '17px Arial'; ctx.lineWidth = 1;
        for (i = 0; i <= 4; i += 1) {
            y = bottom - (bottom - top) * i / 4;
            ctx.strokeStyle = '#e1e7ee'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
            ctx.fillStyle = '#526477'; ctx.textAlign = 'right'; ctx.fillText(engine.fmt(low + (high - low) * i / 4), left - 10, y + 6);
        }
        ctx.strokeStyle = '#8295a7'; ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke();
        for (i = 0; i < graphRows.length; i += 1) {
            x = left + (right - left) * (graphRows[i][0] - 1) / 49;
            ctx.fillStyle = '#526477'; ctx.textAlign = 'center'; ctx.fillText(String(graphRows[i][0]), x, bottom + 26);
        }
        ctx.textAlign = 'right'; ctx.fillText('Ёмкость буфера m', right, 263);
        for (j = 1; j < 3; j += 1) {
            ctx.strokeStyle = colors[j - 1]; ctx.fillStyle = colors[j - 1]; ctx.lineWidth = 2.5; ctx.beginPath(); started = false;
            for (i = 0; i < graphRows.length; i += 1) {
                p = graphRows[i][j]; if (!isFinite(p)) { started = false; continue; }
                x = left + (right - left) * (graphRows[i][0] - 1) / 49;
                y = bottom - (bottom - top) * (p - low) / (high - low);
                if (started) { ctx.lineTo(x, y); } else { ctx.moveTo(x, y); started = true; }
            }
            ctx.stroke();
            for (i = 0; i < graphRows.length; i += 1) {
                p = graphRows[i][j]; if (!isFinite(p)) { continue; }
                x = left + (right - left) * (graphRows[i][0] - 1) / 49;
                y = bottom - (bottom - top) * (p - low) / (high - low);
                ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2, false); ctx.fill();
            }
        }
    }
    function selectTab(next) {
        tab = next; el('tab-mm').className = next === 'mm' ? 'active' : '';
        el('tab-gg').className = next === 'gg' ? 'active' : '';
        el('tab-theory').className = next === 'theory' ? 'active' : '';
        show('analysis', next !== 'theory'); show('theory', next === 'theory');
        if (next !== 'theory') {
            text(el('analysis-title'), next === 'mm' ? 'Анализ M/M/c/m' : 'Анализ G/G/c/m');
            text(el('analysis-description'), next === 'mm' ? 'Точные стационарные показатели и сравнение с приближённой методикой.' : 'Приближённая методика с C* и a. Сравнение с M/M/c/m при тех же средних интервалах.');
            run(sweeping);
        }
    }
    el('tab-mm').onclick = function () { selectTab('mm'); return false; };
    el('tab-gg').onclick = function () { selectTab('gg'); return false; };
    el('tab-theory').onclick = function () { selectTab('theory'); return false; };
    el('calculator').onsubmit = function () { run(false); return false; };
    el('sweep').onclick = function () { run(true); };
    el('compare').onclick = function () { selectTab('gg'); run(false); };
    el('copy').onclick = function () {
        var lines = [lastHeaders.join('\t')], i;
        if (!lastRows.length) { return; }
        for (i = 0; i < lastRows.length; i += 1) { lines.push(lastRows[i].join('\t')); }
        el('copy-text').value = lines.join('\r\n'); show('copy-panel', true);
        el('copy-text').focus(); el('copy-text').select();
        try { document.execCommand('copy'); } catch (ignore) { /* Ручное копирование доступно всегда. */ }
    };
    window.onresize = function () { if (sweeping && tab !== 'theory') { draw(); } };
    selectTab('mm');
}());
