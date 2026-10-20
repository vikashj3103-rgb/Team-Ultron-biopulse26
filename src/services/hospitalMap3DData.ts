/**
 * HealthConnect 3D Hospital Indoor Map Data
 * 
 * Provides architectural geometry, room dimensions, doorways with swing arcs,
 * interior hospital furniture/equipment glyphs, continuous corridors, and vertical
 * elevator shafts across Ground Floor (0), Floor 1, and Floor 2.
 * Fully mapped to existing node IDs from hospitalMapService.ts.
 */

export interface DoorDefinition {
  x: number;
  y: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  width: number;
}

export interface Room3DDefinition {
  id: string;
  floor: number;
  name: string;
  code: string;
  type: 'room' | 'department' | 'icu' | 'pharmacy' | 'lab' | 'lift' | 'stairs' | 'reception' | 'nurse' | 'corridor';
  x: number;
  y: number;
  width: number;
  height: number;
  door: DoorDefinition;
  interiorType: 'beds_icu' | 'beds_inpatient' | 'desk_consult' | 'nurse_station' | 'elevator' | 'stairs' | 'emergency_bays' | 'pharmacy_counter' | 'lab_benches' | 'reception_counter' | 'radiology_scanner';
  wing: 'A' | 'B' | 'Central';
  department: string;
  subtitle: string;
  details?: string;
  interiorPoint: { x: number; y: number };
  hallwayPoint: { x: number; y: number };
}

export interface CorridorDefinition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface Floor3DDefinition {
  floor: number;
  name: string;
  shortName: string;
  subtitle: string;
  corridors: CorridorDefinition[];
  rooms: Room3DDefinition[];
}

export const SHARED_VERTICAL_SHAFT = {
  elevator: { x: 330, y: 70, width: 68, height: 85, doorY: 155 },
  stairs: { x: 410, y: 70, width: 68, height: 85, doorY: 155 },
};

export const HOSPITAL_FLOORS_3D: Floor3DDefinition[] = [
  // =========================================================================
  // GROUND FLOOR (0) - Emergency, Outpatient Pharmacy, Central Lab & Reception
  // =========================================================================
  {
    floor: 0,
    name: 'Ground Floor',
    shortName: 'Ground',
    subtitle: 'Emergency Trauma, Outpatient Pharmacy, Diagnostic Lab & Reception',
    corridors: [
      { x1: 220, y1: 280, x2: 600, y2: 280, width: 44 }, // Main Horizontal Concourse
      { x1: 220, y1: 150, x2: 220, y2: 440, width: 40 }, // Emergency / West Wing Corridor
      { x1: 600, y1: 90, x2: 600, y2: 450, width: 40 },  // Pharmacy / Lab East Corridor
      { x1: 364, y1: 155, x2: 364, y2: 280, width: 48 }, // Elevator Concourse
      { x1: 444, y1: 155, x2: 444, y2: 280, width: 48 }, // Stairs Concourse
    ],
    rooms: [
      {
        id: 'EMERGENCY_GF',
        floor: 0,
        name: 'Emergency & Trauma Care Unit',
        code: 'EMERGENCY',
        type: 'department',
        x: 60,
        y: 150,
        width: 160,
        height: 230,
        door: { x: 220, y: 265, side: 'right', width: 34 },
        interiorType: 'emergency_bays',
        wing: 'A',
        department: 'Emergency Medicine',
        subtitle: 'Resuscitation & Acute Trauma Bays',
        details: 'Triage Bays 01-08 • Direct Ambulance Portico Access',
        interiorPoint: { x: 140, y: 265 },
        hallwayPoint: { x: 220, y: 280 },
      },
      {
        id: 'RECEPTION_GF',
        floor: 0,
        name: 'Main Reception & Patient Desk',
        code: 'RECEPTION',
        type: 'reception',
        x: 310,
        y: 330,
        width: 180,
        height: 110,
        door: { x: 400, y: 330, side: 'top', width: 50 },
        interiorType: 'reception_counter',
        wing: 'Central',
        department: 'Administration',
        subtitle: 'Admissions & Inpatient Information Desk',
        details: '24/7 Information, Wheelchair Assistance & Visitor Badging',
        interiorPoint: { x: 400, y: 385 },
        hallwayPoint: { x: 400, y: 280 },
      },
      {
        id: 'LIFT_GF',
        floor: 0,
        name: 'Central Hospital Elevator (Lifts 1-4)',
        code: 'LIFT_0',
        type: 'lift',
        x: 330,
        y: 70,
        width: 68,
        height: 85,
        door: { x: 364, y: 155, side: 'bottom', width: 32 },
        interiorType: 'elevator',
        wing: 'Central',
        department: 'Vertical Transport',
        subtitle: 'Lifts 1-4 • Access to Floors 1 & 2',
        details: 'High-speed hospital bed elevator with medical priority recall',
        interiorPoint: { x: 364, y: 115 },
        hallwayPoint: { x: 364, y: 180 },
      },
      {
        id: 'STAIRS_GF',
        floor: 0,
        name: 'Central Stairwell A',
        code: 'STAIRS_0',
        type: 'stairs',
        x: 410,
        y: 70,
        width: 68,
        height: 85,
        door: { x: 444, y: 155, side: 'bottom', width: 32 },
        interiorType: 'stairs',
        wing: 'Central',
        department: 'Vertical Transport',
        subtitle: 'Fire Exit & Inter-floor Stairs',
        details: 'Wide architectural stairs with emergency LED guide rails',
        interiorPoint: { x: 444, y: 115 },
        hallwayPoint: { x: 444, y: 180 },
      },
      {
        id: 'LAB_GF',
        floor: 0,
        name: 'Central Pathology Laboratory',
        code: 'LAB',
        type: 'lab',
        x: 600,
        y: 90,
        width: 180,
        height: 160,
        door: { x: 600, y: 170, side: 'left', width: 30 },
        interiorType: 'lab_benches',
        wing: 'B',
        department: 'Pathology & Diagnostics',
        subtitle: 'Hematology, Biochemistry & Blood Bank',
        details: 'Automated CBC, Serum Panels & Urgent Crossmatching',
        interiorPoint: { x: 680, y: 170 },
        hallwayPoint: { x: 600, y: 170 },
      },
      {
        id: 'PHARMACY_GF',
        floor: 0,
        name: 'Central Hospital Pharmacy',
        code: 'PHARMACY',
        type: 'pharmacy',
        x: 600,
        y: 290,
        width: 180,
        height: 160,
        door: { x: 600, y: 355, side: 'left', width: 32 },
        interiorType: 'pharmacy_counter',
        wing: 'B',
        department: 'Pharmacy',
        subtitle: 'Inpatient & Discharge Dispensing Desk',
        details: '24/7 Prescription Refills, IV Fluids & Medication Verification',
        interiorPoint: { x: 680, y: 355 },
        hallwayPoint: { x: 600, y: 355 },
      },
    ],
  },

  // =========================================================================
  // FLOOR 1 - Critical Care ICU, Inpatient Wards & Nursing Station
  // =========================================================================
  {
    floor: 1,
    name: 'Floor 1 — Critical Care',
    shortName: 'Floor 1',
    subtitle: 'ICU Wards, Inpatient Rooms & Central Nursing Station',
    corridors: [
      { x1: 200, y1: 280, x2: 600, y2: 280, width: 44 }, // Main Inpatient Concourse
      { x1: 200, y1: 90, x2: 200, y2: 450, width: 40 },  // ICU Wing Hallway
      { x1: 600, y1: 90, x2: 600, y2: 450, width: 40 },  // East Inpatient Corridor
      { x1: 364, y1: 155, x2: 364, y2: 280, width: 48 }, // Lift Lobby
      { x1: 444, y1: 155, x2: 444, y2: 280, width: 48 }, // Stair Landing
    ],
    rooms: [
      {
        id: 'ROOM_ICU_204',
        floor: 1,
        name: 'ICU Room 204 (Bed A & B)',
        code: 'ICU-204',
        type: 'icu',
        x: 60,
        y: 90,
        width: 140,
        height: 160,
        door: { x: 200, y: 170, side: 'right', width: 30 },
        interiorType: 'beds_icu',
        wing: 'A',
        department: 'Critical Care ICU',
        subtitle: 'Room 204 • Bed A & Bed B',
        details: 'Post-MI Cardiac Monitoring • Active Telemetry • Bed A1, A2',
        interiorPoint: { x: 120, y: 170 },
        hallwayPoint: { x: 200, y: 170 },
      },
      {
        id: 'ROOM_ICU_206',
        floor: 1,
        name: 'ICU Room 206 (Bed A & B)',
        code: 'ICU-206',
        type: 'icu',
        x: 60,
        y: 290,
        width: 140,
        height: 160,
        door: { x: 200, y: 360, side: 'right', width: 30 },
        interiorType: 'beds_icu',
        wing: 'A',
        department: 'Critical Care ICU',
        subtitle: 'Room 206 • Bed A & Bed B',
        details: 'High Dependency Unit • Continuous Pulse Oximetry',
        interiorPoint: { x: 120, y: 360 },
        hallwayPoint: { x: 200, y: 360 },
      },
      {
        id: 'LIFT_1F',
        floor: 1,
        name: 'First Floor Elevator Lobby',
        code: 'LIFT_1',
        type: 'lift',
        x: 330,
        y: 70,
        width: 68,
        height: 85,
        door: { x: 364, y: 155, side: 'bottom', width: 32 },
        interiorType: 'elevator',
        wing: 'Central',
        department: 'Vertical Transport',
        subtitle: 'Elevator Lobby 1F • Lifts 1-4',
        details: 'Direct vertical transit to Ground Floor and Floor 2',
        interiorPoint: { x: 364, y: 115 },
        hallwayPoint: { x: 364, y: 180 },
      },
      {
        id: 'STAIRS_1F',
        floor: 1,
        name: 'First Floor Stairwell Landing',
        code: 'STAIRS_1',
        type: 'stairs',
        x: 410,
        y: 70,
        width: 68,
        height: 85,
        door: { x: 444, y: 155, side: 'bottom', width: 32 },
        interiorType: 'stairs',
        wing: 'Central',
        department: 'Vertical Transport',
        subtitle: 'Central Stairwell 1F',
        details: 'Heavy-duty stairwell with fire separation doors',
        interiorPoint: { x: 444, y: 115 },
        hallwayPoint: { x: 444, y: 180 },
      },
      {
        id: 'NURSE_1F',
        floor: 1,
        name: 'Floor 1 Central Nursing Station',
        code: 'NURSE_1',
        type: 'nurse',
        x: 325,
        y: 335,
        width: 155,
        height: 105,
        door: { x: 400, y: 335, side: 'top', width: 44 },
        interiorType: 'nurse_station',
        wing: 'Central',
        department: 'Nursing Administration',
        subtitle: 'Duty Station • Nurse Sarah Jenkins',
        details: 'Bedside Call Response Hub, Infusion Pumps & Crash Cart 1A',
        interiorPoint: { x: 400, y: 385 },
        hallwayPoint: { x: 400, y: 280 },
      },
      {
        id: 'GEN_MED_1F',
        floor: 1,
        name: 'General Medicine Inpatient Ward',
        code: 'GEN_MED',
        type: 'department',
        x: 600,
        y: 90,
        width: 180,
        height: 160,
        door: { x: 600, y: 170, side: 'left', width: 30 },
        interiorType: 'beds_inpatient',
        wing: 'B',
        department: 'General Medicine',
        subtitle: 'Ward 1 • Beds 01 to 12',
        details: 'Subacute monitoring, patient ambulation & dietary care',
        interiorPoint: { x: 680, y: 170 },
        hallwayPoint: { x: 600, y: 170 },
      },
      {
        id: 'SURGERY_1F',
        floor: 1,
        name: 'Surgical Recovery Ward & OR Access',
        code: 'SURGERY',
        type: 'department',
        x: 600,
        y: 290,
        width: 180,
        height: 160,
        door: { x: 600, y: 360, side: 'left', width: 30 },
        interiorType: 'beds_inpatient',
        wing: 'B',
        department: 'General Surgery',
        subtitle: 'Post-Op Recovery & Observation',
        details: 'Anesthesia recovery bays, pain management & wound care',
        interiorPoint: { x: 680, y: 360 },
        hallwayPoint: { x: 600, y: 360 },
      },
    ],
  },

  // =========================================================================
  // FLOOR 2 - Cardiology Consultation, OPD, Radiology & Neurology
  // =========================================================================
  {
    floor: 2,
    name: 'Floor 2 — Cardiology & Specialty',
    shortName: 'Floor 2',
    subtitle: 'Cardiology Clinics, Echo/ECG Diagnostic Suites & Radiology',
    corridors: [
      { x1: 200, y1: 280, x2: 600, y2: 280, width: 44 }, // Specialty Concourse
      { x1: 200, y1: 90, x2: 200, y2: 450, width: 40 },  // Cardiology Wing Corridor
      { x1: 600, y1: 90, x2: 600, y2: 450, width: 40 },  // East Diagnostic Hall
      { x1: 364, y1: 155, x2: 364, y2: 280, width: 48 }, // Lift Lobby
      { x1: 444, y1: 155, x2: 444, y2: 280, width: 48 }, // Stair Landing
    ],
    rooms: [
      {
        id: 'ROOM_11002',
        floor: 2,
        name: 'Cardiology Consultation Room 11002',
        code: '11002',
        type: 'room',
        x: 60,
        y: 90,
        width: 140,
        height: 160,
        door: { x: 200, y: 170, side: 'right', width: 30 },
        interiorType: 'desk_consult',
        wing: 'A',
        department: 'Cardiology OPD',
        subtitle: 'Room 001 • Dr. Arun Patel (Cardiologist)',
        details: 'Echo, 12-Lead ECG, Post-Procedure Review & Auscultation',
        interiorPoint: { x: 120, y: 170 },
        hallwayPoint: { x: 200, y: 170 },
      },
      {
        id: 'CARDIO_OPD_2F',
        floor: 2,
        name: 'Cardiology Outpatient Clinic & Echo Lab',
        code: 'CARDIO_OPD',
        type: 'department',
        x: 60,
        y: 290,
        width: 140,
        height: 160,
        door: { x: 200, y: 360, side: 'right', width: 30 },
        interiorType: 'desk_consult',
        wing: 'A',
        department: 'Cardiology OPD',
        subtitle: 'Stress Test & Holter Monitoring',
        details: 'Treadmill ECG, Echocardiography & Lipid Profiling Desk',
        interiorPoint: { x: 120, y: 360 },
        hallwayPoint: { x: 200, y: 360 },
      },
      {
        id: 'LIFT_2F',
        floor: 2,
        name: 'Second Floor Elevator Lobby',
        code: 'LIFT_2',
        type: 'lift',
        x: 330,
        y: 70,
        width: 68,
        height: 85,
        door: { x: 364, y: 155, side: 'bottom', width: 32 },
        interiorType: 'elevator',
        wing: 'Central',
        department: 'Vertical Transport',
        subtitle: 'Elevator Lobby 2F • Lifts 1-4',
        details: 'Direct vertical transit to Floor 1 and Ground Floor',
        interiorPoint: { x: 364, y: 115 },
        hallwayPoint: { x: 364, y: 180 },
      },
      {
        id: 'STAIRS_2F',
        floor: 2,
        name: 'Second Floor Stairwell Landing',
        code: 'STAIRS_2',
        type: 'stairs',
        x: 410,
        y: 70,
        width: 68,
        height: 85,
        door: { x: 444, y: 155, side: 'bottom', width: 32 },
        interiorType: 'stairs',
        wing: 'Central',
        department: 'Vertical Transport',
        subtitle: 'Central Stairwell 2F',
        details: 'Emergency descent corridor and roof access door',
        interiorPoint: { x: 444, y: 115 },
        hallwayPoint: { x: 444, y: 180 },
      },
      {
        id: 'NURSE_2F',
        floor: 2,
        name: 'Floor 2 Cardiology & Neuro Nursing Desk',
        code: 'NURSE_2',
        type: 'nurse',
        x: 325,
        y: 335,
        width: 155,
        height: 105,
        door: { x: 400, y: 335, side: 'top', width: 44 },
        interiorType: 'nurse_station',
        wing: 'Central',
        department: 'Specialty Nursing Desk',
        subtitle: 'Cardiology Triage & Pre-Op Desk',
        details: 'Nurse triage, pre-catheterization preparation & vitals check',
        interiorPoint: { x: 400, y: 385 },
        hallwayPoint: { x: 400, y: 280 },
      },
      {
        id: 'NEUROLOGY_2F',
        floor: 2,
        name: 'Neurology Consultation & Stroke Unit',
        code: 'NEURO',
        type: 'department',
        x: 600,
        y: 90,
        width: 180,
        height: 160,
        door: { x: 600, y: 170, side: 'left', width: 30 },
        interiorType: 'desk_consult',
        wing: 'B',
        department: 'Neurology',
        subtitle: 'Stroke Care & Neuro Recovery',
        details: 'Continuous Glasgow Coma Scale tracking & neuro-rehab beds',
        interiorPoint: { x: 680, y: 170 },
        hallwayPoint: { x: 600, y: 170 },
      },
      {
        id: 'RADIOLOGY_2F',
        floor: 2,
        name: 'Diagnostic Radiology & CT/MRI Imaging',
        code: 'RADIOLOGY',
        type: 'department',
        x: 600,
        y: 290,
        width: 180,
        height: 160,
        door: { x: 600, y: 360, side: 'left', width: 30 },
        interiorType: 'radiology_scanner',
        wing: 'B',
        department: 'Radiology & Imaging',
        subtitle: '3T MRI, 128-Slice CT & Digital X-Ray',
        details: 'PAC-linked PACS diagnostic imaging with lead-shielded suites',
        interiorPoint: { x: 680, y: 360 },
        hallwayPoint: { x: 600, y: 360 },
      },
    ],
  },
];

export const getFloor3DData = (floorNumber: number): Floor3DDefinition | undefined => {
  return HOSPITAL_FLOORS_3D.find((f) => f.floor === floorNumber);
};

export const getRoom3DById = (id: string): Room3DDefinition | undefined => {
  for (const floor of HOSPITAL_FLOORS_3D) {
    const room = floor.rooms.find((r) => r.id === id);
    if (room) return room;
  }
  return undefined;
};

/**
 * Calculates genuine corridor wayfinding waypoints on a specific floor.
 * Connects the origin through its doorway, along the corridor network,
 * to either the destination or the vertical elevator shaft.
 */
export const getArchitecturalRoutePoints = (
  originId: string,
  destinationId: string,
  activeFloor: number
): { x: number; y: number }[] => {
  const floorData = getFloor3DData(activeFloor);
  if (!floorData) return [];

  const originRoom = getRoom3DById(originId);
  const destRoom = getRoom3DById(destinationId);

  if (!originRoom || !destRoom) return [];

  // Determine start & end targets on THIS active floor
  let startPt: { x: number; y: number };
  let startDoor: { x: number; y: number };
  let startHall: { x: number; y: number };

  let endPt: { x: number; y: number };
  let endDoor: { x: number; y: number };
  let endHall: { x: number; y: number };

  const elevatorRoom = floorData.rooms.find((r) => r.type === 'lift') || floorData.rooms[0];

  // 1. Where does the route originate on THIS floor?
  if (originRoom.floor === activeFloor) {
    startPt = originRoom.interiorPoint;
    startDoor = { x: originRoom.door.x, y: originRoom.door.y };
    startHall = originRoom.hallwayPoint;
  } else {
    // Coming from another floor via elevator!
    startPt = elevatorRoom.interiorPoint;
    startDoor = { x: elevatorRoom.door.x, y: elevatorRoom.door.y };
    startHall = elevatorRoom.hallwayPoint;
  }

  // 2. Where does the route terminate on THIS floor?
  if (destRoom.floor === activeFloor) {
    endPt = destRoom.interiorPoint;
    endDoor = { x: destRoom.door.x, y: destRoom.door.y };
    endHall = destRoom.hallwayPoint;
  } else {
    // Going to another floor via elevator!
    endPt = elevatorRoom.interiorPoint;
    endDoor = { x: elevatorRoom.door.x, y: elevatorRoom.door.y };
    endHall = elevatorRoom.hallwayPoint;
  }

  // Build the contiguous corridor path:
  const points: { x: number; y: number }[] = [];

  // Add starting points: Interior -> Door -> Hallway
  points.push(startPt);
  if (startDoor.x !== startPt.x || startDoor.y !== startPt.y) {
    points.push(startDoor);
  }
  if (startHall.x !== startDoor.x || startHall.y !== startDoor.y) {
    points.push(startHall);
  }

  // Corridor Navigation logic:
  // Main concourse is at y = 280.
  // Central elevator/stairs hallway connects to y = 280 at x = 364 / 444.
  // West corridor is at x = 200 (or 220 on GF).
  // East corridor is at x = 600.
  const concourseY = 280;

  // From startHall to Concourse:
  if (startHall.y !== concourseY) {
    points.push({ x: startHall.x, y: concourseY });
  }

  // Along Concourse to endHall's corridor x-coordinate:
  if (startHall.x !== endHall.x) {
    points.push({ x: endHall.x, y: concourseY });
  }

  // From Concourse to endHall:
  if (endHall.y !== concourseY) {
    points.push({ x: endHall.x, y: endHall.y });
  }

  // Through Door into Interior:
  if (endDoor.x !== endHall.x || endDoor.y !== endHall.y) {
    points.push(endDoor);
  }
  points.push(endPt);

  // Clean duplicate adjacent points
  const cleanPoints: { x: number; y: number }[] = [];
  for (const pt of points) {
    if (cleanPoints.length === 0) {
      cleanPoints.push(pt);
    } else {
      const prev = cleanPoints[cleanPoints.length - 1];
      if (Math.abs(prev.x - pt.x) > 1 || Math.abs(prev.y - pt.y) > 1) {
        cleanPoints.push(pt);
      }
    }
  }

  return cleanPoints;
};
