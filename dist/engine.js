(function (root) {
    'use strict';
    function number(value) {
        var text = String(value).replace(/^\s+|\s+$/g, '').replace(',', '.');
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
            throw new Error('Введите число через запятую или точку.');
        }
        var n = Number(text);
        if (!isFinite(n)) { throw new Error('Введите конечные числа.'); }
        return n;
    }
    function sum(xs) {
        var total = 0, correction = 0, i, y, next;
        for (i = 0; i < xs.length; i += 1) {
            y = xs[i] - correction; next = total + y;
            correction = (next - total) - y; total = next;
        }
        return total;
    }
    function adjacent(x) {
        var low = Math.floor(x), part = x - low;
        return part === 0 ? [[low, 1]] : [[low, 1 - part], [low + 1, part]];
    }
    function validate(arrival, service, c, m, fractional) {
        if (arrival <= 0 || service <= 0 || c <= 0 || m < 0) {
            throw new Error('Интервалы и C должны быть > 0; буфер m ≥ 0.');
        }
        if (!fractional && (c !== Math.floor(c) || m !== Math.floor(m))) {
            throw new Error('Для дробных C и m включите флаг дробного ввода.');
        }
        if (Math.ceil(c) + Math.ceil(m) > 100000) {
            throw new Error('Суммарная ёмкость ограничена 100 000 состояниями.');
        }
        if (!isFinite(service / arrival) || service / arrival <= 0 || !isFinite(1 / arrival + 1 / service)) {
            throw new Error('Слишком большой диапазон входных чисел.');
        }
    }
    function integerModel(load, c, m) {
        var logs = [0], weights = [], peak = 0, total, i;
        if (c === 0) {
            for (i = 0; i < m; i += 1) { weights.push(0); }
            weights.push(1); return weights;
        }
        for (i = 1; i <= c + m; i += 1) {
            logs.push(logs[i - 1] + Math.log(load) - Math.log(Math.min(i, c)));
            peak = Math.max(peak, logs[i]);
        }
        for (i = 0; i < logs.length; i += 1) { weights.push(Math.exp(logs[i] - peak)); }
        total = sum(weights);
        for (i = 0; i < weights.length; i += 1) { weights[i] /= total; }
        return weights;
    }
    function calculate(arrival, service, c, m, fractional) {
        arrival = number(arrival); service = number(service); c = number(c); m = number(m);
        validate(arrival, service, c, m, fractional);
        var load = service / arrival, cs = adjacent(c), ms = adjacent(m), probs = [],
            loss = 0, accepted = 0, q = 0, length = 0, busy = 0, i, j, n, ci, mi, w, p, mass, rate;
        for (n = 0; n <= Math.ceil(c) + Math.ceil(m); n += 1) { probs.push(0); }
        for (i = 0; i < cs.length; i += 1) {
            for (j = 0; j < ms.length; j += 1) {
                ci = cs[i][0]; mi = ms[j][0]; w = cs[i][1] * ms[j][1];
                p = integerModel(load, ci, mi);
                loss += w * p[p.length - 1]; accepted += w * sum(p.slice(0, -1));
                for (n = 0; n < p.length; n += 1) {
                    mass = w * p[n]; probs[n] += mass; length += n * mass;
                    q += Math.max(n - ci, 0) * mass; busy += Math.min(n, ci) * mass;
                }
            }
        }
        rate = accepted / arrival;
        return {lam: 1 / arrival, mu: 1 / service, phi: load, rho: load / c,
            p0: probs[0], probabilities: probs, loss: loss, accepted: rate,
            utilization: busy / c, Q: q, L: length, W: rate ? q / rate : Infinity,
            T: rate ? length / rate : Infinity, q: accepted, A: rate, c: c, m: m};
    }
    function expm1(x) {
        if (Math.abs(x) > 0.00001) { return Math.exp(x) - 1; }
        return x * (1 + x * (0.5 + x * (1 / 6 + x * (1 / 24 + x / 120))));
    }
    function corrected(arrival, service, c, m, cstar, a, fractional) {
        arrival = number(arrival); service = number(service); c = number(c); m = number(m);
        cstar = number(cstar); a = number(a);
        validate(arrival, service, c, m, fractional);
        if (cstar <= 0 || a <= 0) { throw new Error('C* и a должны быть > 0.'); }
        function single(ci, mi) {
            if (ci === 0) { return 1; }
            var logRho = Math.log(service) - Math.log(arrival) - Math.log(ci),
                k = mi / a + cstar + 1, denominator, numerator, terms = [], i, scale;
            if (!isFinite(k)) { throw new Error('Слишком большой показатель степени модели 2.'); }
            if (Math.abs(logRho) < 1e-14) {
                denominator = ci * (ci - 1) / 2 - ci * k;
                return denominator ? -ci / denominator : NaN;
            }
            if (Math.abs(logRho) * Math.max(k, ci) < 0.5) {
                for (i = 0; i < ci; i += 1) { terms.push(expm1(i * logRho)); }
                denominator = sum(terms) - ci * expm1(k * logRho);
                numerator = -ci * Math.exp((k - 1) * logRho) * expm1(logRho);
            } else {
                scale = Math.max(0, (ci - 1) * logRho, k * logRho, (k - 1) * logRho);
                for (i = 0; i < ci; i += 1) { terms.push(Math.exp(i * logRho - scale)); }
                denominator = sum(terms) - ci * Math.exp(k * logRho - scale);
                numerator = ci * (Math.exp((k - 1) * logRho - scale) - Math.exp(k * logRho - scale));
            }
            return denominator ? numerator / denominator : NaN;
        }
        var cs = adjacent(c), ms = adjacent(m), terms = [], i, j;
        for (i = 0; i < cs.length; i += 1) {
            for (j = 0; j < ms.length; j += 1) {
                terms.push(cs[i][1] * ms[j][1] * single(cs[i][0], ms[j][0]));
            }
        }
        return sum(terms);
    }
    function fmt(n) {
        if (isNaN(n)) { return 'не определено'; }
        if (!isFinite(n)) { return n < 0 ? '−∞' : '∞'; }
        return n.toFixed(3).replace('.', ',');
    }
    function valid(n) { return isFinite(n) && n >= 0 && n <= 1; }
    function arrivalFromRho(rho, service, c) {
        rho = number(rho); service = number(service); c = number(c);
        if (rho <= 0 || service <= 0 || c <= 0) {
            throw new Error('ρ, t₀ и C должны быть > 0.');
        }
        var arrival = service / c / rho;
        if (!isFinite(arrival) || arrival <= 0) { throw new Error('Слишком большой диапазон ρ, t₀ и C.'); }
        return arrival;
    }
    function relativeError(base, value) {
        return base === 0 || !valid(value) ? '—' : fmt(Math.abs(value - base) / base * 100) + ' %';
    }
    var api = {number: number, calculate: calculate, corrected: corrected,
        fmt: fmt, valid: valid, relativeError: relativeError, arrivalFromRho: arrivalFromRho, buffers: [1, 3, 5, 10, 20, 25, 50]};
    if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
    else { root.SMO = api; }
}(this));
