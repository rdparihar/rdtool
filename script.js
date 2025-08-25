(function(){
  const display = document.getElementById('display');
  const modeToggle = document.getElementById('modeToggle');
  const advPanel = document.getElementById('advancedPanel');
  const converterToggle = document.getElementById('converterToggle');
  const converterPanel = document.getElementById('converterPanel');
  const dateToggle = document.getElementById('dateToggle');
  const datePanel = document.getElementById('datePanel');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const dateDiffResult = document.getElementById('dateDiffResult');
  const dateBase = document.getElementById('dateBase');
  const dateOffset = document.getElementById('dateOffset');
  const dateOffsetUnit = document.getElementById('dateOffsetUnit');
  const dateAddResult = document.getElementById('dateAddResult');
  const convCategory = document.getElementById('convCategory');
  const convInput = document.getElementById('convInput');
  const convFrom = document.getElementById('convFrom');
  const convTo = document.getElementById('convTo');
  const convResult = document.getElementById('convResult');
  const convSwap = document.getElementById('convSwap');
  const convFormulaHelp = document.getElementById('convFormulaHelp');
  const calcWrapper = document.getElementById('calcWrapper');
  const memoryIndicator = document.getElementById('memoryIndicator');

  let current = '0';
  let prev = null;
  let op = null;
  let justEvaluated = false;
  let memory = 0;
  let awaitingSecondOperandForPow = false;
  let converterMode = false;
  let dateMode = false;

  const UNITS = {
    length: {
      base: 'm',
      units: {
        m: { label: 'Meters (m)', toBase: v => v, fromBase: v => v },
        km: { label: 'Kilometers (km)', toBase: v => v * 1000, fromBase: v => v / 1000 },
        cm: { label: 'Centimeters (cm)', toBase: v => v / 100, fromBase: v => v * 100 },
        mm: { label: 'Millimeters (mm)', toBase: v => v / 1000, fromBase: v => v * 1000 },
        mi: { label: 'Miles (mi)', toBase: v => v * 1609.34, fromBase: v => v / 1609.34 },
        ft: { label: 'Feet (ft)', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
        in: { label: 'Inches (in)', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 }
      },
      formula: 'val_base = toBase(input); result = fromBase(val_base)'
    },
    weight: {
      base: 'kg',
      units: {
        kg: { label: 'Kilograms (kg)', toBase: v => v, fromBase: v => v },
        g: { label: 'Grams (g)', toBase: v => v / 1000, fromBase: v => v * 1000 },
        lb: { label: 'Pounds (lb)', toBase: v => v * 0.45359237, fromBase: v => v / 0.45359237 },
        oz: { label: 'Ounces (oz)', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 }
      },
      formula: 'val_kg = toBase(input); result = fromBase(val_kg)'
    },
    temperature: {
      base: 'C',
      units: {
        C: { label: 'Celsius (°C)', toBase: v => v, fromBase: v => v },
        F: { label: 'Fahrenheit (°F)', toBase: v => (v - 32) * 5/9, fromBase: v => (v * 9/5) + 32 },
        K: { label: 'Kelvin (K)', toBase: v => v - 273.15, fromBase: v => v + 273.15 }
      },
      formula: 'Convert via base Celsius'
    },
    currency: {
      base: 'USD',
      // Static demo rates; in real app fetch from API & update dynamically
      units: {
        USD: { label: 'US Dollar (USD)', toBase: v => v, fromBase: v => v },
        EUR: { label: 'Euro (EUR)', toBase: v => v * 1.08, fromBase: v => v / 1.08 },
        GBP: { label: 'Pound (GBP)', toBase: v => v * 1.27, fromBase: v => v / 1.27 },
        JPY: { label: 'Yen (JPY)', toBase: v => v * 0.0063, fromBase: v => v / 0.0063 },
        INR: { label: 'Rupee (INR)', toBase: v => v * 0.012, fromBase: v => v / 0.012 },
        AUD: { label: 'Australian Dollar (AUD)', toBase: v => v * 0.66, fromBase: v => v / 0.66 },
        CAD: { label: 'Canadian Dollar (CAD)', toBase: v => v * 0.73, fromBase: v => v / 0.73 }
      },
      formula: 'Use static demo FX rates relative to USD'
    }
  };

  function populateUnitSelects(category){
    const { units } = UNITS[category];
    const options = Object.entries(units).map(([k,u]) => `<option value="${k}">${u.label}</option>`).join('');
    convFrom.innerHTML = options;
    convTo.innerHTML = options;
    convFrom.value = Object.keys(units)[0];
    convTo.value = Object.keys(units)[1] || Object.keys(units)[0];
    updateConversion();
  }

  function updateConversion(){
    // Always compute so value is ready when user opens panel
    if (!convCategory) return;
    const category = convCategory.value;
    const { units, formula } = UNITS[category];
    const fromUnit = convFrom.value; const toUnit = convTo.value;
    const raw = parseFloat(convInput.value || '0');
    const baseVal = units[fromUnit].toBase(raw);
    const out = units[toUnit].fromBase(baseVal);
    if (!converterPanel.hidden) {
      convResult.value = formatConv(out);
      // Dynamic rate string
      let extra = '';
      try {
        const rate = units[toUnit].fromBase(units[fromUnit].toBase(1));
        if (rate && isFinite(rate)) {
          extra = ` • 1 ${fromUnit} = ${formatConv(rate)} ${toUnit}`;
        }
      } catch(_){}
      convFormulaHelp.textContent = formula + extra;
    }
  }
  function formatConv(v){
    if (!isFinite(v)) return 'ERR';
    const abs = Math.abs(v);
    if (abs !==0 && (abs < 0.000001 || abs > 1000000)) return v.toExponential(6);
    return (+v.toPrecision(9)).toString();
  }
  function swapUnits(){
    const f = convFrom.value; const t = convTo.value;
    convFrom.value = t; convTo.value = f; updateConversion();
  }

  function update(){ display.value = current; memoryIndicator.classList.toggle('is-hidden', memory === 0); }
  function sanitizeNumber(str){
    if (str === 'ERR') return str;
    if (!isFinite(+str)) return 'ERR';
    let out = (+parseFloat(str).toPrecision(12)).toString();
    if (out.length > 14) out = (+out).toExponential(6);
    return out;
  }
  function inputDigit(d){
    if (justEvaluated){ current = d === '.' ? '0.' : d; justEvaluated = false; return update(); }
    if (d === '.') { if (!current.includes('.')) current += '.'; return update(); }
    if (current === '0') current = d; else current += d; update();
  }
  function setOp(nextOp){
    if (awaitingSecondOperandForPow) { // treat as second part of pow if was waiting
      return;
    }
    if (op && !justEvaluated){ evaluate(); }
    prev = current; op = nextOp; current = '0'; justEvaluated = false; update();
  }
  function evaluate(){
    if (awaitingSecondOperandForPow){
      const base = parseFloat(prev);
      const exponent = parseFloat(current);
      const res = Math.pow(base, exponent);
      current = sanitizeNumber(res);
      awaitingSecondOperandForPow = false; op=null; prev=null; justEvaluated = true; return update();
    }
    if (op === null || prev === null) return;
    const a = parseFloat(prev); const b = parseFloat(current);
    let res = 0;
    switch(op){
      case '+': res = a + b; break;
      case '-': res = a - b; break;
      case '*': res = a * b; break;
      case '/': res = b === 0 ? 'ERR' : a / b; break;
    }
    current = res === 'ERR' ? 'ERR' : sanitizeNumber(res);
    op = null; prev = null; justEvaluated = true; update();
  }
  function clearAll(){ current='0'; prev=null; op=null; justEvaluated=false; awaitingSecondOperandForPow=false; update(); }
  function clearEntry(){ current='0'; update(); }
  function toggleSign(){ if (current !== '0' && current !== 'ERR') { current = current.startsWith('-') ? current.slice(1) : '-' + current; update(); } }
  function percent(){ if (current !== 'ERR') { current = sanitizeNumber(parseFloat(current)/100); update(); } }
  function applyFn(fn){
    if (current === 'ERR') return;
    const val = parseFloat(current);
    let res = val;
    switch(fn){
      case 'sin': res = Math.sin(val); break;
      case 'cos': res = Math.cos(val); break;
      case 'tan': res = Math.tan(val); break;
      case 'sqrt': res = val < 0 ? 'ERR' : Math.sqrt(val); break;
      case 'square': res = val * val; break;
      case 'inv': res = val === 0 ? 'ERR' : 1/val; break;
      case 'log': res = val <= 0 ? 'ERR' : Math.log10(val); break;
      case 'ln': res = val <= 0 ? 'ERR' : Math.log(val); break;
      case 'pi': res = Math.PI; break;
      case 'e': res = Math.E; break;
      case 'pow':
        prev = current; awaitingSecondOperandForPow = true; current='0'; update(); return;
      case 'ce': return clearEntry();
      case 'mc': memory = 0; update(); return;
      case 'mr': current = sanitizeNumber(memory); update(); return;
      case 'm+': memory += val; update(); return;
      case 'm-': memory -= val; update(); return;
    }
    current = res === 'ERR' ? 'ERR' : sanitizeNumber(res);
    justEvaluated = true; update();
  }

  document.querySelectorAll('.buttons-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value');
      const action = btn.getAttribute('data-action');
      if (val) {
        if (['+','-','*','/'].includes(val)) setOp(val); else inputDigit(val);
      } else if (action){
        switch(action){
          case 'clear': clearAll(); break;
          case 'equals': evaluate(); break;
          case 'sign': toggleSign(); break;
          case 'percent': percent(); break;
        }
      }
    });
  });

  advPanel.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const fn = btn.getAttribute('data-fn');
      applyFn(fn);
    });
  });

  function setAdvancedMode(on){
    if (on){
      calcWrapper.setAttribute('data-mode','advanced');
      advPanel.hidden = false;
      modeToggle.textContent = 'Advanced: On';
      modeToggle.setAttribute('aria-pressed','true');
      modeToggle.setAttribute('aria-expanded','true');
      const firstAdvBtn = advPanel.querySelector('button');
      if (firstAdvBtn) setTimeout(()=>firstAdvBtn.focus(),0);
    } else {
      calcWrapper.setAttribute('data-mode','basic');
      advPanel.hidden = true;
      modeToggle.textContent = 'Advanced: Off';
      modeToggle.setAttribute('aria-pressed','false');
      modeToggle.setAttribute('aria-expanded','false');
      modeToggle.focus();
    }
  }
  modeToggle.addEventListener('click', () => {
    const isAdv = calcWrapper.getAttribute('data-mode') === 'advanced';
    setAdvancedMode(!isAdv);
  });

  // Converter toggle
  function setConverterMode(on){
    if (on){
      converterPanel.hidden = false;
      converterToggle.textContent = 'Converter: On';
      converterToggle.setAttribute('aria-pressed','true');
      converterToggle.setAttribute('aria-expanded','true');
      updateConversion();
    } else {
      converterPanel.hidden = true;
      converterToggle.textContent = 'Converter: Off';
      converterToggle.setAttribute('aria-pressed','false');
      converterToggle.setAttribute('aria-expanded','false');
    }
  }
  converterToggle && converterToggle.addEventListener('click', ()=>{
    converterMode = !converterMode;
    setConverterMode(converterMode);
  });
  // Date toggle
  function setDateMode(on){
    if (on){
      datePanel.hidden = false;
      dateToggle.textContent = 'Date: On';
      dateToggle.setAttribute('aria-pressed','true');
      dateToggle.setAttribute('aria-expanded','true');
      // initialize default dates
      const todayStr = new Date().toISOString().slice(0,10);
      if (!dateStart.value) dateStart.value = todayStr;
      if (!dateEnd.value) dateEnd.value = todayStr;
      if (!dateBase.value) dateBase.value = todayStr;
      computeDateDiff();
      computeDateAdd();
    } else {
      datePanel.hidden = true;
      dateToggle.textContent = 'Date: Off';
      dateToggle.setAttribute('aria-pressed','false');
      dateToggle.setAttribute('aria-expanded','false');
    }
  }
  dateToggle && dateToggle.addEventListener('click', ()=>{ dateMode = !dateMode; setDateMode(dateMode); });

  function computeDateDiff(){
    if (!(dateStart.value && dateEnd.value)) return;
    const s = new Date(dateStart.value);
    const e = new Date(dateEnd.value);
    if (isNaN(s) || isNaN(e)) return;
    const msDiff = e - s;
    const dayMs = 86400000;
    const days = Math.round(msDiff / dayMs);
    // business days excluding weekends
    let business = 0;
    if (days !== 0){
      const dir = days >=0 ? 1 : -1;
      let cur = new Date(s);
      while ((dir>0 && cur<=e) || (dir<0 && cur>=e)){
        const dow = cur.getDay();
        if (dow !== 0 && dow !==6) business++;
        cur = new Date(cur.getTime() + dir*dayMs);
      }
      if (dir<0) business = -business; // sign align
    } else {
      business = 0;
    }
    // months & years (calendar difference)
    const years = e.getFullYear() - s.getFullYear();
    const months = years*12 + (e.getMonth() - s.getMonth());
    dateDiffResult.innerHTML = `
      <strong>${days}</strong> day(s)<br/>
      <strong>${business}</strong> business day(s)<br/>
      <strong>${months}</strong> month(s) (~cal)<br/>
      <strong>${years}</strong> year(s)
    `;
  }

  function computeDateAdd(){
    if (!dateBase.value) return;
    const base = new Date(dateBase.value);
    if (isNaN(base)) return;
    const offset = parseInt(dateOffset.value || '0',10);
    const unit = dateOffsetUnit.value;
    let result = new Date(base);
    switch(unit){
      case 'days': result.setDate(result.getDate() + offset); break;
      case 'weeks': result.setDate(result.getDate() + offset*7); break;
      case 'months': {
        const d = result.getDate();
        result.setMonth(result.getMonth() + offset);
        // handle month overflow (if original day not in target month)
        if (result.getDate() !== d){ result.setDate(0); }
        break;
      }
      case 'years': {
        const m = result.getMonth(); const d = result.getDate();
        result.setFullYear(result.getFullYear() + offset);
        if (result.getMonth() !== m){ result.setDate(0); }
        break;
      }
    }
    dateAddResult.textContent = result.toISOString().slice(0,10);
  }

  [dateStart, dateEnd].forEach(el=> el && el.addEventListener('change', computeDateDiff));
  [dateBase, dateOffset, dateOffsetUnit].forEach(el=> el && el.addEventListener('input', computeDateAdd));
  dateOffsetUnit && dateOffsetUnit.addEventListener('change', computeDateAdd);
  convCategory && convCategory.addEventListener('change', ()=> populateUnitSelects(convCategory.value));
  [convInput].forEach(el => el && el.addEventListener('input', updateConversion));
  [convFrom, convTo].forEach(el => {
    if (!el) return;
    el.addEventListener('change', updateConversion);
    el.addEventListener('input', updateConversion); // fallback if browser fires input
  });
  convSwap && convSwap.addEventListener('click', swapUnits);

  // Initialize converter selects
  if (convCategory) populateUnitSelects(convCategory.value);

  window.addEventListener('keydown', (e)=>{
    if (e.key.match(/^[0-9]$/)) { inputDigit(e.key); }
    else if (e.key === '.') inputDigit('.');
    else if (['+','-','*','/'].includes(e.key)) setOp(e.key);
    else if (e.key === 'Enter' || e.key === '=') { e.preventDefault(); evaluate(); }
    else if (e.key === 'Escape') clearAll();
    else if (e.key === '%') percent();
  });

  update();
})();
