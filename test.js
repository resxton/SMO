'use strict';
var assert = require('assert'), fs = require('fs'), vm = require('vm'), engine = require('./dist/engine.js');
function near(a, b) { assert(Math.abs(a-b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b))); }
near(engine.calculate(20, 10, 1, 2, false).loss, 1/15);
near(engine.calculate(20, 20, 1, 2, false).loss, 1/4);
near(engine.corrected(20, 20, 1, 2, 1, 1, false), 1/4);
near(engine.corrected(20, 320, 16, 10, 15, 1, false), -16/(16*15/2-16*(10+15+1)));
var rho = 1 + 1e-9;
near(engine.corrected(20, 20*rho, 1, 2, 1, 1, false), Math.pow(rho,3)/(1+rho+rho*rho+Math.pow(rho,3)));
assert.strictEqual(engine.relativeError(.2,.25), '25,000 %');
assert.strictEqual(engine.relativeError(0,.25), '—');
assert.strictEqual(engine.relativeError(.2,-.25), '—');
assert.throws(function () { engine.calculate(20,10,1.5,2,false); });
assert.throws(function () { engine.number(''); });
var fraction = engine.calculate('20,5','10,2','2,4','1,2',true);
near(fraction.L, fraction.Q + 2.4 * fraction.utilization);
near(fraction.accepted, fraction.utilization * 2.4 * fraction.mu);

// Узкий DOM-стенд для проверки переходов, заполнения таблиц и fallback Canvas.
function Element() { this.children=[]; this.style={}; this.value=''; this.checked=false; this.textContent=''; this.clientWidth=1100; }
Element.prototype.appendChild=function (node) { this.children.push(node); this.firstChild=this.children[0]; };
Element.prototype.removeChild=function (node) { this.children.splice(this.children.indexOf(node),1); this.firstChild=this.children[0]; };
Element.prototype.focus=Element.prototype.select=function () {};
var elements={}, html=fs.readFileSync(__dirname+'/dist/index.html','utf8');
html.replace(/id="([^"]+)"/g,function (_,id) { elements[id]=new Element(); });
var defaults={arrival:'20',service:'10',servers:'1',buffer:'2',cstar:'1',distribution:'1'}, key;
for (key in defaults) { elements[key].value=defaults[key]; }
var context={window:{SMO:engine},document:{getElementById:function (id) { assert(elements[id],id); return elements[id]; },createElement:function () {return new Element();},execCommand:function(){return false;}},isFinite:isFinite,Math:Math,String:String,Error:Error};
vm.runInNewContext(fs.readFileSync(__dirname+'/dist/app.js','utf8'),context);
function rowCount(id) { return elements[id].children[1].children.length; }
assert.strictEqual(elements['comparison-card'].style.display,'block');
assert.strictEqual(rowCount('comparison-table'),1);
assert.strictEqual(rowCount('metrics-table'),12);
elements['tab-gg'].onclick();
assert.strictEqual(elements['metrics-card'].style.display,'none');
assert.strictEqual(rowCount('comparison-table'),1);
elements.sweep.onclick();
assert.strictEqual(rowCount('comparison-table'),7);
assert.strictEqual(elements['tab-gg'].className,'active');
assert.strictEqual(elements['comparison-table'].children[0].children[0].children.length,5);
assert.strictEqual(elements['graph-fallback'].style.display,'block');
elements.copy.onclick();
assert(elements['copy-text'].value.indexOf('Погрешность')>=0);
elements['tab-theory'].onclick();
assert.strictEqual(elements.analysis.style.display,'none');
assert.strictEqual(elements.theory.style.display,'block');
elements['tab-mm'].onclick();
assert.strictEqual(elements['comparison-card'].style.display,'block');
elements.servers.value='1,5'; elements.fractional.checked=true;
elements.calculator.onsubmit();
assert.strictEqual(elements.error.style.display,'none');
elements.arrival.value='0'; elements.calculator.onsubmit();
assert.strictEqual(elements.error.style.display,'block');
assert.strictEqual(elements['comparison-card'].style.display,'none');
// Дополнительный режим rho не изменяет сохранённый старый ввод tвх.
elements.arrival.value='20'; elements.service.value='10'; elements.servers.value='2';
elements.rho.value='1,25'; elements['rho-mode'].checked=true;
elements['rho-mode'].onchange();
near(engine.arrivalFromRho('1,25',10,2),4);
assert.strictEqual(elements.arrival.value,'20');
assert.strictEqual(elements.arrival.disabled,true);
assert.strictEqual(elements.error.style.display,'none');
assert(elements.snapshot.textContent.indexOf('ρ = 1,250')>=0);
elements.sweep.onclick();
assert.strictEqual(rowCount('comparison-table'),7);
elements.rho.value='0'; elements.calculator.onsubmit();
assert.strictEqual(elements.error.style.display,'block');
elements['rho-mode'].checked=false; elements['rho-mode'].onchange();
assert.strictEqual(elements.arrival.disabled,false);
assert.strictEqual(elements.arrival.value,'20');
assert.strictEqual(elements.error.style.display,'none');
assert.throws(function () { engine.arrivalFromRho(-1,10,2); });
console.log('OK: расчёты, валидация, вкладки, сравнение, прогон, копирование, теория и fallback графика.');
