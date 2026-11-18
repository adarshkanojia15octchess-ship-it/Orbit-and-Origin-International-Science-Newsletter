import { NextResponse } from "next/server";
import { searchNasaImage } from "@/lib/science/nasa-images";

export const revalidate = 43200;

const records = [
  { id:"milky-way", title:"The Milky Way", label:"Our home galaxy", scale:"More than 100,000 light-years across",
    body:"A spiral galaxy. Our Solar System is located along one of its spiral arms, roughly halfway from the galactic centre. One circuit around the Milky Way takes the Solar System about 240 million years.",
    query:"Milky Way galaxy NASA", source:"https://science.nasa.gov/universe/galaxies/" },
  { id:"andromeda", title:"Andromeda · M31", label:"Nearest large galactic neighbour", scale:"About 2.5 million light-years away",
    body:"The Andromeda Galaxy is the other major spiral in our immediate galactic neighbourhood. It is one of the most massive members of the Local Group.",
    query:"Andromeda Galaxy M31 NASA", source:"https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html" },
  { id:"triangulum", title:"Triangulum · M33", label:"A major Local Group spiral", scale:"A nearby member of the Local Group",
    body:"Triangulum is another prominent spiral galaxy in our galactic neighbourhood and is commonly identified as the Local Group's third-largest major galaxy.",
    query:"Triangulum Galaxy M33 NASA", source:"https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html" },
  { id:"local-group", title:"The Local Group", label:"Our galactic association", scale:"More than 50 galaxies in NASA's overview",
    body:"The Milky Way, Andromeda and Triangulum are its best-known large members. The group also contains many smaller dwarf galaxies; membership counts depend on how faint companions are identified.",
    query:"Local Group galaxies Milky Way Andromeda NASA", source:"https://science.nasa.gov/universe/galaxies/" },
  { id:"virgo", title:"Virgo Cluster", label:"A nearby galaxy cluster", scale:"Hundreds of galaxies",
    body:"Galaxy clusters contain many galaxies together with hot gas and dark matter. NASA places the Local Group near the outer edge of the Virgo Cluster region.",
    query:"Virgo Cluster galaxies NASA Hubble", source:"https://science.nasa.gov/universe/galaxies/large-scale-structures/" },
  { id:"cosmic-web", title:"The Cosmic Web", label:"Large-scale structure", scale:"Filaments, walls and vast voids",
    body:"Galaxies and clusters are arranged in enormous structures. The visible galaxies trace a wider pattern of matter, with long filaments and low-density voids between them.",
    query:"cosmic web galaxy filaments NASA simulation", source:"https://science.nasa.gov/universe/galaxies/large-scale-structures/" },
];

export async function GET() {
  const objects = await Promise.all(records.map(async record => {
    const image = await searchNasaImage(record.query);
    return {
      ...record, imageUrl:image?.imageUrl || null, imageTitle:image?.title || null,
      imagePageUrl:image?.pageUrl || null, imageCredit:image ? "NASA Image and Video Library" : null,
    };
  }));
  return NextResponse.json({
    objects,
    scalePath:[
      {label:"Solar System",detail:"One planetary system"},
      {label:"Milky Way",detail:"Our home galaxy"},
      {label:"Local Group",detail:"Our nearby galaxy group"},
      {label:"Laniakea",detail:"The wider supercluster region"},
      {label:"Cosmic Web",detail:"Filaments and voids on the largest scales"},
    ],
    sources:[
      {name:"NASA Science · Galaxies",url:"https://science.nasa.gov/universe/galaxies/"},
      {name:"NASA Science · Large-scale structures",url:"https://science.nasa.gov/universe/galaxies/large-scale-structures/"},
      {name:"NASA Goddard · The Local Group",url:"https://imagine.gsfc.nasa.gov/features/cosmic/local_group_info.html"},
      {name:"NASA Image and Video Library",url:"https://images.nasa.gov/"},
    ],
    retrievedAt:new Date().toISOString(),
    editorialNote:"Galaxy membership and distances are approximate and can change as observations identify faint dwarf galaxies and refine distance measurements. Images are selected from NASA's public image library.",
  },{headers:{"Cache-Control":"public, s-maxage=43200, stale-while-revalidate=86400"}});
}
