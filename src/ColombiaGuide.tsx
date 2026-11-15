import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Leaf,
  Utensils,
  Music,
  Landmark,
  MapPin,
} from "lucide-react";
import { External } from "./components";
const wiki = "https://en.wikipedia.org/wiki/Colombia";
const facts = [
  {
    category: "Nature",
    title: "Two coasts, one country",
    body: "Colombia reaches both the Caribbean Sea and the Pacific Ocean. An inland mountain day and a coastal day can feel like different worlds.",
    source: "Wikipedia · Colombia",
    url: wiki,
  },
  {
    category: "Nature",
    title: "A country with wings",
    body: "Colombia ranks first worldwide in bird-species diversity. The Andes, Amazon, and Chocó help make its habitats unusually varied.",
    source: "Convention on Biological Diversity",
    url: "https://www.cbd.int/countries/profile/default.shtml?country=co",
  },
  {
    category: "Food",
    title: "An arepa with a surprise inside",
    body: "On the Caribbean coast, an arepa de huevo is fried with an egg inside. It’s one regional take on the corn arepa, not a single recipe shared by the whole country.",
    source: "Cartagena food discussion · community tips",
    url: "https://www.reddit.com/r/cartagena/comments/1s3hdhq/",
  },
  {
    category: "Food",
    title: "A bowl of Bogotá",
    body: "Ajiaco is a potato-and-corn soup associated with Bogotá. Regional food changes as you move from highland cities to the coast.",
    source: "Wikipedia · Colombian cuisine",
    url: "https://en.wikipedia.org/wiki/Colombian_cuisine",
  },
  {
    category: "Food",
    title: "Coffee is a landscape, too",
    body: "Colombia’s UNESCO-listed coffee landscape includes small farms and hillside towns. Its heritage is as much about everyday rural life as what ends up in the cup.",
    source: "UNESCO · Coffee Cultural Landscape",
    url: "https://whc.unesco.org/en/list/1121/",
  },
  {
    category: "Culture",
    title: "The soundtrack keeps changing",
    body: "Vallenato, cumbia, and champeta are all part of Colombia’s musical variety. Listen for how the sound changes between regions.",
    source: "Colombia Travel · culture and rhythms",
    url: "https://colombia.travel/en/colombiaco/extraordinary-destination",
  },
  {
    category: "Culture",
    title: "Many roots, many stories",
    body: "Indigenous traditions, the African diaspora, and European influences all shape Colombian culture. Spanish is the main official language, alongside regionally recognized languages.",
    source: "Wikipedia · Colombia",
    url: wiki,
  },
  {
    category: "History",
    title: "More than one date to remember",
    body: "20 July 1810 marks Colombia’s Independence Day. The independence struggle continued afterwards; the Battle of Boyacá followed in 1819.",
    source: "Wikipedia · Colombian history",
    url: wiki + "#Independence",
  },
  {
    category: "History",
    title: "Walls that held a port city",
    body: "Cartagena’s UNESCO-listed heritage brings together its port, fortifications, and historic neighborhoods. The walls are a good place to think about the city’s role in Caribbean history.",
    source: "UNESCO · Cartagena",
    url: "https://whc.unesco.org/en/list/285/",
  },
];
const categories = [
  ["All", Sparkles],
  ["Food", Utensils],
  ["Culture", Music],
  ["History", Landmark],
  ["Nature", Leaf],
] as const;
const cities = [
  ["Bogotá", "7,937,898", "Capital District"],
  ["Medellín", "2,634,570", "Antioquia"],
  ["Cali", "2,285,099", "Valle del Cauca"],
  ["Barranquilla", "1,342,818", "Atlántico"],
  ["Cartagena", "1,065,881", "Bolívar"],
];
export default function ColombiaGuide() {
  const [category, setCategory] = useState("All");
  const [index, setIndex] = useState(0);
  const selected = facts.filter(
    (f) => category === "All" || f.category === category,
  );
  const fact = selected[index % selected.length];
  return (
    <div className="colombia-guide">
      <section className="country-intro">
        <div>
          <span className="eyebrow">A LITTLE CONTEXT FOR THE ADVENTURE</span>
          <h2>
            Much more than
            <br />
            <em>a place on the map.</em>
          </h2>
          <p>
            A pocket introduction to the country we’re about to get to know.
          </p>
          <External url={wiki}>Read more on Wikipedia</External>
        </div>
        <div className="country-mark" aria-hidden="true">
          <span>CO</span>
          <i></i>
          <b>✳</b>
        </div>
      </section>
      <section className="country-basics">
        <div className="section-heading">
          <h2>Colombia, at a glance</h2>
          <span className="pill">THE BASICS</span>
        </div>
        <dl>
          <div>
            <dt>Population</dt>
            <dd>
              53.4 million<small>2025 estimate · World Bank</small>
            </dd>
          </div>
          <div>
            <dt>Capital</dt>
            <dd>
              Bogotá<small>Andean highlands</small>
            </dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>
              1,141,748 km²<small>Total area</small>
            </dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>
              Colombian peso<small>COP · prices use $ locally</small>
            </dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>
              UTC −5<small>Colombia time</small>
            </dd>
          </div>
          <div>
            <dt>Main language</dt>
            <dd>
              Spanish<small>Plus recognized regional languages</small>
            </dd>
          </div>
        </dl>
        <div className="guide-sources">
          <External url="https://data.worldbank.org/country/CO">
            Population: World Bank, 2025
          </External>
          <External url={wiki}>Country basics: Wikipedia</External>
        </div>
      </section>
      <section className="curiosity-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FOR THE “DID YOU KNOW?” MOMENTS</span>
            <h2>A little curiosity goes a long way.</h2>
          </div>
          <Sparkles size={25} />
        </div>
        <div className="curiosity-filters">
          {categories.map(([c, Icon]) => (
            <button
              key={c}
              aria-pressed={category === c}
              className={category === c ? "selected" : ""}
              onClick={() => {
                setCategory(c);
                setIndex(0);
              }}
            >
              <Icon size={16} />
              {c === "All" ? "Surprise me" : c}
            </button>
          ))}
        </div>
        <article
          className={`curiosity-card curiosity-${fact.category.toLowerCase()}`}
          aria-live="polite"
        >
          <span className="eyebrow">
            {fact.category} · {(index % selected.length) + 1} /{" "}
            {selected.length}
          </span>
          <h3>{fact.title}</h3>
          <p>{fact.body}</p>
          <div className="row">
            <External url={fact.url}>{fact.source}</External>
            <button
              className="button ink"
              onClick={() => setIndex((i) => i + 1)}
            >
              One more curiosity
              <ArrowRight size={16} />
            </button>
          </div>
        </article>
      </section>
      <section className="surface biggest-cities">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIVE BIG CITY STORIES</span>
            <h2>The largest cities</h2>
          </div>
          <MapPin size={23} />
        </div>
        <p>
          City populations, not metropolitan areas · 2025 projections reported
          by Wikipedia from DANE census-based figures.
        </p>
        <div className="city-table">
          <table>
            <thead>
              <tr>
                <th scope="col">City</th>
                <th scope="col">Department / district</th>
                <th scope="col">Population</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(([name, pop, region], i) => (
                <tr key={name}>
                  <th scope="row">
                    <span>{i + 1}</span>
                    {name}
                  </th>
                  <td>{region}</td>
                  <td>{pop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <External url="https://en.wikipedia.org/wiki/List_of_cities_in_Colombia_by_population">
          See the city figures and methodology
        </External>
      </section>
      <div className="guide-footnote">
        <BookOpen size={18} />
        <p>
          Researched 15 November 2026. Facts and sources are bundled for offline
          reading; source links need internet. Population figures are dated
          estimates, not live counts. Summaries are written for this guide.
        </p>
      </div>
    </div>
  );
}
