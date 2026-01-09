/**
 * Game Data - Central data file for all game entities
 *
 * Contains: Ships, Research, Buildings, Defense
 * All values based on pr0game (OGame clone) standard values
 *
 * Points calculation: (metal + crystal + deuterium) / 1000
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ShipData {
  id: string;
  costs: { metal: number; crystal: number; deuterium: number };
  speed: {
    base: number;
    drive: 'combustion' | 'impulse' | 'hyperspace';
    // Some ships upgrade drive at certain tech levels
    upgradeAt?: { tech: 'impulse' | 'hyperspace'; level: number; newSpeed: number; newDrive: 'impulse' | 'hyperspace' };
  };
  capacity: number;        // Cargo capacity
  fuel: number;            // Fuel consumption per flight
  attack: number;          // Attack power
  shield: number;          // Shield strength
  hull: number;            // Structure/Hull points (displayed structure = hull * 10)
  expo: boolean;           // Can be found in expeditions
  rapidfire?: Record<string, number>;  // Rapidfire against other units (ID -> multiplier)
}

export interface ResearchData {
  id: string;
  baseCosts: { metal: number; crystal: number; deuterium: number };
  factor: number;  // Cost multiplier per level (usually 2)
}

export interface BuildingData {
  id: string;
  baseCosts: { metal: number; crystal: number; deuterium: number };
  factor: number;  // Cost multiplier per level
}

export interface DefenseData {
  id: string;
  costs: { metal: number; crystal: number; deuterium: number };
  attack: number;
  shield: number;
  hull: number;            // Structure/Hull points (displayed structure = hull * 10)
  expo: boolean;           // Can be found in expeditions
}

// =============================================================================
// SHIPS
// =============================================================================

export const SHIPS: Record<string, ShipData> = {
  // Civil ships
  '202': {
    id: '202',
    costs: { metal: 2000, crystal: 2000, deuterium: 0 },
    speed: {
      base: 5000,
      drive: 'combustion',
      upgradeAt: { tech: 'impulse', level: 5, newSpeed: 10000, newDrive: 'impulse' },
    },
    capacity: 5000,
    fuel: 10,
    attack: 5,
    shield: 10,
    hull: 400,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
  '203': {
    id: '203',
    costs: { metal: 6000, crystal: 6000, deuterium: 0 },
    speed: { base: 7500, drive: 'combustion' },
    capacity: 25000,
    fuel: 50,
    attack: 5,
    shield: 25,
    hull: 1200,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
  '208': {
    id: '208',
    costs: { metal: 10000, crystal: 20000, deuterium: 10000 },
    speed: { base: 2500, drive: 'impulse' },
    capacity: 7500,
    fuel: 1000,
    attack: 50,
    shield: 100,
    hull: 3000,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
  '209': {
    id: '209',
    costs: { metal: 10000, crystal: 6000, deuterium: 2000 },
    speed: {
      base: 2000,
      drive: 'combustion',
      upgradeAt: { tech: 'impulse', level: 17, newSpeed: 4000, newDrive: 'impulse' },
      // Note: At Hyperspace 15, upgrades to hyperspace drive with 6000 base speed
    },
    capacity: 20000,
    fuel: 300,
    attack: 1,
    shield: 10,
    hull: 1600,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
  '210': {
    id: '210',
    costs: { metal: 0, crystal: 1000, deuterium: 0 },
    speed: { base: 100000000, drive: 'combustion' },
    capacity: 5,
    fuel: 1,
    attack: 0,
    shield: 0,
    hull: 100,
    expo: true,
  },
  '212': {
    id: '212',
    costs: { metal: 0, crystal: 2000, deuterium: 500 },
    speed: { base: 0, drive: 'combustion' },
    capacity: 0,
    fuel: 0,
    attack: 1,
    shield: 1,
    hull: 200,
    expo: true,
  },

  // Combat ships
  '204': {
    id: '204',
    costs: { metal: 3000, crystal: 1000, deuterium: 0 },
    speed: { base: 12500, drive: 'combustion' },
    capacity: 50,
    fuel: 20,
    attack: 50,
    shield: 10,
    hull: 400,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
  '205': {
    id: '205',
    costs: { metal: 6000, crystal: 4000, deuterium: 0 },
    speed: { base: 10000, drive: 'impulse' },
    capacity: 100,
    fuel: 75,
    attack: 150,
    shield: 25,
    hull: 1000,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '202': 3 },
  },
  '206': {
    id: '206',
    costs: { metal: 20000, crystal: 7000, deuterium: 2000 },
    speed: { base: 15000, drive: 'impulse' },
    capacity: 800,
    fuel: 300,
    attack: 400,
    shield: 50,
    hull: 2700,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '204': 6, '401': 10 },
  },
  '207': {
    id: '207',
    costs: { metal: 45000, crystal: 15000, deuterium: 0 },
    speed: { base: 10000, drive: 'hyperspace' },
    capacity: 1500,
    fuel: 500,
    attack: 1000,
    shield: 200,
    hull: 6000,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '222': 2 },
  },
  '211': {
    id: '211',
    costs: { metal: 50000, crystal: 25000, deuterium: 15000 },
    speed: {
      base: 4000,
      drive: 'impulse',
      upgradeAt: { tech: 'hyperspace', level: 8, newSpeed: 5000, newDrive: 'hyperspace' },
    },
    capacity: 500,
    fuel: 1000,
    attack: 1000,
    shield: 500,
    hull: 7500,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '401': 20, '402': 20, '403': 10, '405': 10 },
  },
  '213': {
    id: '213',
    costs: { metal: 60000, crystal: 50000, deuterium: 15000 },
    speed: { base: 5000, drive: 'hyperspace' },
    capacity: 2000,
    fuel: 1000,
    attack: 2000,
    shield: 500,
    hull: 11000,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '402': 10, '215': 2, '222': 2 },
  },
  '214': {
    id: '214',
    costs: { metal: 5000000, crystal: 4000000, deuterium: 1000000 },
    speed: { base: 100, drive: 'hyperspace' },
    capacity: 1000000,
    fuel: 1,
    attack: 200000,
    shield: 50000,
    hull: 900000,
    expo: true,
    rapidfire: {
      '210': 1250, '212': 1250, '202': 250, '203': 250, '204': 200,
      '205': 100, '206': 33, '207': 30, '208': 250, '209': 250,
      '211': 25, '213': 5, '215': 15, '222': 18, '225': 140, '227': 100,
      '401': 200, '402': 200, '403': 100, '404': 50, '405': 100, '406': 5,
    },
  },
  '215': {
    id: '215',
    costs: { metal: 30000, crystal: 40000, deuterium: 15000 },
    speed: { base: 10000, drive: 'hyperspace' },
    capacity: 750,
    fuel: 250,
    attack: 700,
    shield: 400,
    hull: 7000,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '202': 3, '203': 3, '205': 4, '206': 4, '207': 7, '225': 4 },
  },

  // pr0game custom ships
  '222': {
    id: '222',
    costs: { metal: 30000, crystal: 12000, deuterium: 5000 },
    speed: { base: 5000, drive: 'hyperspace' },
    capacity: 1000,
    fuel: 500,
    attack: 620,
    shield: 100,
    hull: 4200,
    expo: true,
    rapidfire: { '210': 5, '212': 5, '202': 3, '203': 2, '204': 9, '205': 2, '206': 2, '225': 3, '401': 15 },
  },
  '225': {
    id: '225',
    costs: { metal: 4500, crystal: 3500, deuterium: 400 },
    speed: {
      base: 6500,
      drive: 'combustion',
      upgradeAt: { tech: 'impulse', level: 4, newSpeed: 10000, newDrive: 'impulse' },
    },
    capacity: 2000,
    fuel: 40,  // 50 after impulse upgrade
    attack: 50,
    shield: 25,
    hull: 800,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
  '227': {
    id: '227',
    costs: { metal: 26000, crystal: 14000, deuterium: 5000 },
    speed: { base: 4000, drive: 'impulse' },
    capacity: 35000,
    fuel: 750,
    attack: 1,
    shield: 50,
    hull: 4000,
    expo: true,
    rapidfire: { '210': 5, '212': 5 },
  },
};

// =============================================================================
// RESEARCH
// =============================================================================

export const RESEARCH: Record<string, ResearchData> = {
  '106': { id: '106', baseCosts: { metal: 200, crystal: 1000, deuterium: 200 }, factor: 2 },
  '108': { id: '108', baseCosts: { metal: 0, crystal: 400, deuterium: 600 }, factor: 2 },
  '109': { id: '109', baseCosts: { metal: 800, crystal: 200, deuterium: 0 }, factor: 2 },
  '110': { id: '110', baseCosts: { metal: 200, crystal: 600, deuterium: 0 }, factor: 2 },
  '111': { id: '111', baseCosts: { metal: 1000, crystal: 0, deuterium: 0 }, factor: 2 },
  '113': { id: '113', baseCosts: { metal: 0, crystal: 800, deuterium: 400 }, factor: 2 },
  '114': { id: '114', baseCosts: { metal: 0, crystal: 4000, deuterium: 2000 }, factor: 2 },
  '115': { id: '115', baseCosts: { metal: 400, crystal: 0, deuterium: 600 }, factor: 2 },
  '117': { id: '117', baseCosts: { metal: 2000, crystal: 4000, deuterium: 600 }, factor: 2 },
  '118': { id: '118', baseCosts: { metal: 10000, crystal: 20000, deuterium: 6000 }, factor: 2 },
  '120': { id: '120', baseCosts: { metal: 200, crystal: 100, deuterium: 0 }, factor: 2 },
  '121': { id: '121', baseCosts: { metal: 1000, crystal: 300, deuterium: 100 }, factor: 2 },
  '122': { id: '122', baseCosts: { metal: 2000, crystal: 4000, deuterium: 1000 }, factor: 2 },
  '123': { id: '123', baseCosts: { metal: 240000, crystal: 400000, deuterium: 160000 }, factor: 2 },
  '124': { id: '124', baseCosts: { metal: 4000, crystal: 8000, deuterium: 4000 }, factor: 1.75 },
  '131': { id: '131', baseCosts: { metal: 0, crystal: 800, deuterium: 400 }, factor: 2 },
  '132': { id: '132', baseCosts: { metal: 0, crystal: 800, deuterium: 400 }, factor: 2 },
  '133': { id: '133', baseCosts: { metal: 0, crystal: 800, deuterium: 400 }, factor: 2 },
  '199': { id: '199', baseCosts: { metal: 0, crystal: 0, deuterium: 0 }, factor: 3 }, // Graviton - special
};

// =============================================================================
// BUILDINGS
// =============================================================================

export const BUILDINGS: Record<string, BuildingData> = {
  '1': { id: '1', baseCosts: { metal: 60, crystal: 15, deuterium: 0 }, factor: 1.5 },
  '2': { id: '2', baseCosts: { metal: 48, crystal: 24, deuterium: 0 }, factor: 1.6 },
  '3': { id: '3', baseCosts: { metal: 225, crystal: 75, deuterium: 0 }, factor: 1.5 },
  '4': { id: '4', baseCosts: { metal: 75, crystal: 30, deuterium: 0 }, factor: 1.5 },
  '6': { id: '6', baseCosts: { metal: 200, crystal: 100, deuterium: 50 }, factor: 2 }, // Techno Dome / University
  '12': { id: '12', baseCosts: { metal: 900, crystal: 360, deuterium: 180 }, factor: 1.8 },
  '14': { id: '14', baseCosts: { metal: 400, crystal: 120, deuterium: 200 }, factor: 2 },
  '15': { id: '15', baseCosts: { metal: 1000000, crystal: 500000, deuterium: 100000 }, factor: 2 },
  '21': { id: '21', baseCosts: { metal: 400, crystal: 200, deuterium: 100 }, factor: 2 },
  '22': { id: '22', baseCosts: { metal: 1000, crystal: 0, deuterium: 0 }, factor: 2 },
  '23': { id: '23', baseCosts: { metal: 1000, crystal: 500, deuterium: 0 }, factor: 2 },
  '24': { id: '24', baseCosts: { metal: 1000, crystal: 1000, deuterium: 0 }, factor: 2 },
  '31': { id: '31', baseCosts: { metal: 200, crystal: 400, deuterium: 200 }, factor: 2 },
  '33': { id: '33', baseCosts: { metal: 0, crystal: 50000, deuterium: 100000 }, factor: 2 },
  '34': { id: '34', baseCosts: { metal: 20000, crystal: 40000, deuterium: 0 }, factor: 2 },
  '41': { id: '41', baseCosts: { metal: 20000, crystal: 40000, deuterium: 20000 }, factor: 2 },
  '42': { id: '42', baseCosts: { metal: 20000, crystal: 40000, deuterium: 20000 }, factor: 2 },
  '43': { id: '43', baseCosts: { metal: 2000000, crystal: 4000000, deuterium: 2000000 }, factor: 2 },
  '44': { id: '44', baseCosts: { metal: 20000, crystal: 20000, deuterium: 1000 }, factor: 2 },
};

// =============================================================================
// DEFENSE
// =============================================================================

export const DEFENSE: Record<string, DefenseData> = {
  '401': {
    id: '401',
    costs: { metal: 2000, crystal: 0, deuterium: 0 },
    attack: 80,
    shield: 20,
    hull: 200,
    expo: false,
  },
  '402': {
    id: '402',
    costs: { metal: 1500, crystal: 500, deuterium: 0 },
    attack: 100,
    shield: 25,
    hull: 200,
    expo: false,
  },
  '403': {
    id: '403',
    costs: { metal: 6000, crystal: 2000, deuterium: 0 },
    attack: 250,
    shield: 100,
    hull: 800,
    expo: false,
  },
  '404': {
    id: '404',
    costs: { metal: 20000, crystal: 15000, deuterium: 2000 },
    attack: 1100,
    shield: 200,
    hull: 3500,
    expo: false,
  },
  '405': {
    id: '405',
    costs: { metal: 5000, crystal: 3000, deuterium: 0 },
    attack: 150,
    shield: 500,
    hull: 800,
    expo: false,
  },
  '406': {
    id: '406',
    costs: { metal: 50000, crystal: 50000, deuterium: 30000 },
    attack: 3000,
    shield: 300,
    hull: 10000,
    expo: false,
  },
  '407': {
    id: '407',
    costs: { metal: 10000, crystal: 10000, deuterium: 0 },
    attack: 1,
    shield: 2000,
    hull: 2000,
    expo: false,
  },
  '408': {
    id: '408',
    costs: { metal: 50000, crystal: 50000, deuterium: 0 },
    attack: 1,
    shield: 10000,
    hull: 10000,
    expo: false,
  },
  '502': {
    id: '502',
    costs: { metal: 8000, crystal: 0, deuterium: 2000 },
    attack: 1,
    shield: 1,
    hull: 800,
    expo: false,
  },
  '503': {
    id: '503',
    costs: { metal: 12500, crystal: 2500, deuterium: 10000 },
    attack: 12000,
    shield: 1,
    hull: 1500,
    expo: false,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate points for a single ship/defense unit
 */
export function getUnitPoints(id: string, type: 'ship' | 'defense'): number {
  const data = type === 'ship' ? SHIPS[id] : DEFENSE[id];
  if (!data) return 0;
  const costs = data.costs;
  return Math.floor((costs.metal + costs.crystal + costs.deuterium) / 1000);
}

/**
 * Calculate total points for fleet
 */
export function calculateFleetPoints(fleet: Record<string, number>): number {
  let total = 0;
  for (const [id, count] of Object.entries(fleet)) {
    total += getUnitPoints(id, 'ship') * count;
  }
  return total;
}

/**
 * Calculate total costs for research from level 0 to target level
 * Formula: baseCost * (factor^level - 1) / (factor - 1)
 */
export function getResearchTotalCosts(id: string, level: number): { metal: number; crystal: number; deuterium: number } {
  const data = RESEARCH[id];
  if (!data || level < 1) return { metal: 0, crystal: 0, deuterium: 0 };

  // For factor = 2: total = baseCost * (2^level - 1)
  // General: total = baseCost * (factor^level - 1) / (factor - 1)
  const factor = data.factor;
  const multiplier = (Math.pow(factor, level) - 1) / (factor - 1);

  return {
    metal: Math.floor(data.baseCosts.metal * multiplier),
    crystal: Math.floor(data.baseCosts.crystal * multiplier),
    deuterium: Math.floor(data.baseCosts.deuterium * multiplier),
  };
}

/**
 * Calculate points for research at a specific level
 */
export function getResearchPoints(id: string, level: number): number {
  const costs = getResearchTotalCosts(id, level);
  return Math.floor((costs.metal + costs.crystal + costs.deuterium) / 1000);
}

/**
 * Calculate total research points for all techs
 */
export function calculateResearchPoints(research: Record<string, number>): number {
  let total = 0;
  for (const [id, level] of Object.entries(research)) {
    total += getResearchPoints(id, level);
  }
  return total;
}

/**
 * Get ship speed considering drive upgrades and tech levels
 */
export function getShipSpeed(
  shipId: string,
  combustion: number,
  impulse: number,
  hyperspace: number
): number {
  const ship = SHIPS[shipId];
  if (!ship) return 0;

  let baseSpeed = ship.speed.base;
  let drive = ship.speed.drive;

  // Check for drive upgrade
  if (ship.speed.upgradeAt) {
    const upgrade = ship.speed.upgradeAt;
    const techLevel = upgrade.tech === 'impulse' ? impulse : hyperspace;
    if (techLevel >= upgrade.level) {
      baseSpeed = upgrade.newSpeed;
      drive = upgrade.newDrive;
    }
  }

  // Apply tech bonus
  let bonus = 0;
  switch (drive) {
    case 'combustion':
      bonus = combustion * 0.1;
      break;
    case 'impulse':
      bonus = impulse * 0.2;
      break;
    case 'hyperspace':
      bonus = hyperspace * 0.3;
      break;
  }

  return Math.floor(baseSpeed * (1 + bonus));
}
