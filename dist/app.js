(function () {
    'use strict';
    var engine = window.SMO, fontSize = 20, tab = 'mm', sweeping = false, lastRows = [], lastHeaders = [], graphRows = [], report = null;
    function el(id) { return document.getElementById(id); }
    var copyHint = 'Текст выделен. Если браузер не скопировал автоматически, нажмите Ctrl+C (на Mac — Cmd+C). Можно вставить в Excel.';
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
        var v = {arrival: el('arrival').value, service: el('service').value, c: el('servers').value,
            m: el('buffer').value, cs: el('cstar').value, a: el('distribution').value,
            fractional: el('fractional').checked};
        if (el('rho-mode').checked) {
            v.arrival = engine.arrivalFromRho(el('rho').value, v.service, v.c);
            text(el('derived-arrival'), 'Ввод через ρ = ' + el('rho').value + '. Рассчитанный tвх = ' + engine.fmt(v.arrival)
                + '. В вычислениях используется полная точность.');
            show('derived-arrival', true);
        } else { show('derived-arrival', false); }
        return v;
    }
    function metricDefinitions() {
        return [
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
        ];
    }
    function rawMetrics(result) {
        var definitions = metricDefinitions(), rows = [], i, d;
        for (i = 0; i < definitions.length; i += 1) {
            d = definitions[i]; rows.push([d[0], d[1], d[2], result[d[3]]]);
        }
        return rows;
    }
    function rawStates(result) {
        var rows = [], i;
        for (i = 0; i < result.probabilities.length; i += 1) { rows.push(['P' + i, result.probabilities[i]]); }
        return rows;
    }
    function metrics(result) {
        var definitions = metricDefinitions(), rows = [], i, d;
        for (i = 0; i < definitions.length; i += 1) {
            d = definitions[i]; rows.push([d[0], d[1], d[2], engine.fmt(result[d[3]])]);
        }
        table('metrics-table', ['Показатель', 'Описание', 'Формула', 'Значение'], rows);
        return rows;
    }
    function run(sweep) {
        var v, buffers, rows = [], graphs = [], rawRows = [], i, m, standard, corrected, invalid = false,
            base, metricRows, probabilityRows = [], notice;
        try {
            v = input();
            buffers = sweep ? engine.buffers : [engine.number(v.m)];
            for (i = 0; i < buffers.length; i += 1) {
                m = buffers[i]; standard = engine.calculate(v.arrival, v.service, v.c, m, v.fractional);
                corrected = engine.corrected(v.arrival, v.service, v.c, m, v.cs, v.a, v.fractional);
                if (!engine.valid(corrected)) { invalid = true; }
                rows.push([engine.fmt(m), engine.fmt(standard.loss), engine.fmt(corrected) + (engine.valid(corrected) ? '' : ' (!)'),
                    engine.fmt(corrected - standard.loss), engine.relativeError(standard.loss, corrected)]);
                graphs.push([m, standard.loss, corrected]); base = standard;
                rawRows.push([m, standard.loss, corrected, corrected - standard.loss,
                    standard.loss !== 0 && engine.valid(corrected) ? Math.abs(corrected - standard.loss) / standard.loss * 100 : NaN]);
            }
            show('error', false); show('comparison-card', true);
            lastHeaders = ['Буфер m', 'Pотк — M/M/c/m', 'Pотк* — G/G/c/m', 'Δ = Pотк* − Pотк', 'Погрешность, %'];
            table('comparison-table', lastHeaders, rows, 2);
            lastRows = rows; graphRows = graphs; sweeping = sweep;
            report = {params: [
                ['Модель (вкладка)', tab === 'mm' ? 'M/M/c/m' : 'G/G/c/m'],
                ['Расчёт', sweep ? 'Прогон по ёмкости буфера' : 'Одна конфигурация'],
                ['Ввод через ρ', el('rho-mode').checked ? 'да, ρ = ' + el('rho').value : 'нет'],
                ['Интервал поступления tвх', engine.number(v.arrival)],
                ['Время обслуживания t₀', engine.number(v.service)],
                ['Число аппаратов C', engine.number(v.c)],
                ['Ёмкость буфера m', sweep ? engine.buffers.join(', ') : engine.number(v.m)],
                ['C* — коррекция каналов', engine.number(v.cs)],
                ['a — учёт распределений', engine.number(v.a)],
                ['Дробный ввод C и m', v.fractional ? 'да' : 'нет'],
                ['ρ — предложенная нагрузка на аппарат', base.rho]
            ], sections: [{title: 'Сравнение моделей', headers: ['Буфер m', 'Pотк — M/M/c/m', 'Pотк* — G/G/c/m', 'Δ = Pотк* − Pотк', 'Погрешность, %'], rows: rawRows}]};
            text(el('result-title'), sweep ? 'Сравнение по ёмкости буфера' : 'Сравнение моделей');
            text(el('snapshot'), 'ρ = ' + engine.fmt(base.rho) + '; tвх = ' + engine.fmt(engine.number(v.arrival)) + '; t₀ = ' + v.service + '; C = ' + v.c + '; C* = ' + v.cs + '; a = ' + v.a
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
                report.sections.push({title: 'Показатели M/M/c/m', headers: ['Показатель', 'Описание', 'Формула', 'Значение'],
                    rows: rawMetrics(base)});
                report.sections.push({title: 'Вероятности состояний', headers: ['Состояние N', 'Вероятность P(N)'], rows: rawStates(base)});
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
            show('graph-card', false); show('copy-panel', false); lastRows = []; report = null;
            show('derived-arrival', false);
        }
    }
    function draw() {
        var canvas = el('graph'), ctx, width = Math.max(el('graph-card').clientWidth - 48, 300),
            left = 85, right = width - 28, top = 20, bottom = 215 + Math.round(17 * fontSize / 20) - 17, low = 0, high = 0,
            i, j, p, x, y, colors = ['#2467a6', '#bd493a'], started;
        if (!canvas.getContext) { show('graph-fallback', true); return; }
        ctx = canvas.getContext('2d'); if (!ctx) { show('graph-fallback', true); return; }
        canvas.width = width; canvas.height = bottom + 55; canvas.style.height = (bottom + 55) + 'px';
        for (i = 0; i < graphRows.length; i += 1) {
            for (j = 1; j < 3; j += 1) {
                p = graphRows[i][j]; if (isFinite(p)) { low = Math.min(low, p); high = Math.max(high, p); }
            }
        }
        if (high === low) { high = low + 1; }
        ctx.font = Math.round(17 * fontSize / 20) + 'px Arial'; ctx.lineWidth = 1;
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
        ctx.textAlign = 'right'; ctx.fillText('Ёмкость буфера m', right, bottom + 48);
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
    el('rho-mode').onchange = function () {
        var enabled = el('rho-mode').checked;
        el('arrival').disabled = enabled;
        show('rho-input', enabled);
        run(sweeping);
    };
    el('sweep').onclick = function () { sweeping = true; selectTab('gg'); };
    el('compare').onclick = function () { selectTab('gg'); run(false); };
    el('copy').onclick = function () {
        var lines = [lastHeaders.join('\t')], i;
        if (!lastRows.length) { return; }
        for (i = 0; i < lastRows.length; i += 1) { lines.push(lastRows[i].join('\t')); }
        text(el('copy-hint'), copyHint);
        el('copy-text').value = lines.join('\r\n'); show('copy-panel', true);
        el('copy-text').focus(); el('copy-text').select();
        try { document.execCommand('copy'); } catch (ignore) { /* Ручное копирование доступно всегда. */ }
    };
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function csvValue(value) {
        var s;
        if (typeof value === 'number') {
            if (isNaN(value)) { return ''; }
            if (!isFinite(value)) { return value < 0 ? '-∞' : '∞'; }
            s = String(Number(value.toPrecision(12))).replace('.', ',');
        } else { s = String(value); }
        return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function csvLine(cells) {
        var out = [], i;
        for (i = 0; i < cells.length; i += 1) { out.push(csvValue(cells[i])); }
        return out.join(';');
    }
    function buildCsv(now) {
        var lines = [], i, j, s;
        lines.push(csvLine(['Отчёт: анализ СМО с конечным буфером']));
        lines.push(csvLine(['Дата', now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes())]));
        lines.push(''); lines.push(csvLine(['Исходные данные']));
        for (i = 0; i < report.params.length; i += 1) { lines.push(csvLine(report.params[i])); }
        for (i = 0; i < report.sections.length; i += 1) {
            s = report.sections[i];
            lines.push(''); lines.push(csvLine([s.title])); lines.push(csvLine(s.headers));
            for (j = 0; j < s.rows.length; j += 1) { lines.push(csvLine(s.rows[j])); }
        }
        lines.push('');
        lines.push(csvLine(['Погрешность = |Δ| / Pотк · 100% (расхождение методик); база — M/M/c/m. Пустая ячейка — значение не определено или вне [0; 1].']));
        return lines.join('\r\n');
    }
    function download(name, content) {
        var blob, url, link;
        if (!window.Blob) { return false; }
        try { blob = new window.Blob(['\ufeff' + content], {type: 'text/csv;charset=utf-8'}); } catch (ignore) { return false; }
        if (window.navigator && window.navigator.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob, name); return true; }
        if (!window.URL || !window.URL.createObjectURL) { return false; }
        link = document.createElement('a');
        if (!('download' in link)) { return false; }
        url = window.URL.createObjectURL(blob);
        link.href = url; link.download = name; link.style.display = 'none';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
        return true;
    }
    el('export-csv').onclick = function () {
        var now = new Date(), content, name;
        if (!report) { return; }
        content = buildCsv(now);
        name = 'smo_' + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '_' + pad(now.getHours()) + pad(now.getMinutes()) + '.csv';
        if (!download(name, content)) {
            text(el('copy-hint'), 'Браузер не поддерживает скачивание файлов. Сохраните выделенный текст в файл ' + name + ' (Ctrl+C / Cmd+C) или вставьте в Excel.');
            el('copy-text').value = content; show('copy-panel', true); el('copy-text').focus(); el('copy-text').select();
        }
    };
    el('print-report').onclick = function () {
        var now = new Date();
        if (!report) { return; }
        text(el('print-date'), 'Сформировано: ' + pad(now.getDate()) + '.' + pad(now.getMonth() + 1) + '.' + now.getFullYear() + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()));
        if (window.print) { window.print(); }
    };
    window.onresize = function () { if (sweeping && tab !== 'theory') { draw(); } };
    function setFont(size) {
        fontSize = Math.max(14, Math.min(32, size));
        if (document.documentElement) { document.documentElement.style.fontSize = fontSize + 'px'; }
        el('font-down').disabled = fontSize <= 14; el('font-up').disabled = fontSize >= 32;
        try { window.localStorage.setItem('smo-font-size', String(fontSize)); } catch (ignore) { /* Хранилище недоступно. */ }
        if (sweeping && tab !== 'theory') { draw(); }
    }
    el('font-down').onclick = function () { setFont(fontSize - 2); };
    el('font-up').onclick = function () { setFont(fontSize + 2); };
    el('font-reset').onclick = function () { setFont(20); };
    show('font-controls', true);
    try { fontSize = Number(window.localStorage.getItem('smo-font-size')) || 20; } catch (ignore) { fontSize = 20; }
    setFont(fontSize);
    selectTab('mm');
}());
