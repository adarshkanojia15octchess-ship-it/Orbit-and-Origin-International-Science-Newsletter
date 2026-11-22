const skyObjects = Object.freeze(
  [
{id:"sun",name:"The Sun",kind:"Star",place:"Solar System",ra:"—",dec:"—",x:510,y:265,mag:"−26.74",distance:"1 AU · 8 min 20 s light travel",description:"The G-type main-sequence star at the centre of our Solar System. Nuclear fusion in its core releases the energy that drives sunlight, space weather and the climate system of Earth.",importance:"A nearby laboratory for stellar physics, magnetic activity and plasma processes.",eyes:"sun",source:"https://science.nasa.gov/sun/"},
{id:"moon",name:"The Moon",kind:"Natural satellite",place:"Solar System",ra:"—",dec:"—",x:570,y:320,mag:"−12.7 (full)",distance:"384,400 km average",description:"Earth's only natural satellite. Its phases follow the changing Sun–Earth–Moon geometry, and its gravity produces most of Earth's ocean tides.",importance:"Its rocks preserve a record of early Solar System history; it is also a major destination for exploration.",eyes:"moon",source:"https://science.nasa.gov/moon/"},
{id:"mercury",name:"Mercury",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:460,y:245,mag:"−2.5 to +5.7",distance:"0.39 AU average from Sun",description:"The smallest planet and closest to the Sun. Mercury has a large iron-rich core, an ancient cratered surface and extreme temperature contrasts.",importance:"MESSENGER transformed our understanding of its geology; BepiColombo is continuing the investigation.",eyes:"mercury",source:"https://science.nasa.gov/mercury/"},
{id:"venus",name:"Venus",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:475,y:285,mag:"−4.9 brightest",distance:"0.72 AU average from Sun",description:"A rocky world wrapped in a dense carbon-dioxide atmosphere and global clouds of sulfuric-acid droplets. Its greenhouse effect makes the surface hotter than Mercury's.",importance:"A natural laboratory for atmospheric physics, climate evolution and comparative planetology.",eyes:"venus",source:"https://science.nasa.gov/venus/"},
{id:"mars",name:"Mars",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:540,y:225,mag:"−2.9 to +1.8",distance:"1.52 AU average from Sun",description:"A cold desert world with volcanoes, canyons, polar caps and geological evidence that liquid water once flowed across its surface.",importance:"Rovers and orbiters investigate its geology and past habitability.",eyes:"mars",source:"https://science.nasa.gov/mars/"},
{id:"jupiter",name:"Jupiter",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:640,y:180,mag:"−2.9 brightest",distance:"5.20 AU average from Sun",description:"The largest planet, a hydrogen–helium gas giant with powerful atmospheric bands, long-lived storms and a vast magnetosphere.",importance:"Its Galilean moons include ocean-world candidates Europa and Ganymede, central to astrobiology.",eyes:"jupiter",source:"https://science.nasa.gov/jupiter/"},
{id:"saturn",name:"Saturn",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:705,y:225,mag:"−0.5 brightest",distance:"9.58 AU average from Sun",description:"A gas giant famous for its extensive rings, made of countless icy particles. Its atmosphere hosts fast winds and immense storms.",importance:"Cassini revealed ring structure and the active water-rich plumes of Enceladus.",eyes:"saturn",source:"https://science.nasa.gov/saturn/"},
{id:"uranus",name:"Uranus",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:760,y:280,mag:"+5.3 average",distance:"19.2 AU average from Sun",description:"An ice giant with an extreme axial tilt, so it appears to rotate almost on its side. Its atmosphere contains hydrogen, helium and methane.",importance:"Voyager 2 remains the only spacecraft to have visited; a dedicated orbiter is a major planetary-science priority.",eyes:"uranus",source:"https://science.nasa.gov/uranus/"},
{id:"neptune",name:"Neptune",kind:"Planet",place:"Solar System",ra:"—",dec:"—",x:810,y:330,mag:"+7.8 average",distance:"30.1 AU average from Sun",description:"A distant ice giant with supersonic atmospheric winds, dynamic weather and the large moon Triton, which likely originated in the Kuiper Belt.",importance:"Voyager 2's 1989 flyby transformed a point of light into a complex planetary world.",eyes:"neptune",source:"https://science.nasa.gov/neptune/"},
{id:"pluto",name:"Pluto",kind:"Dwarf planet",place:"Kuiper Belt",ra:"—",dec:"—",x:860,y:385,mag:"+14 to +16",distance:"39.5 AU average from Sun",description:"A complex icy dwarf planet with mountains, glaciers, a thin atmosphere and a large moon, Charon. Sputnik Planitia forms the bright heart-shaped region.",importance:"New Horizons revealed a surprisingly active and varied world during its 2015 flyby.",eyes:"pluto",source:"https://science.nasa.gov/dwarf-planets/pluto/"},
{id:"sirius",name:"Sirius",kind:"Binary star system",place:"Canis Major",ra:"06h 45m",dec:"−16° 43′",x:300,y:355,mag:"−1.46",distance:"8.6 light-years",description:"The brightest star in Earth's night sky. Sirius is a binary: Sirius A is a luminous main-sequence star and Sirius B is a dense white dwarf.",importance:"Its proper motion and binary orbit made it historically important in stellar astronomy.",source:"https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Sirius"},
{id:"vega",name:"Vega",kind:"Star",place:"Lyra",ra:"18h 36m",dec:"+38° 47′",x:760,y:95,mag:"+0.03",distance:"25 light-years",description:"A bright, rapidly rotating A-type star and one of the vertices of the Summer Triangle. Its debris disc helps astronomers study planetary-system formation.",importance:"One of the first stars whose distance was measured by parallax; it became a key photometric standard.",source:"https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Vega"},
{id:"betelgeuse",name:"Betelgeuse",kind:"Red supergiant",place:"Orion",ra:"05h 55m",dec:"+07° 24′",x:390,y:235,mag:"Variable, ~0 to +1.6",distance:"~550 light-years",description:"A huge, cool red supergiant nearing a late stage of stellar evolution. Its brightness and surface change as enormous convective cells and dust shape its appearance.",importance:"A nearby laboratory for understanding the late evolution of massive stars.",source:"https://science.nasa.gov/universe/stars/"},
{id:"orion",name:"Orion Nebula · M42",kind:"Star-forming nebula",place:"Orion",ra:"05h 35m",dec:"−05° 23′",x:420,y:290,mag:"+4.0",distance:"~1,350 light-years",description:"A nearby stellar nursery where gas and dust collapse to form stars. Young stars illuminate the surrounding gas, producing glowing and obscuring structures.",importance:"A benchmark for studying star formation, protoplanetary discs and young stellar environments.",source:"https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/orion-nebula/"},
{id:"pleiades",name:"Pleiades · M45",kind:"Open star cluster",place:"Taurus",ra:"03h 47m",dec:"+24° 07′",x:270,y:160,mag:"+1.6",distance:"~440 light-years",description:"A young, nearby cluster of hot blue stars. The familiar blue haze in long-exposure images is starlight scattered by foreground interstellar dust.",importance:"Its stars help astronomers test stellar evolution models and measure young-cluster properties.",source:"https://science.nasa.gov/universe/stars/"},
{id:"andromeda",name:"Andromeda Galaxy · M31",kind:"Spiral galaxy",place:"Andromeda",ra:"00h 42m",dec:"+41° 16′",x:155,y:105,mag:"+3.4",distance:"~2.5 million light-years",description:"The nearest large spiral galaxy to the Milky Way. It contains hundreds of billions of stars and is approaching our Galaxy as the two evolve within the Local Group.",importance:"A cornerstone for understanding spiral galaxies, stellar populations and the long-term evolution of the Local Group.",source:"https://science.nasa.gov/universe/galaxies/"},
{id:"crab",name:"Crab Nebula · M1",kind:"Supernova remnant",place:"Taurus",ra:"05h 34m",dec:"+22° 01′",x:350,y:180,mag:"+8.4",distance:"~6,500 light-years",description:"The expanding remnant of a supernova observed in 1054 CE. At its centre lies a rapidly rotating neutron star, the Crab Pulsar.",importance:"A multiwavelength laboratory for pulsars, relativistic particles and the aftermath of massive-star explosions.",source:"https://science.nasa.gov/universe/supernovae/"}
].map((object) => Object.freeze(object)),
);

export const SKY_OBJECTS = skyObjects;

export function skyObjectCategory(object) {
  if (
    object.id === "sun" ||
    ["Planet", "Dwarf planet", "Natural satellite"].includes(object.kind)
  ) return "Solar System";
  if (["Star", "Binary star system", "Red supergiant"].includes(object.kind)) return "Stars";
  return "Deep sky";
}

export function clampSkyZoom(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2.8, Math.max(0.7, Number(value.toFixed(2))));
}

export function getSkyFocusTransform(object, zoom) {
  const safeZoom = clampSkyZoom(zoom);
  return {
    translateX: 500 - object.x * safeZoom,
    translateY: 250 - object.y * safeZoom,
    scale: safeZoom,
  };
}

export function getNASAObjectUrl(object) {
  if (skyObjectCategory(object) !== "Solar System" || !object.eyes) return null;
  return "https://eyes.nasa.gov/apps/solar-system/#/" + encodeURIComponent(object.eyes);
}

export function validateSkyCatalogue(objects = SKY_OBJECTS) {
  const errors = [];
  const ids = new Set();
  for (const object of objects) {
    if (!object.id || ids.has(object.id)) errors.push("Object IDs must be non-empty and unique.");
    ids.add(object.id);
    if (!object.name.trim() || !object.kind.trim() || !object.description.trim()) {
      errors.push(object.id + ": name, kind and description are required.");
    }
    if (!Number.isFinite(object.x) || object.x < 0 || object.x > 1000 ||
        !Number.isFinite(object.y) || object.y < 0 || object.y > 500) {
      errors.push(object.id + ": schematic coordinates must stay inside the 1000 × 500 viewBox.");
    }
    for (const [label, value] of [["source", object.source]]) {
      try {
        if (new URL(value).protocol !== "https:") errors.push(object.id + ": " + label + " must use HTTPS.");
      } catch {
        errors.push(object.id + ": " + label + " must be a valid URL.");
      }
    }
  }
  return errors;
}
