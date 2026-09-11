/** The flow from a request to production as one picture: eight stations, who or what runs each,
 *  and the two clicks the facilitator makes from this page (spec "The page", block 1). Static.
 *
 *  Two rows of four rather than one row of eight: the build half (people and the two skills) above
 *  the ship half (Railway and the workflows), which is the half this page makes visible. At the
 *  room's 1024px the drawing renders 1:1, so every label sits at the projector's 18px floor; a
 *  narrower window scales the whole picture, a wider one lets the container cap it. The connector
 *  from the last pull request down into develop is the first click, so it carries the accent and
 *  the heavier stroke; the arrow from staging to production is the second. Colour is never the only
 *  signal: the two click arrows are also thicker and labelled. */
const WIDTH = 976;
const HEIGHT = 250;
const NODE_W = 200;
const NODE_H = 72;
const COLUMN = 244; // a node plus the 44px arrow gap
const LEFT = 22; // centres four columns in the width
const ROW_1 = 2;
const ROW_2 = 144;
const ELBOW_Y = 114; // the horizontal run of the connector between the rows

type Station = { label: string; actor: string };

const BUILD: Station[] = [
  { label: "Request", actor: "a person" },
  { label: "Triage", actor: "/triage-requests" },
  { label: "Implement", actor: "/implement-issue" },
  { label: "Pull requests", actor: "reviewers" },
];

const SHIP: Station[] = [
  { label: "Develop", actor: "Railway" },
  { label: "Staging", actor: "staging-label" },
  { label: "Production", actor: "ship" },
  { label: "Shipped", actor: "lifecycle workflow" },
];

const left = (column: number) => LEFT + column * COLUMN;
const right = (column: number) => left(column) + NODE_W;
const centre = (column: number) => left(column) + NODE_W / 2;
const middle = (row: number) => row + NODE_H / 2;

function Row({ stations, y }: { stations: Station[]; y: number }) {
  return (
    <>
      {stations.map((station, column) => (
        <g key={station.label}>
          <rect
            x={left(column)}
            y={y}
            width={NODE_W}
            height={NODE_H}
            rx={12}
            strokeWidth={1.5}
            className="fill-card stroke-border"
          />
          <text
            x={centre(column)}
            y={y + 30}
            textAnchor="middle"
            fontSize={18}
            className="fill-foreground font-medium"
          >
            {station.label}
          </text>
          <text
            x={centre(column)}
            y={y + 56}
            textAnchor="middle"
            fontSize={18}
            className="fill-muted-foreground"
          >
            {station.actor}
          </text>
        </g>
      ))}
    </>
  );
}

/** A connector. The two the facilitator drives from this page are `click`: accent, heavier. */
function Arrow({ d, click = false }: { d: string; click?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      strokeWidth={click ? 2.5 : 1.5}
      strokeLinejoin="round"
      markerEnd={click ? "url(#flow-arrowhead-click)" : "url(#flow-arrowhead)"}
      className={click ? "stroke-primary" : "stroke-muted-foreground"}
    />
  );
}

function Arrowhead({ id, className }: { id: string; className: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={10}
      refY={5}
      markerWidth={9}
      markerHeight={9}
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M0 0L10 5L0 10Z" className={className} />
    </marker>
  );
}

export function FlowDiagram() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-labelledby="flow-title"
      aria-describedby="flow-description"
      className="h-auto w-full"
    >
      <title id="flow-title">How it flows</title>
      <desc id="flow-description">
        A request is filed by a person, triaged by the triage-requests skill, implemented by the
        implement-issue skill and reviewed as pull requests. Deploy to staging, the first click,
        merges them into develop, which Railway serves as staging and the staging-label workflow
        marks. Deploy to production, the second click, runs the ship workflow that promotes develop
        to production; the lifecycle workflow closes the shipped issues.
      </desc>
      <defs>
        <Arrowhead id="flow-arrowhead" className="fill-muted-foreground" />
        <Arrowhead id="flow-arrowhead-click" className="fill-primary" />
      </defs>

      <Row stations={BUILD} y={ROW_1} />
      <Row stations={SHIP} y={ROW_2} />

      {/* The build half, left to right. */}
      {[0, 1, 2].map((column) => (
        <Arrow key={column} d={`M${right(column)} ${middle(ROW_1)} H${left(column + 1)}`} />
      ))}

      {/* First click: from the last pull request down and across into develop. */}
      <Arrow d={`M${centre(3)} ${ROW_1 + NODE_H} V${ELBOW_Y} H${centre(0)} V${ROW_2}`} click />
      <text
        x={WIDTH / 2}
        y={ELBOW_Y - 8}
        textAnchor="middle"
        fontSize={18}
        className="fill-primary font-medium"
      >
        Deploy to staging
      </text>

      {/* The ship half: develop to staging by Railway, staging to production by the second click,
          production to shipped by the lifecycle workflow. */}
      <Arrow d={`M${right(0)} ${middle(ROW_2)} H${left(1)}`} />
      <Arrow d={`M${right(1)} ${middle(ROW_2)} H${left(2)}`} click />
      <Arrow d={`M${right(2)} ${middle(ROW_2)} H${left(3)}`} />
      <text
        x={(right(1) + left(2)) / 2}
        y={ROW_2 + NODE_H + 26}
        textAnchor="middle"
        fontSize={18}
        className="fill-primary font-medium"
      >
        Deploy to production
      </text>
    </svg>
  );
}
