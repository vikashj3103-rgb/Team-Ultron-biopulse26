/**
 * HealthConnect Hospital Map & Graph-Based Wayfinding Service
 * 
 * Provides:
 * 1. Structured hospital location database (Ground, 1st, 2nd Floors).
 * 2. Dijkstra shortest-path pathfinding across hospital nodes including multi-floor lift/stair transitions.
 * 3. Human-friendly turn-by-turn wayfinding instructions for family caregivers and staff.
 */

import { HospitalLocationNode, NavigationRouteResult } from '../types';

export const HOSPITAL_NODES: HospitalLocationNode[] = [
  // =========================================================================
  // GROUND FLOOR (Floor 0)
  // =========================================================================
  {
    id: 'RECEPTION_GF',
    name: 'Main Reception & Information Desk',
    code: 'RECEPTION',
    type: 'reception',
    floor: 0,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Administration',
    x: 400,
    y: 420,
    connectedTo: ['CORRIDOR_GF_MAIN'],
  },
  {
    id: 'CORRIDOR_GF_MAIN',
    name: 'Ground Floor Central Concourse',
    code: 'CORRIDOR_GF',
    type: 'corridor',
    floor: 0,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'General',
    x: 400,
    y: 300,
    connectedTo: ['RECEPTION_GF', 'EMERGENCY_GF', 'PHARMACY_GF', 'LAB_GF', 'LIFT_GF', 'STAIRS_GF'],
  },
  {
    id: 'EMERGENCY_GF',
    name: 'Emergency & Trauma Care Ward',
    code: 'EMERGENCY',
    type: 'department',
    floor: 0,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Emergency',
    x: 180,
    y: 300,
    connectedTo: ['CORRIDOR_GF_MAIN'],
  },
  {
    id: 'PHARMACY_GF',
    name: 'Outpatient & Inpatient Pharmacy',
    code: 'PHARMACY',
    type: 'pharmacy',
    floor: 0,
    building: 'Main Hospital',
    wing: 'B',
    department: 'Pharmacy',
    x: 620,
    y: 300,
    connectedTo: ['CORRIDOR_GF_MAIN'],
  },
  {
    id: 'LAB_GF',
    name: 'Central Diagnostic Pathology Laboratory',
    code: 'LAB',
    type: 'lab',
    floor: 0,
    building: 'Main Hospital',
    wing: 'B',
    department: 'Diagnostics',
    x: 620,
    y: 180,
    connectedTo: ['CORRIDOR_GF_MAIN'],
  },
  {
    id: 'LIFT_GF',
    name: 'Central Hospital Elevator (Lifts 1-4)',
    code: 'LIFT_0',
    type: 'lift',
    floor: 0,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Vertical Transport',
    x: 360,
    y: 180,
    connectedTo: ['CORRIDOR_GF_MAIN', 'LIFT_1F', 'LIFT_2F'],
  },
  {
    id: 'STAIRS_GF',
    name: 'Central Stairwell A',
    code: 'STAIRS_0',
    type: 'stairs',
    floor: 0,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Vertical Transport',
    x: 440,
    y: 180,
    connectedTo: ['CORRIDOR_GF_MAIN', 'STAIRS_1F', 'STAIRS_2F'],
  },

  // =========================================================================
  // FIRST FLOOR (Floor 1)
  // =========================================================================
  {
    id: 'LIFT_1F',
    name: 'First Floor Elevator Lobby',
    code: 'LIFT_1',
    type: 'lift',
    floor: 1,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Vertical Transport',
    x: 360,
    y: 180,
    connectedTo: ['LIFT_GF', 'LIFT_2F', 'CORRIDOR_1F_MAIN'],
  },
  {
    id: 'STAIRS_1F',
    name: 'First Floor Stairwell Landing',
    code: 'STAIRS_1',
    type: 'stairs',
    floor: 1,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Vertical Transport',
    x: 440,
    y: 180,
    connectedTo: ['STAIRS_GF', 'STAIRS_2F', 'CORRIDOR_1F_MAIN'],
  },
  {
    id: 'CORRIDOR_1F_MAIN',
    name: 'First Floor Central Care Corridor',
    code: 'CORRIDOR_1F',
    type: 'corridor',
    floor: 1,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'General',
    x: 400,
    y: 280,
    connectedTo: ['LIFT_1F', 'STAIRS_1F', 'NURSE_1F', 'ICU_CORRIDOR_1F', 'GEN_MED_1F', 'SURGERY_1F'],
  },
  {
    id: 'NURSE_1F',
    name: 'Floor 1 Central Nursing Station',
    code: 'NURSE_STATION_1',
    type: 'department',
    floor: 1,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Nursing',
    x: 400,
    y: 360,
    connectedTo: ['CORRIDOR_1F_MAIN'],
  },
  {
    id: 'ICU_CORRIDOR_1F',
    name: 'ICU Critical Care Access Hallway',
    code: 'ICU_HALL',
    type: 'corridor',
    floor: 1,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Critical Care',
    x: 220,
    y: 280,
    connectedTo: ['CORRIDOR_1F_MAIN', 'ROOM_ICU_204', 'ROOM_ICU_206'],
  },
  {
    id: 'ROOM_ICU_204',
    name: 'ICU Room 204 (Bed A & B)',
    code: 'ICU-204',
    type: 'room',
    floor: 1,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Critical Care',
    x: 140,
    y: 200,
    connectedTo: ['ICU_CORRIDOR_1F'],
  },
  {
    id: 'ROOM_ICU_206',
    name: 'ICU Room 206 (Bed A & B)',
    code: 'ICU-206',
    type: 'room',
    floor: 1,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Critical Care',
    x: 140,
    y: 360,
    connectedTo: ['ICU_CORRIDOR_1F'],
  },
  {
    id: 'GEN_MED_1F',
    name: 'General Medicine Inpatient Ward',
    code: 'GEN_MED',
    type: 'department',
    floor: 1,
    building: 'Main Hospital',
    wing: 'B',
    department: 'General Medicine',
    x: 620,
    y: 220,
    connectedTo: ['CORRIDOR_1F_MAIN'],
  },
  {
    id: 'SURGERY_1F',
    name: 'Surgical Recovery Ward & OR Access',
    code: 'SURGERY',
    type: 'department',
    floor: 1,
    building: 'Main Hospital',
    wing: 'B',
    department: 'General Surgery',
    x: 620,
    y: 360,
    connectedTo: ['CORRIDOR_1F_MAIN'],
  },

  // =========================================================================
  // SECOND FLOOR (Floor 2)
  // =========================================================================
  {
    id: 'LIFT_2F',
    name: 'Second Floor Elevator Lobby',
    code: 'LIFT_2',
    type: 'lift',
    floor: 2,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Vertical Transport',
    x: 360,
    y: 180,
    connectedTo: ['LIFT_GF', 'LIFT_1F', 'CORRIDOR_2F_MAIN'],
  },
  {
    id: 'STAIRS_2F',
    name: 'Second Floor Stairwell Landing',
    code: 'STAIRS_2',
    type: 'stairs',
    floor: 2,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Vertical Transport',
    x: 440,
    y: 180,
    connectedTo: ['STAIRS_GF', 'STAIRS_1F', 'CORRIDOR_2F_MAIN'],
  },
  {
    id: 'CORRIDOR_2F_MAIN',
    name: 'Second Floor Specialty Care Concourse',
    code: 'CORRIDOR_2F',
    type: 'corridor',
    floor: 2,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'General',
    x: 400,
    y: 280,
    connectedTo: ['LIFT_2F', 'STAIRS_2F', 'NURSE_2F', 'CARDIOLOGY_CORRIDOR_2F', 'NEUROLOGY_2F', 'RADIOLOGY_2F'],
  },
  {
    id: 'NURSE_2F',
    name: 'Floor 2 Cardiology & Neuro Nursing Desk',
    code: 'NURSE_STATION_2',
    type: 'department',
    floor: 2,
    building: 'Main Hospital',
    wing: 'Central',
    department: 'Nursing',
    x: 400,
    y: 380,
    connectedTo: ['CORRIDOR_2F_MAIN'],
  },
  {
    id: 'CARDIOLOGY_CORRIDOR_2F',
    name: 'Cardiology Clinical Corridor',
    code: 'CARDIO_HALL',
    type: 'corridor',
    floor: 2,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Cardiology',
    x: 240,
    y: 280,
    connectedTo: ['CORRIDOR_2F_MAIN', 'ROOM_11002', 'CARDIO_OPD_2F'],
  },
  {
    id: 'ROOM_11002',
    name: 'Cardiology Consultation Room 11002',
    code: '11002',
    type: 'room',
    floor: 2,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Cardiology',
    x: 140,
    y: 200,
    connectedTo: ['CARDIOLOGY_CORRIDOR_2F'],
  },
  {
    id: 'CARDIO_OPD_2F',
    name: 'Cardiology Echo & ECG Diagnostics Unit',
    code: 'CARDIO_ECHO',
    type: 'department',
    floor: 2,
    building: 'Main Hospital',
    wing: 'A',
    department: 'Cardiology',
    x: 140,
    y: 360,
    connectedTo: ['CARDIOLOGY_CORRIDOR_2F'],
  },
  {
    id: 'NEUROLOGY_2F',
    name: 'Neurology & Stroke Inpatient Unit',
    code: 'NEUROLOGY',
    type: 'department',
    floor: 2,
    building: 'Main Hospital',
    wing: 'B',
    department: 'Neurology',
    x: 620,
    y: 200,
    connectedTo: ['CORRIDOR_2F_MAIN'],
  },
  {
    id: 'RADIOLOGY_2F',
    name: 'Diagnostic Radiology & CT/MRI Imaging',
    code: 'RADIOLOGY',
    type: 'department',
    floor: 2,
    building: 'Main Hospital',
    wing: 'B',
    department: 'Radiology',
    x: 620,
    y: 360,
    connectedTo: ['CORRIDOR_2F_MAIN'],
  },
];

class HospitalMapService {
  private nodes: Map<string, HospitalLocationNode> = new Map();

  constructor() {
    HOSPITAL_NODES.forEach((node) => {
      this.nodes.set(node.id, node);
    });
  }

  public getAllNodes(): HospitalLocationNode[] {
    return Array.from(this.nodes.values());
  }

  public getNodesByFloor(floor: number): HospitalLocationNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.floor === floor);
  }

  public getNodeById(id: string): HospitalLocationNode | undefined {
    if (this.nodes.has(id)) return this.nodes.get(id);
    if (id === 'ICU_204') return this.nodes.get('ROOM_ICU_204');
    if (id === 'CARDIO_11002') return this.nodes.get('ROOM_11002');
    return undefined;
  }

  /**
   * Search location node by keyword, room number, or department name
   */
  public findLocation(query: string): HospitalLocationNode | undefined {
    if (!query) return undefined;
    const clean = query.toLowerCase().trim();

    // 1. Direct code match (e.g. "11002", "ICU-204", "PHARMACY")
    for (const node of this.nodes.values()) {
      if (node.code.toLowerCase() === clean) return node;
    }

    // 2. Exact word / substring match on code or name
    for (const node of this.nodes.values()) {
      if (node.code.toLowerCase().includes(clean) || node.name.toLowerCase().includes(clean)) {
        return node;
      }
    }

    // 3. Department match
    for (const node of this.nodes.values()) {
      if (node.department && node.department.toLowerCase().includes(clean)) {
        return node;
      }
    }

    return undefined;
  }

  public findNodeByQuery(query: string): HospitalLocationNode | undefined {
    return this.findLocation(query);
  }

  /**
   * Calculates the shortest path between two hospital nodes using Dijkstra's algorithm.
   */
  public findShortestPath(startNodeId: string, targetNodeId: string, lang?: string): NavigationRouteResult | null {
    const start = this.nodes.get(startNodeId);
    const target = this.nodes.get(targetNodeId);

    if (!start || !target) return null;
    if (start.id === target.id) {
      return {
        fromNode: start,
        toNode: target,
        path: [start],
        totalDistanceMeters: 0,
        estimatedMinutes: 0,
        floorChanges: false,
        instructions: [`You are already at ${target.name}.`],
      };
    }

    // Dijkstra implementation
    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const unvisited: Set<string> = new Set();

    this.nodes.forEach((node) => {
      distances.set(node.id, Infinity);
      previous.set(node.id, null);
      unvisited.add(node.id);
    });

    distances.set(start.id, 0);

    while (unvisited.size > 0) {
      // Find node with minimum distance
      let currentId: string | null = null;
      let minDistance = Infinity;

      unvisited.forEach((nodeId) => {
        const dist = distances.get(nodeId)!;
        if (dist < minDistance) {
          minDistance = dist;
          currentId = nodeId;
        }
      });

      if (!currentId || minDistance === Infinity) break;
      if (currentId === target.id) break;

      unvisited.delete(currentId);
      const currentNode = this.nodes.get(currentId)!;

      // Inspect neighbors
      for (const neighborId of currentNode.connectedTo) {
        if (!unvisited.has(neighborId)) continue;
        const neighborNode = this.nodes.get(neighborId);
        if (!neighborNode) continue;

        // Weight calculation: Euclidean 2D distance + floor penalty
        let weight = Math.hypot(currentNode.x - neighborNode.x, currentNode.y - neighborNode.y) * 0.15;
        if (currentNode.floor !== neighborNode.floor) {
          weight += 25; // 25 meters equivalent floor transition
        }

        const alt = distances.get(currentId)! + weight;
        if (alt < distances.get(neighborId)!) {
          distances.set(neighborId, alt);
          previous.set(neighborId, currentId);
        }
      }
    }

    // Reconstruct path
    const path: HospitalLocationNode[] = [];
    let curr: string | null = target.id;
    while (curr) {
      const node = this.nodes.get(curr);
      if (node) path.unshift(node);
      curr = previous.get(curr) || null;
    }

    if (path.length === 0 || path[0].id !== start.id) {
      return null; // No route found
    }

    const totalDistanceMeters = Math.max(10, Math.round(distances.get(target.id) || 20));
    const estimatedMinutes = Math.max(1, Math.round(totalDistanceMeters / 45) + (start.floor !== target.floor ? 1 : 0));
    const floorChanges = start.floor !== target.floor;

    // Generate clear human-friendly instructions
    const instructions = this.generateInstructions(path, start, target, lang);

    return {
      fromNode: start,
      toNode: target,
      path,
      totalDistanceMeters,
      estimatedMinutes,
      floorChanges,
      instructions,
    };
  }

  public getLocalizedNodeName(nodeOrId: string | HospitalLocationNode, lang?: string): string {
    const node = typeof nodeOrId === 'string' ? this.getNodeById(nodeOrId) : nodeOrId;
    if (!node) return typeof nodeOrId === 'string' ? nodeOrId : '';

    if (lang === 'ta') {
      if (node.id === 'PHARMACY_GF') return 'மத்திய மருந்தகம் (Pharmacy)';
      if (node.id === 'EMERGENCY_GF') return 'அவசர சிகிச்சை பிரிவு (Emergency)';
      if (node.id === 'LAB_GF') return 'நோயறிதல் ஆய்வகம் (Lab)';
      if (node.id === 'RECEPTION_GF') return 'வரவேற்பு மற்றும் தகவல் மையம் (Reception)';
      if (node.id === 'ROOM_11002') return 'இதயவியல் அறை 11002 (Cardiology)';
      if (node.id.startsWith('ROOM_ICU_')) return `ICU அறை ${node.code}`;
      if (node.type === 'lift') return `மத்திய லிப்ட் (${node.code})`;
      if (node.type === 'stairs') return `படிக்கட்டு (${node.code})`;
    } else if (lang === 'hi') {
      if (node.id === 'PHARMACY_GF') return 'केंद्रीय फार्मेसी (Pharmacy)';
      if (node.id === 'EMERGENCY_GF') return 'आपातकालीन वार्ड (Emergency)';
      if (node.id === 'LAB_GF') return 'पैथोलॉजी लैब (Lab)';
      if (node.id === 'RECEPTION_GF') return 'मुख्य स्वागत कक्ष (Reception)';
      if (node.id === 'ROOM_11002') return 'कार्डियोलॉजी कमरा 11002 (Cardiology)';
      if (node.id.startsWith('ROOM_ICU_')) return `ICU कमरा ${node.code}`;
      if (node.type === 'lift') return `सेंट्रल लिफ्ट (${node.code})`;
      if (node.type === 'stairs') return `सीढ़ियां (${node.code})`;
    } else if (lang === 'te') {
      if (node.id === 'PHARMACY_GF') return 'కేంద్ర ఫార్మసీ (Pharmacy)';
      if (node.id === 'EMERGENCY_GF') return 'అత్యవసర విభాగం (Emergency)';
      if (node.id === 'LAB_GF') return 'పాథాలజీ ల్యాబ్ (Lab)';
      if (node.id === 'RECEPTION_GF') return 'రిసెప్షన్ డెస్క్ (Reception)';
      if (node.id === 'ROOM_11002') return 'కార్డియాలజీ గది 11002 (Cardiology)';
      if (node.id.startsWith('ROOM_ICU_')) return `ICU గది ${node.code}`;
      if (node.type === 'lift') return `లిఫ్ట్ (${node.code})`;
    }
    return node.name;
  }

  private generateInstructions(
    path: HospitalLocationNode[],
    start: HospitalLocationNode,
    target: HospitalLocationNode,
    lang?: string
  ): string[] {
    const steps: string[] = [];
    const floorNames = ['Ground Floor', 'Floor 1', 'Floor 2'];
    const targetName = this.getLocalizedNodeName(target, lang);

    if (lang === 'ta') {
      steps.push(`${start.code}-இலிருந்து தொடங்கவும் (Floor ${start.floor}).`);
      if (start.floor !== target.floor) {
        steps.push(`மத்திய லிப்ட் நோக்கி செல்லவும்.`);
        steps.push(`Floor ${target.floor}-க்கு லிப்டில் செல்லவும்.`);
      }
      if (target.wing && target.wing !== 'Central') {
        steps.push(`${target.wing} Wing நோக்கி செல்லவும்.`);
      }
      steps.push(`${targetName}-ஐ (${target.code}) அடையவும்.`);
      return steps;
    }

    if (lang === 'hi') {
      steps.push(`${start.code} से शुरू करें (मंजिल ${start.floor})।`);
      if (start.floor !== target.floor) {
        steps.push(`सेंट्रल लिफ्ट की ओर बढ़ें।`);
        steps.push(`लिफ्ट से मंजिल ${target.floor} पर जाएं।`);
      }
      if (target.wing && target.wing !== 'Central') {
        steps.push(`${target.wing} Wing की ओर बढ़ें।`);
      }
      steps.push(`${targetName} (${target.code}) पर पहुंचे।`);
      return steps;
    }

    if (lang === 'te') {
      steps.push(`${start.code} నుండి ప్రారంభించండి (ఫ్లోర్ ${start.floor}).`);
      if (start.floor !== target.floor) {
        steps.push(`సెంట్రల్ లిఫ్ట్ వైపు వెళ్లండి.`);
        steps.push(`లిఫ్ట్ ద్వారా ఫ్లోర్ ${target.floor} కి వెళ్ళండి.`);
      }
      if (target.wing && target.wing !== 'Central') {
        steps.push(`${target.wing} వింగ్ వైపు నడవండి.`);
      }
      steps.push(`${targetName} (${target.code}) వద్దకు చేరుకోండి.`);
      return steps;
    }

    // Default English
    steps.push(`Start from ${start.name} on ${floorNames[start.floor] || `Floor ${start.floor}`}.`);

    if (start.floor !== target.floor) {
      const verticalNode = path.find((n) => n.type === 'lift' || n.type === 'stairs');
      if (verticalNode && verticalNode.type === 'lift') {
        steps.push(`Walk toward the Central Elevator on ${floorNames[start.floor]}.`);
        steps.push(`Take the elevator to ${floorNames[target.floor]}.`);
      } else {
        steps.push(`Walk to Central Stairwell A on ${floorNames[start.floor]}.`);
        steps.push(`Take the stairs to ${floorNames[target.floor]}.`);
      }
    }

    // Wing & hallway direction
    if (target.wing && target.wing !== 'Central') {
      steps.push(`Exit into the corridor and head toward Wing ${target.wing}.`);
    } else {
      steps.push(`Exit into the central corridor.`);
    }

    steps.push(`Walk approximately ${Math.round(path.length * 8)} meters to reach ${target.name}.`);
    steps.push(`Destination reached: ${target.name} (${target.code}).`);

    return steps;
  }
}

export const hospitalMapService = new HospitalMapService();
