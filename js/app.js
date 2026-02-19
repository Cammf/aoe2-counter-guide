/**
 * Main application logic.
 * Loads data, wires up selectors, renders counter results.
 */

(async function () {
  // Load JSON data
  const [units, civs, manualCounters, civTech, techIndex] = await Promise.all([
    fetch('data/units.json').then(r => r.json()),
    fetch('data/civilisations.json').then(r => r.json()),
    fetch('data/counters.json').then(r => r.json()),
    fetch('data/civ_technologies.json').then(r => r.json()),
    fetch('data/technologies.json').then(r => r.json()),
  ]);

  const civSelect = document.getElementById('civ-select');
  const enemySelect = document.getElementById('enemy-unit-select');
  const civBonuses = document.getElementById('civ-bonuses');
  const enemyStats = document.getElementById('enemy-unit-stats');
  const resultsSection = document.getElementById('results');
  const resultsGrid = document.getElementById('results-grid');

  // Populate civ dropdown
  for (const civ of civs) {
    const opt = document.createElement('option');
    opt.value = civ.id;
    opt.textContent = civ.name;
    civSelect.appendChild(opt);
  }

  // Populate enemy unit dropdown (all units)
  const sortedUnits = [...units].sort((a, b) => a.name.localeCompare(b.name));
  for (const unit of sortedUnits) {
    const opt = document.createElement('option');
    opt.value = unit.id;
    opt.textContent = `${unit.name} (${unit.class})`;
    enemySelect.appendChild(opt);
  }

  // Class icons (fallback when no image available)
  const classIcons = {
    infantry: '\u2694',
    archer: '\uD83C\uDFF9',
    cavalry: '\uD83D\uDC0E',
    siege: '\uD83D\uDCA3',
    monk: '\u2720',
  };

  // Event listeners
  civSelect.addEventListener('change', () => {
    showCivBonuses();
    updateResults();
  });

  enemySelect.addEventListener('change', () => {
    showEnemyStats();
    updateResults();
  });

  function showCivBonuses() {
    const civ = civs.find(c => c.id === civSelect.value);
    if (!civ) {
      civBonuses.innerHTML = '';
      return;
    }
    civBonuses.innerHTML = `<ul>${civ.bonuses.map(b => `<li>${b}</li>`).join('')}</ul>`;
  }

  function showEnemyStats() {
    const unit = units.find(u => u.id === enemySelect.value);
    if (!unit) {
      enemyStats.innerHTML = '';
      return;
    }
    enemyStats.innerHTML = `
      <div class="stat-row"><span class="stat-label">HP</span><span class="stat-value">${unit.hp}</span></div>
      <div class="stat-row"><span class="stat-label">Attack</span><span class="stat-value">${unit.attack}</span></div>
      <div class="stat-row"><span class="stat-label">Melee Armor</span><span class="stat-value">${unit.meleeArmor}</span></div>
      <div class="stat-row"><span class="stat-label">Pierce Armor</span><span class="stat-value">${unit.pierceArmor}</span></div>
      <div class="stat-row"><span class="stat-label">Range</span><span class="stat-value">${unit.range}</span></div>
      <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-value">${unit.speed}</span></div>
      <div class="stat-row"><span class="stat-label">Cost</span><span class="stat-value">${formatCostInline(unit.cost)}</span></div>
    `;
  }

  function formatCostInline(cost) {
    const parts = [];
    if (cost.food) parts.push(`${cost.food}F`);
    if (cost.wood) parts.push(`${cost.wood}W`);
    if (cost.gold) parts.push(`${cost.gold}G`);
    return parts.join(' / ');
  }

  function updateResults() {
    const civId = civSelect.value;
    const enemyId = enemySelect.value;

    if (!civId || !enemyId) {
      resultsSection.classList.add('hidden');
      return;
    }

    const counters = CounterEngine.getCounters(enemyId, civId, units, civs, manualCounters, 6, civTech, techIndex);

    if (counters.length === 0) {
      resultsGrid.innerHTML = '<p style="color:var(--text-muted)">No strong counters found for this matchup with your civilisation.</p>';
      resultsSection.classList.remove('hidden');
      return;
    }

    const enemy = units.find(u => u.id === enemyId);

    resultsGrid.innerHTML = counters.map((c, i) => {
      const u = c.unit;
      const icon = classIcons[u.class] || '\u2694';
      const rank = i === 0 ? '<span class="score-badge">Best</span>' : '';
      const bonusHtml = c.bonusDamage > 0
        ? `<div class="bonus-damage">+${c.bonusDamage} bonus damage vs ${enemy.name}</div>`
        : '';

      return `
        <div class="counter-card">
          <div class="card-header">
            <div class="unit-icon">
              <img src="assets/units/${u.id}.png" alt="${u.name}" onerror="this.style.display='none';this.parentElement.textContent='${icon}'">
            </div>
            <div>
              <div class="unit-name">${u.name}${rank}</div>
              <div class="unit-class">${u.class}</div>
            </div>
          </div>
          <div class="stats-grid">
            <div class="stat"><span class="label">HP</span><span class="value">${u.hp}</span></div>
            <div class="stat"><span class="label">Attack</span><span class="value">${u.attack}</span></div>
            <div class="stat"><span class="label">M. Armor</span><span class="value">${u.meleeArmor}</span></div>
            <div class="stat"><span class="label">P. Armor</span><span class="value">${u.pierceArmor}</span></div>
            <div class="stat"><span class="label">Range</span><span class="value">${u.range}</span></div>
            <div class="stat"><span class="label">Speed</span><span class="value">${u.speed}</span></div>
          </div>
          ${bonusHtml}
          <div class="cost-comparison">
            ${u.cost.food ? `<span class="cost-item cost-food">${u.cost.food} Food</span>` : ''}
            ${u.cost.wood ? `<span class="cost-item cost-wood">${u.cost.wood} Wood</span>` : ''}
            ${u.cost.gold ? `<span class="cost-item cost-gold">${u.cost.gold} Gold</span>` : ''}
          </div>
          <div class="counter-reason">${c.reason}</div>
        </div>
      `;
    }).join('');

    resultsSection.classList.remove('hidden');
  }
})();
