import { newRow, type Row, type Person } from "./model";
export function starterRows(by: Person): Row[] {
  return [
    newRow(
      "destination",
      {
        title: "Bogotá",
        notes:
          "A mountain-city beginning. A suggested stop, ready to make yours.",
        order: 0,
        isStarter: true,
      },
      by,
    ),
    newRow(
      "destination",
      {
        title: "Cartagena",
        notes: "Colorful streets and Caribbean evenings. A suggested stop.",
        order: 1,
        isStarter: true,
      },
      by,
    ),
    newRow(
      "destination",
      {
        title: "Medellín",
        notes:
          "Green hills, art, and a little room for a detour. A suggested stop.",
        order: 2,
        isStarter: true,
      },
      by,
    ),
  ];
}
export const discoveries = [
  {
    id: "food-arepa",
    title: "Arepa de huevo",
    city: "Cartagena",
    category: "Food",
    notes:
      "A fried corn arepa with an egg inside. A community thread suggests this and other Caribbean dishes; save a spot you want to try.",
    source: "r/cartagena · community tip",
    url: "https://www.reddit.com/r/cartagena/comments/1s3hdhq/",
    sourceDate: "2026-11-15",
  },
  {
    id: "food-posta",
    title: "Posta cartagenera",
    city: "Cartagena",
    category: "Food",
    notes:
      "A local beef dish suggested alongside mote de queso in a regional food discussion. Community recommendation; check venues before visiting.",
    source: "r/cartagena · community tip",
    url: "https://www.reddit.com/r/cartagena/comments/1s3hdhq/",
    sourceDate: "2026-11-15",
  },
  {
    id: "food-ajiaco",
    title: "Ajiaco santafereño",
    city: "Bogotá",
    category: "Food",
    notes:
      "A Bogotá chicken-and-potato soup. Compare local suggestions and keep the restaurant you choose.",
    source: "r/Bogota · community tip",
    url: "https://www.reddit.com/r/Bogota/comments/1or549y/",
    sourceDate: "2026-11-15",
  },
  {
    id: "food-paisa",
    title: "Bandeja paisa",
    city: "Medellín",
    category: "Food",
    notes:
      "A hearty Antioquian plate. This discussion lists traditional foods to try, including arepas and mazamorra.",
    source: "r/medellin · community tip",
    url: "https://www.reddit.com/r/medellin/comments/sfdhzc/",
    sourceDate: "2026-11-15",
  },
  {
    id: "sight-candelaria",
    title: "Wander La Candelaria",
    city: "Bogotá",
    category: "Sight",
    notes:
      "Explore Bogotá’s historic center. Check the official visitor guide for current details.",
    source: "Official visitor guide",
    url: "https://colombia.travel/en/bogota",
  },
  {
    id: "sight-getsemani",
    title: "Color hunting in Getsemaní",
    city: "Cartagena",
    category: "Sight",
    notes:
      "Make time for colorful streets and plazas. Leave room in the plan for a slow wander.",
    source: "Official visitor guide",
    url: "https://colombia.travel/en/cartagena-de-indias",
  },
  {
    id: "sight-medellin",
    title: "A day of art in Medellín",
    city: "Medellín",
    category: "Sight",
    notes:
      "Build a city day around public art and neighborhoods. Pick specific stops from the visitor guide.",
    source: "Official visitor guide",
    url: "https://colombia.travel/en/medellin",
  },
  {
    id: "sight-cocora",
    title: "Dream up a coffee-region detour",
    city: "Salento",
    category: "Sight",
    notes:
      "A possible extra chapter around Salento and the Cocora Valley. Add the destination first if it fits your route.",
    source: "Official visitor guide",
    url: "https://colombia.travel/en/salento",
  },
];
