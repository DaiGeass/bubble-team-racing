import type {GameMode,TrackDef,VehicleMode} from "./data";

export interface RaceRules {victory:"laps"|"lives";abilities:boolean;physicalEvolution:boolean;vehicleModes:readonly VehicleMode[];cannons:boolean}
/** Central policy for track/mode/network combinations; no parallel rules in the renderer. */
export function raceRules(track:TrackDef,mode:GameMode,network:boolean):RaceRules {
  const vehicles=new Set<VehicleMode>(["land"]);
  for(const zone of track.zones)vehicles.add(zone.type==="water"?"boat":zone.type==="sky"?"plane":zone.type==="sub"?"sub":"hover");
  return {victory:mode.id==="battle"?"lives":"laps",abilities:mode.itemsEnabled,physicalEvolution:!network&&mode.id!=="battle",vehicleModes:[...vehicles],cannons:!!track.pads?.some(p=>p.kind==="cannon")};
}
