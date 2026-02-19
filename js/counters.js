/**
 * Counter recommendation engine.
 * Scores candidate units based on bonus damage, effective HP, cost efficiency,
 * and manual override mappings.
 */

const CounterEngine = (() => {

  /**
   * Calculate total resource cost of a unit.
   */
  function totalCost(unit) {
    return (unit.cost.food || 0) + (unit.cost.wood || 0) + (unit.cost.gold || 0);
  }

  /**
   * Find bonus damage a unit deals to a target based on armor classes.
   */
  function getBonusDamage(attacker, target) {
    let bonus = 0;
    for (const ab of attacker.attackBonuses) {
      if (target.armorClasses.includes(ab.class)) {
        bonus += ab.bonus;
      }
    }
    return bonus;
  }

  /**
   * Estimate effective damage per hit from attacker to target.
   * Melee units use meleeArmor, ranged use pierceArmor.
   */
  function effectiveDamage(attacker, target) {
    const armor = attacker.range > 0 ? target.pierceArmor : target.meleeArmor;
    const baseDmg = Math.max(1, attacker.attack - armor);
    const bonus = getBonusDamage(attacker, target);
    return baseDmg + bonus;
  }

  /**
   * Score a candidate counter unit against a target enemy unit.
   * Higher score = better counter.
   */
  function scoreCounter(candidate, enemy) {
    let score = 0;
    const dmgToEnemy = effectiveDamage(candidate, enemy);
    const dmgFromEnemy = effectiveDamage(enemy, candidate);

    // Damage ratio: how much more damage we deal vs receive
    const killTime = dmgToEnemy > 0 ? enemy.hp / dmgToEnemy : 999;
    const deathTime = dmgFromEnemy > 0 ? candidate.hp / dmgFromEnemy : 999;
    if (killTime > 0) {
      score += (deathTime / killTime) * 30;
    }

    // Bonus damage is heavily weighted
    const bonus = getBonusDamage(candidate, enemy);
    score += bonus * 5;

    // Cost efficiency: cheaper counters score higher
    const candidateCost = totalCost(candidate);
    const enemyCost = totalCost(enemy);
    if (candidateCost > 0 && enemyCost > 0) {
      score += (enemyCost / candidateCost) * 10;
    }

    // Speed advantage (can catch or kite)
    if (candidate.speed > enemy.speed) {
      score += 5;
    }

    // Range advantage
    if (candidate.range > enemy.range) {
      score += 3;
    }

    return score;
  }

  /**
   * Build a human-readable reason for why a unit counters another.
   */
  function buildReason(candidate, enemy) {
    const parts = [];
    const bonus = getBonusDamage(candidate, enemy);
    if (bonus > 0) {
      parts.push(`Deals +${bonus} bonus damage`);
    }
    if (candidate.speed > enemy.speed) {
      parts.push('Faster movement speed');
    }
    if (candidate.range > enemy.range && candidate.range > 0) {
      parts.push('Outranges the enemy');
    }
    const candidateCost = totalCost(candidate);
    const enemyCost = totalCost(enemy);
    if (candidateCost < enemyCost * 0.7) {
      parts.push('Significantly cheaper');
    }
    if (candidate.special) {
      parts.push(candidate.special);
    }
    return parts.length > 0 ? parts.join('. ') + '.' : 'Statistically favourable matchup.';
  }

  /**
   * Add extra commentary if a tech upgrade materially improves a counter.
   * Lightweight heuristics (not a full simulator).
   */
  function techCommentary(candidate, enemy, civTech, techIndex, civId) {
    if (!civTech || !techIndex || !civId) return null;
    const civ = civTech[civId];
    if (!civ || !Array.isArray(civ.techIds)) return null;

    const hasTechByName = (name) => {
      const want = name.toLowerCase();
      return civ.techIds.some((id) => {
        const t = techIndex[String(id)];
        return t && t.name && t.name.toLowerCase() === want;
      });
    };

    // Common cases where tech changes the *reliability* of a counter.
    if (['skirmisher', 'elite_skirmisher', 'imperial_skirmisher'].includes(candidate.id)) {
      if (hasTechByName('Bodkin Arrow') || hasTechByName('Bracer')) {
        return 'With archer attack upgrades, skirmishers scale into a much stronger archer counter.';
      }
    }

    if (['spearman', 'pikeman', 'halberdier'].includes(candidate.id)) {
      if (hasTechByName('Pikeman') || hasTechByName('Halberdier')) {
        return 'With spear-line upgrades, this becomes a significantly stronger cavalry counter.';
      }
    }

    if (['light_cavalry', 'hussar', 'winged_hussar'].includes(candidate.id)) {
      if (hasTechByName('Husbandry')) {
        return 'Husbandry improves speed, making this counter more reliable at catching or escaping.';
      }
    }

    return null;
  }

  /**
   * Get recommended counters.
   * @param {string} enemyUnitId - The unit to counter
   * @param {string} civId - The player's civilisation
   * @param {Array} allUnits - All unit data
   * @param {Array} allCivs - All civ data
   * @param {Object} manualCounters - Manual counter mappings
   * @param {number} limit - Max results
   * @returns {Array} Sorted counter recommendations
   */
  function getCounters(enemyUnitId, civId, allUnits, allCivs, manualCounters, limit = 5, civTech = null, techIndex = null) {
    const enemy = allUnits.find(u => u.id === enemyUnitId);
    const civ = allCivs.find(c => c.id === civId);
    if (!enemy || !civ) return [];

    const manualIds = manualCounters[enemyUnitId] || [];

    const results = [];

    for (const candidate of allUnits) {
      // Don't recommend the same unit
      if (candidate.id === enemyUnitId) continue;
      // Must be available to the civ
      if (!civ.availableUnits.includes(candidate.id)) continue;

      let score = scoreCounter(candidate, enemy);

      // Boost manually tagged counters
      if (manualIds.includes(candidate.id)) {
        score += 25;
      }

      const baseReason = buildReason(candidate, enemy);
      const extra = techCommentary(candidate, enemy, civTech, techIndex, civId);

      results.push({
        unit: candidate,
        score: Math.round(score),
        bonusDamage: getBonusDamage(candidate, enemy),
        reason: extra ? `${baseReason} ${extra}` : baseReason,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  return { getCounters, getBonusDamage, totalCost };
})();
